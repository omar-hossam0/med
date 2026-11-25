"""Golden-set evaluation and threshold calibration (plan Phase 8).

The module is deliberately **pure**: it takes case runs (what retrieval and
generation actually produced) and computes metrics, score distributions and a
calibrated relevance floor. Ingestion, retrieval and generation live in
``scripts/evaluate_rag.py``, so every metric here can be unit-tested offline
with fabricated runs and re-scored at any floor without touching Qdrant.

Metric definitions (recorded in the report):
- ``recall_at_5``: micro-average over cases with expected documents of
  ``|expected ∩ first 5 distinct retrieved documents| / |expected|``.
- ``mrr``: mean of ``1 / rank`` of the first expected document (0 when absent).
- ``newest_hit_rate``: latest-question cases whose top document is the expected
  newest one.
- ``dose_top1``: exact-dose cases whose top document is the expected one.
- ``not_found_correctness``: negative cases that produced **no candidate after
  the gate** (the retrieval-layer short circuit, which is what the gate
  controls - not the model's refusal wording).
- ``precision``: expected hits / all returned documents (negative cases add
  returned documents with zero hits, so noise is penalised).
- ``isolation_leaks``: any forbidden document id appearing in the retrieved or
  cited set.
- ``citation_accuracy``: answered cases where every source is a retrieved
  document and at least one expected document is cited.
- ``grounding_pass_rate``: cases that ended ``answered`` (the verifier passed)
  or ``not_found`` as expected.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

TOP_K = 5

DEFAULT_FLOORS = (0.0, 0.2, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7)


# --------------------------------------------------------------------------- #
# dataset
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class GoldenDocument:
    document_id: str
    doc_type: str
    doc_date: str
    lines: tuple[str, ...] = ()
    session_report_data: dict[str, Any] | None = None


@dataclass(frozen=True)
class GoldenPatient:
    patient_id: str
    documents: tuple[GoldenDocument, ...]


@dataclass(frozen=True)
class GoldenCase:
    id: str
    category: str
    language: str
    patient_id: str
    kind: str = "ask"  # ask | summary
    doctor_query: str | None = None
    chat_history: tuple[dict[str, str], ...] = ()
    optional_filters: dict[str, Any] = field(default_factory=dict)
    expected_document_ids: tuple[str, ...] = ()
    expected_sections: tuple[str, ...] = ()
    expected_mode: str | None = None
    expected_facts: tuple[str, ...] = ()
    forbidden_document_ids: tuple[str, ...] = ()
    forbidden_content: tuple[str, ...] = ()
    expect_not_found: bool = False
    mock_rewrite: str | None = None
    mock_answer: str | None = None
    mock_summary: str | None = None


@dataclass(frozen=True)
class GoldenDataset:
    version: int
    clock: str
    description: str
    patients: dict[str, GoldenPatient]
    cases: tuple[GoldenCase, ...]


def _document(raw: dict[str, Any]) -> GoldenDocument:
    return GoldenDocument(
        document_id=str(raw["document_id"]),
        doc_type=str(raw["doc_type"]),
        doc_date=str(raw["doc_date"]),
        lines=tuple(str(line) for line in raw.get("lines") or ()),
        session_report_data=raw.get("session_report_data"),
    )


def _case(raw: dict[str, Any]) -> GoldenCase:
    return GoldenCase(
        id=str(raw["id"]),
        category=str(raw.get("category") or "uncategorised"),
        language=str(raw.get("language") or "en"),
        patient_id=str(raw["patient_id"]),
        kind=str(raw.get("kind") or "ask"),
        doctor_query=raw.get("doctor_query"),
        chat_history=tuple(raw.get("chat_history") or ()),
        optional_filters=dict(raw.get("optional_filters") or {}),
        expected_document_ids=tuple(raw.get("expected_document_ids") or ()),
        expected_sections=tuple(raw.get("expected_sections") or ()),
        expected_mode=raw.get("expected_mode"),
        expected_facts=tuple(raw.get("expected_facts") or ()),
        forbidden_document_ids=tuple(raw.get("forbidden_document_ids") or ()),
        forbidden_content=tuple(raw.get("forbidden_content") or ()),
        expect_not_found=bool(raw.get("expect_not_found")),
        mock_rewrite=raw.get("mock_rewrite"),
        mock_answer=raw.get("mock_answer"),
        mock_summary=raw.get("mock_summary"),
    )


def load_dataset(path: str | Path) -> GoldenDataset:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    patients = {
        patient_id: GoldenPatient(
            patient_id=patient_id,
            documents=tuple(_document(doc) for doc in raw.get("documents") or ()),
        )
        for patient_id, raw in (payload.get("patients") or {}).items()
    }
    return GoldenDataset(
        version=int(payload.get("version") or 1),
        clock=str(payload.get("clock") or ""),
        description=str(payload.get("description") or ""),
        patients=patients,
        cases=tuple(_case(raw) for raw in payload.get("cases") or ()),
    )


def validate_dataset(dataset: GoldenDataset) -> list[str]:
    """Return a list of problems; an empty list means the set is usable."""
    problems: list[str] = []
    seen: set[str] = set()
    for case in dataset.cases:
        if case.id in seen:
            problems.append(f"duplicate case id: {case.id}")
        seen.add(case.id)
        patient = dataset.patients.get(case.patient_id)
        if patient is None:
            problems.append(f"{case.id}: unknown patient {case.patient_id}")
            continue
        known = {document.document_id for document in patient.documents}
        for document_id in case.expected_document_ids:
            if document_id not in known:
                problems.append(f"{case.id}: expected document {document_id} is not in the patient")
        for document_id in case.forbidden_document_ids:
            if document_id not in dataset_all_documents(dataset):
                problems.append(f"{case.id}: forbidden document {document_id} does not exist")
        if case.kind == "ask" and not case.doctor_query:
            problems.append(f"{case.id}: ask case without a doctor_query")
        if case.kind == "summary" and not case.mock_summary and not case.expect_not_found:
            problems.append(f"{case.id}: summary case without mock_summary")
        if case.expect_not_found and case.expected_document_ids:
            problems.append(f"{case.id}: not-found case with expected documents")
    return problems


def dataset_all_documents(dataset: GoldenDataset) -> set[str]:
    return {
        document.document_id
        for patient in dataset.patients.values()
        for document in patient.documents
    }


# --------------------------------------------------------------------------- #
# case runs
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class RetrievedDoc:
    document_id: str
    relevance: float


@dataclass(frozen=True)
class CaseRun:
    """What one case actually produced (retrieval + optional generation)."""

    case: GoldenCase
    retrieved: tuple[RetrievedDoc, ...] = ()
    mode: str = "normal"
    answer: str | None = None
    source_ids: tuple[str, ...] = ()
    result_type: str | None = None
    summary_status: str | None = None
    section_keys: tuple[str, ...] = ()
    latency_ms: float = 0.0
    error: str | None = None
    #: Documents that belong to the case's own patient. Needed to tell a
    #: cross-patient leak (forbidden document from another patient) apart from
    #: a same-patient distractor (e.g. the 10 mg prescription for a 5 mg query).
    own_document_ids: tuple[str, ...] = ()


def distinct_documents(run: CaseRun, floor: float = 0.0, limit: int = TOP_K) -> list[str]:
    """Ordered distinct document ids among parents whose relevance passes ``floor``."""
    documents: list[str] = []
    for retrieved in run.retrieved:
        if floor > 0 and retrieved.relevance < floor:
            continue
        if retrieved.document_id in documents:
            continue
        documents.append(retrieved.document_id)
        if len(documents) >= limit:
            break
    return documents


# --------------------------------------------------------------------------- #
# metrics
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class EvalMetrics:
    cases: int
    recall_at_5: float
    precision: float
    mrr: float
    newest_hit_rate: float
    dose_top1: float
    not_found_correctness: float
    mode_accuracy: float
    isolation_leaks: int
    distractor_hits: int
    citation_accuracy: float
    grounding_pass_rate: float
    summary_ok_rate: float
    forbidden_content_hits: int
    latency_p50_ms: float
    latency_p95_ms: float


def _percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil(fraction * len(ordered)) - 1))
    return round(ordered[index], 2)


def _is_refusal(answer: str | None) -> bool:
    """True when the answer is the fixed "not enough information" message.

    Keeps ``grounding_pass_rate`` about grounding: a negative case that reaches
    the LLM and is refused there is grounded, even though the retrieval-layer
    short circuit (measured separately as ``not_found_correctness``) did not
    trigger.
    """
    text = (answer or "").casefold()
    return "not enough information" in text or "لا توجد معلومات كافية" in text


def evaluate_cases(runs: list[CaseRun], floor: float = 0.0) -> EvalMetrics:
    """Compute every metric at one relevance floor."""
    expected_total = 0
    hits_total = 0
    returned_total = 0
    reciprocal_ranks: list[float] = []
    newest: list[bool] = []
    dose: list[bool] = []
    not_found: list[bool] = []
    mode_checks: list[bool] = []
    citation_checks: list[bool] = []
    grounding: list[bool] = []
    summary_checks: list[bool] = []
    leaks = 0
    distractors = 0
    forbidden_hits = 0

    for run in runs:
        case = run.case
        documents = distinct_documents(run, floor)
        returned_total += len(documents)
        expected = set(case.expected_document_ids)
        forbidden = set(case.forbidden_document_ids)
        own = set(run.own_document_ids)

        touched = forbidden & (set(documents) | set(run.source_ids))
        if own:
            # A forbidden document from another patient is a real leak; a
            # forbidden document from the same patient is a distractor.
            leaks += 1 if (touched - own) else 0
            distractors += len(touched & own)
        else:
            leaks += 1 if touched else 0

        if case.kind == "summary":
            if case.expect_not_found:
                summary_checks.append(run.summary_status == "no_records")
            else:
                sections_ok = set(case.expected_sections) <= set(run.section_keys)
                sources_ok = not (forbidden & set(run.source_ids))
                summary_checks.append(sections_ok and sources_ok and run.summary_status == "ok")
            if run.answer:
                for needle in case.forbidden_content:
                    if needle and needle in run.answer:
                        forbidden_hits += 1
            continue

        # retrieval metrics ---------------------------------------------------
        if case.expect_not_found:
            not_found.append(len(documents) == 0)
        elif expected:
            expected_total += len(expected)
            found = expected & set(documents)
            hits_total += len(found)
            rank = next(
                (index for index, document in enumerate(documents, start=1) if document in expected),
                None,
            )
            reciprocal_ranks.append(1.0 / rank if rank else 0.0)
            if case.category == "latest_lab" or case.category == "latest_drug":
                newest.append(bool(documents) and documents[0] in expected)
            if case.category == "exact_dose":
                dose.append(bool(documents) and documents[0] in expected)

        if case.expected_mode:
            mode_checks.append(run.mode == case.expected_mode)

        # generation metrics --------------------------------------------------
        if case.expect_not_found:
            grounding.append(run.result_type == "not_found" or _is_refusal(run.answer))
        elif run.result_type is not None:
            grounding.append(run.result_type == "answered")
            cited = set(run.source_ids)
            citation_checks.append(
                cited <= set(documents) and bool(cited & expected)
            )

        if run.answer:
            for needle in case.forbidden_content:
                if needle and needle in run.answer:
                    forbidden_hits += 1

    recall = hits_total / expected_total if expected_total else 0.0
    precision = hits_total / returned_total if returned_total else 0.0
    latencies = [run.latency_ms for run in runs if run.latency_ms]

    return EvalMetrics(
        cases=len(runs),
        recall_at_5=round(recall, 4),
        precision=round(precision, 4),
        mrr=round(sum(reciprocal_ranks) / len(reciprocal_ranks), 4) if reciprocal_ranks else 0.0,
        newest_hit_rate=round(sum(newest) / len(newest), 4) if newest else 0.0,
        dose_top1=round(sum(dose) / len(dose), 4) if dose else 0.0,
        not_found_correctness=round(sum(not_found) / len(not_found), 4) if not_found else 0.0,
        mode_accuracy=round(sum(mode_checks) / len(mode_checks), 4) if mode_checks else 0.0,
        isolation_leaks=leaks,
        distractor_hits=distractors,
        citation_accuracy=round(sum(citation_checks) / len(citation_checks), 4) if citation_checks else 0.0,
        grounding_pass_rate=round(sum(grounding) / len(grounding), 4) if grounding else 0.0,
        summary_ok_rate=round(sum(summary_checks) / len(summary_checks), 4) if summary_checks else 0.0,
        forbidden_content_hits=forbidden_hits,
        latency_p50_ms=_percentile(latencies, 0.50),
        latency_p95_ms=_percentile(latencies, 0.95),
    )


def score_distribution(runs: list[CaseRun]) -> dict[str, Any]:
    """Dense-cosine distribution of expected vs. unexpected **documents**.

    Uses each document's best (max) parent cosine: a document's low-content
    preamble parent should not make the document look irrelevant. Per-parent
    scores are still what the gate sees, which is why the calibration table can
    drop a document even when its best parent scores well.
    """
    relevant: list[float] = []
    irrelevant: list[float] = []
    for run in runs:
        expected = set(run.case.expected_document_ids)
        if not expected:
            continue
        best: dict[str, float] = {}
        for retrieved in run.retrieved:
            previous = best.get(retrieved.document_id)
            if previous is None or retrieved.relevance > previous:
                best[retrieved.document_id] = retrieved.relevance
        for document_id, score in best.items():
            if document_id in expected:
                relevant.append(round(score, 4))
            else:
                irrelevant.append(round(score, 4))

    def summary(values: list[float]) -> dict[str, float]:
        if not values:
            return {"count": 0, "min": 0.0, "p50": 0.0, "max": 0.0}
        ordered = sorted(values)
        return {
            "count": len(ordered),
            "min": round(ordered[0], 4),
            "p50": round(ordered[len(ordered) // 2], 4),
            "max": round(ordered[-1], 4),
        }

    return {"relevant": summary(relevant), "irrelevant": summary(irrelevant)}


# --------------------------------------------------------------------------- #
# calibration
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class FloorPoint:
    floor: float
    recall_at_5: float
    precision: float
    not_found_correctness: float
    expected_documents_dropped: int


@dataclass(frozen=True)
class CalibrationResult:
    points: tuple[FloorPoint, ...]
    baseline: FloorPoint
    chosen_floor: float | None
    rationale: str


def _expected_dropped(runs: list[CaseRun], floor: float) -> int:
    dropped = 0
    for run in runs:
        expected = set(run.case.expected_document_ids)
        if not expected:
            continue
        kept = set(distinct_documents(run, floor))
        dropped += len(expected - kept)
    return dropped


def calibrate_floor(
    runs: list[CaseRun], floors: tuple[float, ...] = DEFAULT_FLOORS
) -> CalibrationResult:
    """Pick the highest floor that never costs expected documents.

    Selection rule (owner request: "improves precision without hurting recall"):
    keep only floors whose recall equals the un-gated baseline, then prefer the
    one with the best not-found correctness, then the best precision. If no
    floor improves anything, ``chosen_floor`` is ``None`` and the gate stays off.
    """
    points: list[FloorPoint] = []
    for floor in sorted(set(floors)):
        metrics = evaluate_cases(runs, floor)
        points.append(
            FloorPoint(
                floor=floor,
                recall_at_5=metrics.recall_at_5,
                precision=metrics.precision,
                not_found_correctness=metrics.not_found_correctness,
                expected_documents_dropped=_expected_dropped(runs, floor),
            )
        )
    baseline = points[0]
    recall_preserving = [point for point in points if point.recall_at_5 >= baseline.recall_at_5 - 1e-9]
    best = max(
        recall_preserving,
        key=lambda point: (point.not_found_correctness, point.precision, point.floor),
    )
    improved = (
        best.floor > 0
        and (
            best.not_found_correctness > baseline.not_found_correctness + 1e-9
            or best.precision > baseline.precision + 1e-9
        )
    )
    if not improved:
        return CalibrationResult(
            points=tuple(points),
            baseline=baseline,
            chosen_floor=None,
            rationale=(
                "No floor preserved recall while improving precision or not-found "
                "correctness; RELEVANCE_FLOOR stays 0.0 (gate off)."
            ),
        )
    return CalibrationResult(
        points=tuple(points),
        baseline=baseline,
        chosen_floor=best.floor,
        rationale=(
            f"Floor {best.floor} keeps recall at {best.recall_at_5} (baseline "
            f"{baseline.recall_at_5}) and raises precision {baseline.precision} -> "
            f"{best.precision} with not-found correctness {baseline.not_found_correctness} -> "
            f"{best.not_found_correctness}."
        ),
    )


# --------------------------------------------------------------------------- #
# report
# --------------------------------------------------------------------------- #
def metrics_table(metrics: EvalMetrics) -> list[tuple[str, str]]:
    return [
        ("cases", str(metrics.cases)),
        ("recall@5", f"{metrics.recall_at_5:.2%}"),
        ("precision", f"{metrics.precision:.2%}"),
        ("MRR", f"{metrics.mrr:.3f}"),
        ("newest hit rate", f"{metrics.newest_hit_rate:.2%}"),
        ("exact-dose top-1", f"{metrics.dose_top1:.2%}"),
        ("not-found correctness", f"{metrics.not_found_correctness:.2%}"),
        ("mode accuracy", f"{metrics.mode_accuracy:.2%}"),
        ("isolation leaks", str(metrics.isolation_leaks)),
        ("same-patient distractors", str(metrics.distractor_hits)),
        ("citation accuracy", f"{metrics.citation_accuracy:.2%}"),
        ("grounding pass rate", f"{metrics.grounding_pass_rate:.2%}"),
        ("summary ok rate", f"{metrics.summary_ok_rate:.2%}"),
        ("forbidden content hits", str(metrics.forbidden_content_hits)),
        ("latency p50 / p95 (ms)", f"{metrics.latency_p50_ms} / {metrics.latency_p95_ms}"),
    ]


def derive_findings(metrics: EvalMetrics, calibration: CalibrationResult) -> list[str]:
    """Turn the numbers into explicit findings (the report must not hide gaps)."""
    findings: list[str] = []
    if metrics.dose_top1 < 0.95:
        findings.append(
            f"Exact-dose top-1 is {metrics.dose_top1:.0%} (target 95%): in `normal` mode the "
            "selected parents are re-sorted by doc_date, so the newest prescription outranks the "
            "exact-dose match. Recommendation: keep score order in `normal` mode (behaviour change, "
            "needs owner approval)."
        )
    if metrics.not_found_correctness < 0.9:
        findings.append(
            f"Not-found correctness is {metrics.not_found_correctness:.0%} at the evaluated floor: "
            "irrelevant parents reach the LLM for absent facts. The prompt's rule 1 is the only "
            "guard unless a gate is enabled."
        )
    if calibration.chosen_floor is None:
        findings.append(
            "No single dense-cosine floor separates relevant from irrelevant parents without "
            "dropping expected documents; the relevant/irrelevant distributions overlap. "
            "RELEVANCE_FLOOR stays 0.0."
        )
    if metrics.grounding_pass_rate < 1.0:
        findings.append(
            f"Grounding pass rate is {metrics.grounding_pass_rate:.0%}: the verifier's drug-token "
            "check is monolingual, so a correct English answer derived from an Arabic document is "
            "rejected (false positive). Recommendation: bilingual term aliases or a language-aware "
            "check (Phase 9)."
        )
    if metrics.recall_at_5 < 1.0:
        findings.append(
            f"Recall@5 is {metrics.recall_at_5:.0%}: expected documents were not retrieved."
        )
    if metrics.isolation_leaks:
        findings.append(
            f"ISOLATION LEAKS: {metrics.isolation_leaks} - blocking, must be zero."
        )
    return findings


def format_report(
    *,
    dataset: GoldenDataset,
    metrics: EvalMetrics,
    calibration: CalibrationResult,
    distribution: dict[str, Any],
    meta: dict[str, Any],
    failures: list[str],
    findings: list[str] | None = None,
) -> str:
    lines = ["# CareOS RAG - Golden Set Evaluation", ""]
    lines.append(f"- dataset: v{dataset.version}, {len(dataset.cases)} cases, "
                 f"{len(dataset.patients)} patients")
    lines.append(f"- clock: {dataset.clock}")
    lines.append(f"- mode: {meta.get('mode', 'offline')}")
    for key in ("git_commit", "dense_model", "sparse_model", "wide_k", "final_parents",
                "recency_weight", "recency_decay_days", "relevance_floor"):
        if key in meta:
            lines.append(f"- {key}: {meta[key]}")
    lines.append("")
    lines.append("## Metrics")
    lines.append("")
    lines.append("| metric | value |")
    lines.append("| --- | --- |")
    for name, value in metrics_table(metrics):
        lines.append(f"| {name} | {value} |")
    lines.append("")
    lines.append("## Score distribution (dense cosine, distinct documents)")
    lines.append("")
    lines.append("| group | count | min | p50 | max |")
    lines.append("| --- | --- | --- | --- | --- |")
    for group in ("relevant", "irrelevant"):
        stats = distribution[group]
        lines.append(
            f"| {group} | {stats['count']} | {stats['min']} | {stats['p50']} | {stats['max']} |"
        )
    lines.append("")
    lines.append("## RELEVANCE_FLOOR calibration")
    lines.append("")
    lines.append("| floor | recall@5 | precision | not-found | expected dropped |")
    lines.append("| --- | --- | --- | --- | --- |")
    for point in calibration.points:
        marker = " **<=**" if calibration.chosen_floor == point.floor else ""
        lines.append(
            f"| {point.floor} | {point.recall_at_5:.2%} | {point.precision:.2%} | "
            f"{point.not_found_correctness:.2%} | {point.expected_documents_dropped}{marker} |"
        )
    lines.append("")
    lines.append(f"**Decision:** {calibration.rationale}")
    lines.append("")
    if findings:
        lines.append("## Findings and recommendations")
        lines.append("")
        for finding in findings:
            lines.append(f"- {finding}")
        lines.append("")
    if failures:
        lines.append("## Cases needing attention")
        lines.append("")
        for failure in failures:
            lines.append(f"- {failure}")
        lines.append("")
    lines.append("## Notes")
    lines.append("")
    lines.append("- The dataset is **synthetic** and has not been reviewed by a doctor yet "
                 "(plan O13); these numbers are not clinical validation.")
    lines.append("- Generation is evaluated with scripted answers unless `--live` is used; "
                 "`--live` needs a working provider and is reported separately.")
    return "\n".join(lines) + "\n"
