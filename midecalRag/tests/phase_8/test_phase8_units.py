"""Offline unit tests for Phase 8 (golden set, metrics, calibration).

No network and no Qdrant: every case run is fabricated, which also lets each
metric be checked against a hand-computed value.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.evaluation import (
    DEFAULT_FLOORS,
    CaseRun,
    GoldenCase,
    GoldenDataset,
    GoldenDocument,
    GoldenPatient,
    RetrievedDoc,
    calibrate_floor,
    derive_findings,
    distinct_documents,
    evaluate_cases,
    format_report,
    load_dataset,
    score_distribution,
    validate_dataset,
)

DATASET_PATH = Path(__file__).resolve().parents[2] / "data" / "eval" / "golden_dataset.json"


# --------------------------------------------------------------------------- #
# builders
# --------------------------------------------------------------------------- #
def make_case(
    case_id: str = "c1",
    *,
    category: str = "latest_lab",
    patient: str = "p1",
    expected: tuple[str, ...] = ("d1",),
    forbidden: tuple[str, ...] = (),
    expect_not_found: bool = False,
    kind: str = "ask",
    expected_mode: str | None = None,
    expected_sections: tuple[str, ...] = (),
    forbidden_content: tuple[str, ...] = (),
) -> GoldenCase:
    return GoldenCase(
        id=case_id,
        category=category,
        language="en",
        patient_id=patient,
        kind=kind,
        doctor_query="q" if kind == "ask" else None,
        expected_document_ids=expected,
        forbidden_document_ids=forbidden,
        expect_not_found=expect_not_found,
        expected_mode=expected_mode,
        expected_sections=expected_sections,
        forbidden_content=forbidden_content,
    )


def make_run(
    case: GoldenCase,
    docs: list[tuple[str, float]] | None = None,
    *,
    mode: str = "normal",
    answer: str | None = None,
    sources: tuple[str, ...] = (),
    result_type: str | None = None,
    own: tuple[str, ...] = (),
    summary_status: str | None = None,
    section_keys: tuple[str, ...] = (),
    latency: float = 100.0,
) -> CaseRun:
    return CaseRun(
        case=case,
        retrieved=tuple(RetrievedDoc(document_id=doc, relevance=score) for doc, score in (docs or [])),
        mode=mode,
        answer=answer,
        source_ids=sources,
        result_type=result_type,
        own_document_ids=own,
        summary_status=summary_status,
        section_keys=section_keys,
        latency_ms=latency,
    )


# --------------------------------------------------------------------------- #
# dataset
# --------------------------------------------------------------------------- #
def test_shipped_dataset_is_valid_and_covers_the_required_categories():
    dataset = load_dataset(DATASET_PATH)
    assert validate_dataset(dataset) == []
    categories = {case.category for case in dataset.cases}
    required = {
        "latest_lab",
        "latest_drug",
        "exact_dose",
        "trend",
        "conflict",
        "session_report",
        "medical_report",
        "follow_up",
        "negative",
        "isolation",
        "filter",
        "arabic",
        "cross_language",
        "ambiguous_arabic",
        "summary",
    }
    assert required <= categories, required - categories
    languages = {case.language for case in dataset.cases}
    assert {"ar", "en"} <= languages
    assert any(case.kind == "summary" for case in dataset.cases)
    assert any(case.chat_history for case in dataset.cases)


def test_dataset_records_its_synthetic_status():
    dataset = load_dataset(DATASET_PATH)
    assert "SYNTHETIC" in dataset.description.upper()
    assert "PENDING" in dataset.description.upper()


def test_validation_catches_broken_cases(tmp_path):
    payload = {
        "version": 1,
        "clock": "2026-11-23",
        "patients": {"p1": {"documents": [
            {"document_id": "d1", "doc_type": "lab_result", "doc_date": "2026-01-01", "lines": ["x"]}
        ]}},
        "cases": [
            {"id": "a", "category": "x", "language": "en", "patient_id": "nobody", "doctor_query": "q"},
            {"id": "b", "category": "x", "language": "en", "patient_id": "p1", "doctor_query": "q",
             "expected_document_ids": ["missing"]},
            {"id": "c", "category": "x", "language": "en", "patient_id": "p1", "doctor_query": "q",
             "expect_not_found": True, "expected_document_ids": ["d1"]},
            {"id": "c", "category": "x", "language": "en", "patient_id": "p1", "doctor_query": "q"},
        ],
    }
    path = tmp_path / "broken.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    problems = validate_dataset(load_dataset(path))
    joined = " | ".join(problems)
    assert "unknown patient" in joined
    assert "not in the patient" in joined
    assert "not-found case with expected documents" in joined
    assert "duplicate case id" in joined


# --------------------------------------------------------------------------- #
# retrieval scoring
# --------------------------------------------------------------------------- #
def test_distinct_documents_dedupes_caps_and_applies_the_floor():
    case = make_case(expected=("d1",))
    run = make_run(
        case,
        [("d1", 0.9), ("d1", 0.8), ("d2", 0.4), ("d3", 0.3), ("d4", 0.2), ("d5", 0.1), ("d6", 0.05)],
    )
    assert distinct_documents(run) == ["d1", "d2", "d3", "d4", "d5"]
    assert distinct_documents(run, floor=0.35) == ["d1", "d2"]


def test_recall_and_mrr_match_a_hand_computed_value():
    hit = make_case("hit", expected=("d2", "d3"))
    miss = make_case("miss", expected=("d9",))
    runs = [
        make_run(hit, [("d1", 0.9), ("d2", 0.8), ("d3", 0.7)], result_type="answered", sources=("d2",)),
        make_run(miss, [("d4", 0.9), ("d5", 0.8)], result_type="answered", sources=("d4",)),
    ]
    metrics = evaluate_cases(runs)
    # 2 of 3 expected documents found
    assert metrics.recall_at_5 == pytest.approx(0.6667, abs=1e-4)
    # ranks 2 and 1 -> MRR = (1/2 + 0) / 2 = 0.25
    assert metrics.mrr == pytest.approx(0.25, abs=1e-4)
    # returned 5 documents, 2 hits
    assert metrics.precision == pytest.approx(0.4, abs=1e-4)


def test_newest_and_dose_metrics_use_the_top_document():
    latest = make_case("l", category="latest_lab", expected=("new",))
    dose = make_case("d", category="exact_dose", expected=("five",))
    runs = [
        make_run(latest, [("new", 0.9), ("old", 0.8)]),
        make_run(dose, [("ten", 0.9), ("five", 0.8)]),
    ]
    metrics = evaluate_cases(runs)
    assert metrics.newest_hit_rate == 1.0
    assert metrics.dose_top1 == 0.0


def test_not_found_correctness_counts_empty_candidate_sets_only():
    case = make_case("n", expect_not_found=True, expected=())
    empty = make_run(case, [], result_type="not_found")
    noisy = make_run(case, [("x", 0.5)], result_type="answered")
    assert evaluate_cases([empty]).not_found_correctness == 1.0
    assert evaluate_cases([noisy]).not_found_correctness == 0.0


def test_isolation_leak_and_same_patient_distractor_are_different_metrics():
    case = make_case("i", expected=("a1",), forbidden=("b1",), patient="pa")
    leaked = make_run(case, [("a1", 0.9), ("b1", 0.8)], own=("a1",))
    same_patient = make_case("d", expected=("a1",), forbidden=("a2",), patient="pa")
    distractor = make_run(same_patient, [("a1", 0.9), ("a2", 0.8)], own=("a1", "a2"))
    metrics = evaluate_cases([leaked, distractor])
    assert metrics.isolation_leaks == 1
    assert metrics.distractor_hits == 1


def test_citation_accuracy_requires_a_retrieved_expected_source():
    case = make_case("c", expected=("d1",))
    good = make_run(case, [("d1", 0.9), ("d2", 0.5)], sources=("d1",), result_type="answered")
    bad = make_run(case, [("d1", 0.9), ("d2", 0.5)], sources=("d2",), result_type="answered")
    assert evaluate_cases([good]).citation_accuracy == 1.0
    assert evaluate_cases([bad]).citation_accuracy == 0.0


def test_grounding_accepts_a_refusal_for_a_negative_case():
    case = make_case("n", expect_not_found=True, expected=())
    refused = make_run(
        case,
        [("x", 0.5)],
        result_type="answered",
        answer="There is not enough information in the patient's file to answer this question.",
    )
    arabic = make_run(
        case,
        [("x", 0.5)],
        result_type="answered",
        answer="لا توجد معلومات كافية في ملف المريض للإجابة عن هذا السؤال.",
    )
    assert evaluate_cases([refused]).grounding_pass_rate == 1.0
    assert evaluate_cases([arabic]).grounding_pass_rate == 1.0


def test_summary_cases_are_scored_separately():
    case = make_case("s", kind="summary", expected=(), expected_sections=("medications", "labs"))
    ok = make_run(
        case,
        summary_status="ok",
        section_keys=("medications", "labs", "visits"),
        sources=("d1",),
        own=("d1",),
    )
    partial = make_run(case, summary_status="ok", section_keys=("medications",))
    assert evaluate_cases([ok]).summary_ok_rate == 1.0
    assert evaluate_cases([partial]).summary_ok_rate == 0.0


def test_forbidden_content_is_counted_in_the_answer():
    case = make_case("f", expected=("d1",), forbidden_content=("1.3 mg/dL",))
    run = make_run(case, [("d1", 0.9)], answer="Creatinine was 1.3 mg/dL", result_type="answered")
    assert evaluate_cases([run]).forbidden_content_hits == 1


def test_latency_percentiles():
    runs = [
        make_run(make_case(f"c{i}", expected=()), latency=float(value))
        for i, value in enumerate([10, 20, 30, 40, 100])
    ]
    metrics = evaluate_cases(runs)
    assert metrics.latency_p50_ms == 30.0
    assert metrics.latency_p95_ms == 100.0


# --------------------------------------------------------------------------- #
# calibration
# --------------------------------------------------------------------------- #
def test_calibration_picks_a_floor_that_keeps_recall_and_cleans_noise():
    relevant = make_case("r", expected=("d1",))
    negative = make_case("n", expect_not_found=True, expected=())
    runs = [
        make_run(relevant, [("d1", 0.9), ("noise", 0.2)]),
        make_run(negative, [("noise2", 0.3)]),
    ]
    result = calibrate_floor(runs)
    assert result.baseline.recall_at_5 == 1.0
    assert result.chosen_floor is not None
    assert result.chosen_floor >= 0.35
    point = next(p for p in result.points if p.floor == result.chosen_floor)
    assert point.recall_at_5 == 1.0
    assert point.not_found_correctness == 1.0
    assert point.expected_documents_dropped == 0


def test_calibration_refuses_a_floor_that_costs_recall():
    relevant = make_case("r", expected=("weak",))
    runs = [make_run(relevant, [("weak", 0.3), ("noise", 0.9)])]
    result = calibrate_floor(runs)
    assert result.chosen_floor is None
    assert "stays 0.0" in result.rationale


def test_calibration_is_monotonic_in_expected_drops():
    case = make_case("r", expected=("a", "b", "c"))
    runs = [make_run(case, [("a", 0.9), ("b", 0.6), ("c", 0.4)])]
    result = calibrate_floor(runs)
    drops = [point.expected_documents_dropped for point in result.points]
    assert drops == sorted(drops)
    assert drops[0] == 0


def test_default_floors_start_at_zero():
    assert DEFAULT_FLOORS[0] == 0.0


# --------------------------------------------------------------------------- #
# distribution, findings, report
# --------------------------------------------------------------------------- #
def test_distribution_uses_the_best_parent_per_document():
    case = make_case("d", expected=("d1",))
    run = make_run(case, [("d1", 0.2), ("d1", 0.8), ("d2", 0.55)])
    distribution = score_distribution([run])
    assert distribution["relevant"]["max"] == 0.8
    assert distribution["relevant"]["count"] == 1
    assert distribution["irrelevant"]["max"] == 0.55


def test_findings_call_out_each_gap():
    case = make_case("r", expected=("d1",))
    metrics = evaluate_cases([make_run(case, [("d1", 0.9)])])
    calibration = calibrate_floor([make_run(case, [("d1", 0.9)])])
    findings = " ".join(derive_findings(metrics, calibration))
    assert "Exact-dose top-1" in findings
    assert "Not-found correctness" in findings
    assert "RELEVANCE_FLOOR stays 0.0" in findings


def test_report_contains_tables_disclaimer_and_decision():
    dataset = load_dataset(DATASET_PATH)
    case = make_case("r", expected=("d1",))
    runs = [make_run(case, [("d1", 0.9)])]
    metrics = evaluate_cases(runs)
    calibration = calibrate_floor(runs)
    report = format_report(
        dataset=dataset,
        metrics=metrics,
        calibration=calibration,
        distribution=score_distribution(runs),
        meta={"mode": "offline-scripted", "relevance_floor": 0.0},
        failures=["r: example"],
        findings=["example finding"],
    )
    assert "## Metrics" in report
    assert "## RELEVANCE_FLOOR calibration" in report
    assert "## Findings and recommendations" in report
    assert "synthetic" in report.lower()
    assert "not clinical validation" in report


def test_metrics_are_deterministic():
    case = make_case("r", expected=("d1",))
    runs = [make_run(case, [("d1", 0.9), ("d2", 0.4)], latency=12.0)]
    assert evaluate_cases(runs) == evaluate_cases(runs)
    assert calibrate_floor(runs).points == calibrate_floor(runs).points


def test_empty_run_list_is_safe():
    metrics = evaluate_cases([])
    assert metrics.cases == 0
    assert metrics.recall_at_5 == 0.0
    assert metrics.latency_p95_ms == 0.0


# --------------------------------------------------------------------------- #
# dataset object helpers
# --------------------------------------------------------------------------- #
def test_validate_accepts_a_minimal_dataset():
    dataset = GoldenDataset(
        version=1,
        clock="2026-11-23",
        description="SYNTHETIC - doctor review PENDING",
        patients={
            "p1": GoldenPatient(
                patient_id="p1",
                documents=(
                    GoldenDocument(
                        document_id="d1",
                        doc_type="lab_result",
                        doc_date="2026-01-01",
                        lines=("Creatinine: 1.8 mg/dL",),
                    ),
                ),
            )
        },
        cases=(make_case("c", expected=("d1",)),),
    )
    assert validate_dataset(dataset) == []
