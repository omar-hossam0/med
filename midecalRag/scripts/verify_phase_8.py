"""Phase 8 verification: golden set, metrics harness, floor calibration.

Run from the repository root:

    env/Scripts/python.exe scripts/verify_phase_8.py

The harness is exercised on a **small built-in sample** (a filtered subset of
the golden set) so the checks stay fast, then the full set is evaluated once to
produce the deliverable report. Every evaluation runs in a subprocess with its
own collection, because ``WIDE_K`` is read once per process.

All patients are fictional. Settings values and secrets are never printed.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover
    pass

DATASET = REPO_ROOT / "data" / "eval" / "golden_dataset.json"
RUNNER = REPO_ROOT / "scripts" / "evaluate_rag.py"
_TMP = Path(tempfile.mkdtemp(prefix="careos_phase8_"))

RESULTS: list[tuple[str, str, str]] = []

SAMPLE_CASES = (
    "renal_latest_lab_en",
    "renal_exact_dose_5mg",
    "renal_not_found_hba1c_en",
    "cardiac_latest_drug_en",
    "twin_a_isolation",
    "empty_patient_en",
)


def record(name: str, ok: bool, detail: str = "") -> None:
    status = "PASS" if ok else "FAIL"
    RESULTS.append((name, status, detail))
    suffix = f" -- {detail}" if (detail and not ok) else ""
    print(f"{status}: {name}{suffix}")


def info(message: str) -> None:
    print(f"INFO: {message}")


def section(title: str) -> None:
    print()
    print(f"=== {title} ===")


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def build_sample(path: Path) -> Path:
    payload = json.loads(DATASET.read_text(encoding="utf-8"))
    cases = [case for case in payload["cases"] if case["id"] in SAMPLE_CASES]
    owners = {
        document["document_id"]: patient_id
        for patient_id, patient in payload["patients"].items()
        for document in patient["documents"]
    }
    # A forbidden document must exist in the sample for the isolation check to
    # be meaningful, so its owning patient comes along too.
    patients = {case["patient_id"] for case in cases}
    for case in cases:
        for document_id in case.get("forbidden_document_ids") or ():
            owner = owners.get(document_id)
            if owner:
                patients.add(owner)
    sample = {
        "version": payload["version"],
        "clock": payload["clock"],
        "description": "Built-in Phase 8 verification sample (synthetic)",
        "patients": {patient: payload["patients"][patient] for patient in sorted(patients)},
        "cases": cases,
    }
    path.write_text(json.dumps(sample, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def run_eval(dataset: Path, collection: str, report_dir: Path, *extra: str) -> dict:
    command = [
        sys.executable,
        str(RUNNER),
        "--dataset",
        str(dataset),
        "--collection",
        collection,
        "--report-dir",
        str(report_dir),
        "--quiet",
        *extra,
    ]
    started = time.perf_counter()
    completed = subprocess.run(
        command, cwd=REPO_ROOT, capture_output=True, text=True, timeout=1800
    )
    elapsed = round(time.perf_counter() - started, 1)
    if completed.returncode != 0:
        info(completed.stdout[-1500:])
        info(completed.stderr[-1500:])
        raise RuntimeError(f"evaluate_rag exited {completed.returncode}")
    reports = sorted(report_dir.glob("report-*.json"), key=lambda p: p.stat().st_mtime)
    if not reports:
        raise RuntimeError("no report written")
    payload = json.loads(reports[-1].read_text(encoding="utf-8"))
    payload["_elapsed_seconds"] = elapsed
    payload["_markdown"] = reports[-1].with_suffix(".md")
    return payload


# ---------------------------------------------------------------------------
# checks
# ---------------------------------------------------------------------------

def check_dataset() -> None:
    section("1. Golden dataset integrity")
    from app.services.evaluation import dataset_all_documents, load_dataset, validate_dataset

    dataset = load_dataset(DATASET)
    problems = validate_dataset(dataset)
    record("dataset: schema validates with zero problems", not problems, "; ".join(problems[:3]))
    record(
        "dataset: synthetic status recorded",
        "SYNTHETIC" in dataset.description.upper() and "PENDING" in dataset.description.upper(),
    )

    categories: dict[str, int] = {}
    languages: dict[str, int] = {}
    for case in dataset.cases:
        categories[case.category] = categories.get(case.category, 0) + 1
        languages[case.language] = languages.get(case.language, 0) + 1
    info(f"cases={len(dataset.cases)} patients={len(dataset.patients)} "
         f"documents={len(dataset_all_documents(dataset))}")
    info(f"categories: {dict(sorted(categories.items()))}")
    info(f"languages: {languages}")

    required = {
        "latest_lab", "latest_drug", "exact_dose", "trend", "conflict", "session_report",
        "medical_report", "follow_up", "negative", "isolation", "filter", "arabic",
        "cross_language", "ambiguous_arabic", "summary",
    }
    record(
        "dataset: every required category is covered",
        required <= set(categories),
        str(sorted(required - set(categories))),
    )
    record("dataset: Arabic and English queries present", {"ar", "en"} <= set(languages))
    record(
        "dataset: multi-visit trend and conflict cases present",
        categories.get("trend", 0) >= 2 and categories.get("conflict", 0) >= 1,
    )
    record(
        "dataset: negative cases present",
        categories.get("negative", 0) >= 4,
        str(categories.get("negative", 0)),
    )
    record(
        "dataset: cross-patient traps present",
        categories.get("isolation", 0) >= 3,
        str(categories.get("isolation", 0)),
    )
    record("dataset: summary scenarios present", categories.get("summary", 0) >= 3)
    info(
        f"NOTE: {len(dataset.cases)} synthetic cases; the plan asks for 50-100 "
        "doctor-reviewed cases (O13) - review is still pending"
    )


def check_harness(sample: Path, report_dir: Path) -> dict:
    section("2. Harness runs end to end on the built-in sample")
    payload = run_eval(sample, "careos_phase8_sample_a", report_dir)
    metrics = payload["metrics"]
    record("harness: run completed and wrote a report", bool(metrics), "no metrics")
    record(
        "harness: report has metrics, calibration and findings",
        bool(payload.get("calibration", {}).get("points")) and "findings" in payload,
    )
    record(
        "harness: sample cases all executed",
        metrics["cases"] == len(SAMPLE_CASES),
        f"{metrics['cases']} != {len(SAMPLE_CASES)}",
    )
    info(
        f"sample: recall@5={metrics['recall_at_5']:.2%} newest={metrics['newest_hit_rate']:.2%} "
        f"dose_top1={metrics['dose_top1']:.2%} not_found={metrics['not_found_correctness']:.2%} "
        f"leaks={metrics['isolation_leaks']} ({payload['_elapsed_seconds']}s)"
    )
    return payload


def check_determinism(sample: Path, report_dir: Path, baseline: dict) -> None:
    section("3. Determinism (same configuration -> same metrics)")
    repeat = run_eval(sample, "careos_phase8_sample_b", report_dir)
    keys = ("cases", "recall_at_5", "precision", "mrr", "newest_hit_rate", "dose_top1",
            "not_found_correctness", "isolation_leaks", "citation_accuracy")
    differences = [
        key for key in keys if baseline["metrics"].get(key) != repeat["metrics"].get(key)
    ]
    record("determinism: retrieval metrics identical on a second run", not differences, str(differences))
    record(
        "determinism: calibration points identical",
        baseline["calibration"]["points"] == repeat["calibration"]["points"],
    )


def check_sensitivity(sample: Path, report_dir: Path, baseline: dict) -> None:
    section("4. Sensitivity (a degraded configuration must lower a metric)")
    degraded = run_eval(sample, "careos_phase8_sample_c", report_dir, "--wide-k", "5")
    before = baseline["metrics"]
    after = degraded["metrics"]
    info(
        f"wide_k=5: recall@5 {before['recall_at_5']:.2%} -> {after['recall_at_5']:.2%}, "
        f"newest {before['newest_hit_rate']:.2%} -> {after['newest_hit_rate']:.2%}"
    )
    record(
        "sensitivity: WIDE_K=5 lowers recall or newest-hit (recency trap reproduced)",
        after["recall_at_5"] < before["recall_at_5"]
        or after["newest_hit_rate"] < before["newest_hit_rate"],
        "metrics unchanged - the harness is not sensitive to over-fetch",
    )


def check_isolation_detector() -> None:
    section("5. Isolation detector catches a planted leak")
    from app.services.evaluation import (
        CaseRun,
        GoldenCase,
        RetrievedDoc,
        evaluate_cases,
    )

    case = GoldenCase(
        id="planted",
        category="isolation",
        language="en",
        patient_id="pa",
        doctor_query="creatinine",
        expected_document_ids=("a1",),
        forbidden_document_ids=("b1",),
    )
    clean = CaseRun(
        case=case,
        retrieved=(RetrievedDoc("a1", 0.9),),
        own_document_ids=("a1",),
        result_type="answered",
    )
    leaky = CaseRun(
        case=case,
        retrieved=(RetrievedDoc("a1", 0.9), RetrievedDoc("b1", 0.8)),
        own_document_ids=("a1",),
        result_type="answered",
    )
    record("isolation: clean run reports zero leaks", evaluate_cases([clean]).isolation_leaks == 0)
    record("isolation: planted cross-patient document is detected", evaluate_cases([leaky]).isolation_leaks == 1)

    same_patient_case = GoldenCase(
        id="distractor",
        category="exact_dose",
        language="en",
        patient_id="pa",
        doctor_query="Amlodipine 5mg",
        expected_document_ids=("a1",),
        forbidden_document_ids=("a2",),
    )
    distractor = CaseRun(
        case=same_patient_case,
        retrieved=(RetrievedDoc("a1", 0.9), RetrievedDoc("a2", 0.8)),
        own_document_ids=("a1", "a2"),
    )
    metrics = evaluate_cases([distractor])
    record(
        "isolation: same-patient distractor is not counted as a leak",
        metrics.isolation_leaks == 0 and metrics.distractor_hits == 1,
        f"leaks={metrics.isolation_leaks} distractors={metrics.distractor_hits}",
    )


def check_calibration_rule() -> None:
    section("6. Calibration rule (pure)")
    from app.services.evaluation import (
        CaseRun,
        GoldenCase,
        RetrievedDoc,
        calibrate_floor,
    )

    good = GoldenCase(
        id="good", category="latest_lab", language="en", patient_id="p", doctor_query="q",
        expected_document_ids=("d1",),
    )
    negative = GoldenCase(
        id="neg", category="negative", language="en", patient_id="p", doctor_query="q",
        expect_not_found=True,
    )
    runs = [
        CaseRun(case=good, retrieved=(RetrievedDoc("d1", 0.9), RetrievedDoc("noise", 0.2))),
        CaseRun(case=negative, retrieved=(RetrievedDoc("noise2", 0.3),)),
    ]
    result = calibrate_floor(runs)
    record(
        "calibration: a floor that keeps recall and removes noise is chosen",
        result.chosen_floor is not None and result.chosen_floor >= 0.35,
        str(result.chosen_floor),
    )
    record(
        "calibration: rationale explains the choice",
        "recall" in result.rationale.lower(),
        result.rationale,
    )

    weak = GoldenCase(
        id="weak", category="latest_lab", language="en", patient_id="p", doctor_query="q",
        expected_document_ids=("weak",),
    )
    refused = calibrate_floor([CaseRun(case=weak, retrieved=(RetrievedDoc("weak", 0.3),))])
    record(
        "calibration: a floor that would drop an expected document is refused",
        refused.chosen_floor is None,
        str(refused.chosen_floor),
    )


def check_full_run(report_dir: Path) -> None:
    section("7. Full golden-set run (deliverable report)")
    payload = run_eval(DATASET, "careos_phase8_full", report_dir)
    metrics = payload["metrics"]
    calibration = payload["calibration"]
    markdown = Path(payload["_markdown"])

    for name in (
        "cases", "recall_at_5", "precision", "mrr", "newest_hit_rate", "dose_top1",
        "not_found_correctness", "isolation_leaks", "citation_accuracy",
        "grounding_pass_rate", "summary_ok_rate",
    ):
        info(f"  {name:24s} {metrics.get(name)}")

    record("full: every case executed", metrics["cases"] == 35, str(metrics["cases"]))
    record("full: zero isolation leaks", metrics["isolation_leaks"] == 0, str(metrics["isolation_leaks"]))
    record(
        "full: recall@5 meets the plan target (>= 90%)",
        metrics["recall_at_5"] >= 0.9,
        f"{metrics['recall_at_5']:.2%}",
    )
    record(
        "full: newest-record hit rate meets the plan target (>= 95%)",
        metrics["newest_hit_rate"] >= 0.95,
        f"{metrics['newest_hit_rate']:.2%}",
    )
    record(
        "full: mode selection is correct on every annotated case",
        metrics["mode_accuracy"] == 1.0,
        f"{metrics['mode_accuracy']:.2%}",
    )
    record("full: no forbidden clinical content leaked into an answer", metrics["forbidden_content_hits"] == 0)

    record(
        "full: calibration table has a point per floor",
        len(calibration["points"]) >= 10,
        str(len(calibration["points"])),
    )
    floors = [point["floor"] for point in calibration["points"]]
    recalls = [point["recall_at_5"] for point in calibration["points"]]
    record("full: calibration floors are ordered", floors == sorted(floors))
    record(
        "full: recall never increases as the floor rises",
        all(recalls[i] >= recalls[i + 1] - 1e-9 for i in range(len(recalls) - 1)),
    )
    decision = calibration["chosen_floor"]
    record(
        "full: decision matches the recorded rationale",
        (decision is None) == ("stays 0.0" in calibration["rationale"]),
        f"chosen={decision}",
    )
    info(f"DECISION: {calibration['rationale']}")

    text = markdown.read_text(encoding="utf-8")
    record("full: markdown report written with the metric table", "## Metrics" in text)
    record("full: report carries the synthetic-data disclaimer", "synthetic" in text.lower())
    record("full: report lists findings", "## Findings and recommendations" in text)
    info(f"report: {markdown}")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def main() -> int:
    print("CareOS Medical RAG - Phase 8 verification")
    print(f"python: {sys.version.split()[0]}  repo: {REPO_ROOT}")
    print(f"dataset: {DATASET}")
    print(f"temp dir: {_TMP}")

    sample = build_sample(_TMP / "sample.json")
    sample_reports = _TMP / "reports-sample"
    sample_reports.mkdir(parents=True, exist_ok=True)
    full_reports = REPO_ROOT / "eval" / "reports"
    started = time.perf_counter()
    try:
        check_dataset()
        baseline = check_harness(sample, sample_reports)
        check_determinism(sample, sample_reports, baseline)
        check_sensitivity(sample, sample_reports, baseline)
        check_isolation_detector()
        check_calibration_rule()
        check_full_run(full_reports)
    finally:
        shutil.rmtree(_TMP, ignore_errors=True)

    passes = sum(1 for _, status, _ in RESULTS if status == "PASS")
    warns = sum(1 for _, status, _ in RESULTS if status == "WARN")
    fails = sum(1 for _, status, _ in RESULTS if status == "FAIL")
    print()
    print("---- result table ----")
    for name, status, detail in RESULTS:
        line = f"{status:8s} {name}"
        if detail and status in ("FAIL", "WARN"):
            line += f"  [{detail}]"
        print(line)
    print("----------------------")
    print(f"PHASE 8 VERIFICATION: {passes} PASS, {warns} WARN, {fails} FAIL "
          f"({round(time.perf_counter() - started, 1)}s)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
