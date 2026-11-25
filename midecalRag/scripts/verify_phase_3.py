"""Phase 3 verification: normalizer, parent/child chunkers, context injection.

Run from the repository root:

    env/Scripts/python.exe scripts/verify_phase_3.py

Pure offline: no Qdrant, no embeddings, no LLM. All data is fictional.
"""

from __future__ import annotations

import logging
import os
import random
import re
import sys
from contextlib import contextmanager
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Offline verification: dummy values so Settings can be built without .env.
os.environ.setdefault("RAG_API_KEY", "phase3-verify")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("OPENROUTER_API_KEY", "phase3-verify")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover
    pass

RESULTS: list[tuple[str, str, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    status = "PASS" if ok else "FAIL"
    RESULTS.append((name, status, detail))
    suffix = f" -- {detail}" if (detail and not ok) else ""
    print(f"{status}: {name}{suffix}")


def section(title: str) -> None:
    print()
    print(f"=== {title} ===")


@contextmanager
def capture_logs():
    records: list[logging.LogRecord] = []

    class Cap(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            records.append(record)

    handler = Cap(level=logging.DEBUG)
    root = logging.getLogger()
    root.addHandler(handler)
    try:
        yield records
    finally:
        root.removeHandler(handler)


from app.config import get_settings  # noqa: E402
from app.schemas.contract import IngestRequest  # noqa: E402
from app.services.chunking import chunk_document  # noqa: E402
from app.services.chunking.base import inject_context, make_parent_id  # noqa: E402
from app.services.normalizer import normalize  # noqa: E402

SETTINGS = get_settings()

LAB_LINES = [
    "Al-Borg Lab",
    "Date: 15/10/2026",
    "Renal Function:",
    "Creatinine: 1.8 mg/dL (0.6 - 1.2)",
    "Urea: 65 mg/dL (15 - 45)",
]


def _ocr_request(
    doc_type: str,
    lines: list[str],
    document_id: str = "doc",
    raw_text: str | None = None,
) -> IngestRequest:
    return IngestRequest.model_validate(
        {
            "patient_id": "p1",
            "document_id": document_id,
            "uploaded_at": "2026-10-24T10:30:00Z",
            "user_selected_type": doc_type,
            "ocr_output": {
                "raw_text": raw_text if raw_text is not None else "\n".join(lines),
                "lines": lines,
            },
        }
    )


def _session_request(data: dict, document_id: str = "doc") -> IngestRequest:
    payload = {
        "patient_id": "p1",
        "document_id": document_id,
        "uploaded_at": "2026-10-24T11:05:00Z",
        "user_selected_type": "session_report",
        "session_report_data": data,
    }
    return IngestRequest.model_validate(payload)


def _group(children) -> dict[str, list]:
    grouped: dict[str, list] = {}
    for child in children:
        grouped.setdefault(child.parent_id, []).append(child)
    return grouped


def _texts(children) -> list[str]:
    return [child.child_text for child in children]


# ---------------------------------------------------------------------------
# 1. Primary lab fixture: exact structure from the plan
# ---------------------------------------------------------------------------


def check_lab_fixture() -> None:
    section("1. Primary lab fixture (plan Section E table)")
    children = chunk_document(_ocr_request("lab_result", LAB_LINES), "lab_result", "2026-10-15")
    grouped = _group(children)
    record(
        "exactly 4 children in 2 parents (p0 preamble, p1 panel)",
        len(children) == 4
        and list(grouped) == ["doc#p0", "doc#p1"]
        and [len(grouped[key]) for key in grouped] == [2, 2],
        f"children={len(children)}, parents={[(k, len(v)) for k, v in grouped.items()]}",
    )
    p0, p1 = grouped["doc#p0"], grouped["doc#p1"]
    record(
        "parent_text p0 is the preamble",
        p0[0].parent_text == "Al-Borg Lab\nDate: 15/10/2026",
        repr(p0[0].parent_text),
    )
    record(
        "parent_text p1 is heading + both tests",
        p1[0].parent_text
        == "Renal Function:\nCreatinine: 1.8 mg/dL (0.6 - 1.2)\nUrea: 65 mg/dL (15 - 45)",
        repr(p1[0].parent_text),
    )
    expected = [
        "[lab_result | 2026-10-15] Al-Borg Lab",
        "[lab_result | 2026-10-15] Date: 15/10/2026",
        "[lab_result | 2026-10-15] Creatinine: 1.8 mg/dL (0.6 - 1.2)",
        "[lab_result | 2026-10-15] Urea: 65 mg/dL (15 - 45)",
    ]
    record("child_text values match the plan table exactly", _texts(children) == expected, repr(_texts(children)))
    record(
        "Creatinine raw_snippet is the original line",
        p1[0].raw_snippet == "Creatinine: 1.8 mg/dL (0.6 - 1.2)",
        repr(p1[0].raw_snippet),
    )
    test_children = p1
    regex = re.compile(r"^\[lab_result \| 2026-10-15\] [A-Za-z][^:]*: \d.*mg/dL.*\(\d.*-.*\d.*\)$")
    record(
        "each test child keeps name + value + unit + range",
        all(regex.match(child.child_text) for child in test_children),
        repr(_texts(test_children)),
    )


# ---------------------------------------------------------------------------
# 2. Wrapped line, prescriptions, reports, radiology
# ---------------------------------------------------------------------------


def check_other_doc_types() -> None:
    section("2. Wrapped lines, prescriptions, reports, radiology")

    wrapped = chunk_document(
        _ocr_request("lab_result", ["Renal Function:", "Creatinine", "1.8 mg/dL (0.6 - 1.2)"]),
        "lab_result",
        "2026-10-15",
    )
    record(
        "wrapped name/value lines join into one child",
        len(wrapped) == 1
        and wrapped[0].child_text
        == "[lab_result | 2026-10-15] Creatinine 1.8 mg/dL (0.6 - 1.2)"
        and wrapped[0].raw_snippet == "Creatinine\n1.8 mg/dL (0.6 - 1.2)",
        repr(_texts(wrapped)),
    )

    rx_lines = [
        "Paracetamol",
        "500 mg",
        "One tablet every 8 hours as needed",
        "Amlodipine",
        "5mg",
    ]
    rx = chunk_document(_ocr_request("prescription", rx_lines), "prescription", "2026-10-15")
    record(
        "prescription: one child per drug, dose kept with the name",
        len(rx) == 3
        and _texts(rx)
        == [
            "[prescription | 2026-10-15] Paracetamol 500 mg",
            "[prescription | 2026-10-15] One tablet every 8 hours as needed",
            "[prescription | 2026-10-15] Amlodipine 5 mg",
        ],
        repr(_texts(rx)),
    )
    record(
        "prescription: one parent contains all drugs",
        len({child.parent_id for child in rx}) == 1
        and "Paracetamol" in rx[0].parent_text
        and "Amlodipine" in rx[0].parent_text,
        rx[0].parent_text,
    )

    report = chunk_document(
        _ocr_request(
            "medical_report",
            ["Findings:", "The lungs are clear.", "Impression:", "No acute disease."],
        ),
        "medical_report",
        "2026-10-15",
    )
    grouped = _group(report)
    record(
        "medical report: section parents, paragraph children, headings kept",
        len(report) == 2
        and len(grouped) == 2
        and all(":" in child.parent_text.split("\n")[0] for child in report)
        and _texts(report)
        == [
            "[medical_report | 2026-10-15] The lungs are clear.",
            "[medical_report | 2026-10-15] No acute disease.",
        ],
        repr([(k, len(v)) for k, v in grouped.items()]),
    )

    radiology = chunk_document(
        _ocr_request("radiology", ["Findings:", "No fracture seen."]),
        "radiology",
        "2026-10-15",
    )
    record(
        "radiology uses the report chunker and its own prefix",
        len(radiology) == 1
        and radiology[0].child_text == "[radiology | 2026-10-15] No fracture seen.",
        repr(_texts(radiology)),
    )


# ---------------------------------------------------------------------------
# 3. Session reports
# ---------------------------------------------------------------------------

SESSION_DATA = {
    "chief_complaint": "Headache and dizziness for one week.",
    "history_of_present_illness": "Known hypertensive on treatment.",
    "assessment_and_diagnosis": "Hypertension, stage 1.",
    "treatment_plan": "Start Amlodipine 5 mg once daily. Follow-up in 4 weeks.",
    "consultation_date": "2026-10-24",
}


def check_session_structured() -> None:
    section("3. Session report: structured fields")
    children = chunk_document(
        _session_request(SESSION_DATA), "session_report", "2026-10-24"
    )
    record(
        "exactly 4 children, one parent per document",
        len(children) == 4 and len({child.parent_id for child in children}) == 1,
        f"children={len(children)}",
    )
    expected = [
        "[session_report | 2026-10-24 | Section: Chief Complaint] Headache and dizziness for one week.",
        "[session_report | 2026-10-24 | Section: History of Present Illness] Known hypertensive on treatment.",
        "[session_report | 2026-10-24 | Section: Diagnosis] Hypertension, stage 1.",
        "[session_report | 2026-10-24 | Section: Treatment Plan] Start Amlodipine 5 mg once daily. Follow-up in 4 weeks.",
    ]
    record("session child_text values match the plan", _texts(children) == expected, repr(_texts(children)))
    parent_text = children[0].parent_text
    record(
        "one parent_text contains all four sections",
        children[0].parent_id == "doc#p0"
        and all(value in parent_text for value in SESSION_DATA.values() if value != "2026-10-24"),
        parent_text,
    )
    record(
        "session raw_snippet is unchanged (dose stays with drug name)",
        children[3].raw_snippet == SESSION_DATA["treatment_plan"],
        repr(children[3].raw_snippet),
    )


def check_session_text_and_edge_cases() -> None:
    section("4. Session report: full text, fallbacks, long sections")

    full_text = "Chief Complaint:\nHeadache\nDiagnosis:\nHypertension, stage 1."
    text_children = chunk_document(
        _session_request({"full_report_text": full_text}), "session_report", "2026-10-24"
    )
    record(
        "full_report_text headings become sections",
        _texts(text_children)
        == [
            "[session_report | 2026-10-24 | Section: Chief Complaint] Headache",
            "[session_report | 2026-10-24 | Section: Diagnosis] Hypertension, stage 1.",
        ],
        repr(_texts(text_children)),
    )

    plain = chunk_document(
        _session_request({"full_report_text": "A free paragraph with no headings."}),
        "session_report",
        "2026-10-24",
    )
    record(
        "no headings -> one General child",
        len(plain) == 1
        and plain[0].child_text
        == "[session_report | 2026-10-24 | Section: General] A free paragraph with no headings.",
        repr(_texts(plain)),
    )

    long_section = "word " * 400
    long_children = chunk_document(
        _session_request({"treatment_plan": long_section}), "session_report", "2026-10-24"
    )
    labels = {
        child.child_text.split("]")[0] for child in long_children
    }
    record(
        "long section is split but keeps the same label",
        len(long_children) > 1
        and labels == {"[session_report | 2026-10-24 | Section: Treatment Plan"}
        and all(len(child.child_text) <= SETTINGS.child_max_chars for child in long_children),
        f"children={len(long_children)}, max={max(len(c.child_text) for c in long_children)}",
    )

    missing = dict(SESSION_DATA)
    missing.pop("treatment_plan")
    missing_children = chunk_document(
        _session_request(missing), "session_report", "2026-10-24"
    )
    record(
        "missing section produces no empty child",
        len(missing_children) == 3
        and all(child.child_text.strip() and child.raw_snippet.strip() for child in missing_children),
        f"children={len(missing_children)}",
    )

    both = dict(SESSION_DATA)
    both["full_report_text"] = "A completely different report body."
    with capture_logs() as captured:
        both_children = chunk_document(
            _session_request(both), "session_report", "2026-10-24"
        )
    mismatch = any("session_sections_mismatch" in r.getMessage() for r in captured)
    record(
        "both sources: sections for children, full text for parent, mismatch warning",
        both_children[0].parent_text == "A completely different report body."
        and len(both_children) == 4
        and mismatch,
        f"parent={both_children[0].parent_text!r}, mismatch={mismatch}",
    )

    extra = dict(SESSION_DATA)
    extra["follow_up"] = "Return in 4 weeks."
    extra_children = chunk_document(
        _session_request(extra), "session_report", "2026-10-24"
    )
    record(
        "extra section uses a title-cased label",
        extra_children[-1].child_text
        == "[session_report | 2026-10-24 | Section: Follow Up] Return in 4 weeks.",
        repr(extra_children[-1].child_text),
    )


# ---------------------------------------------------------------------------
# 5. Prefixes, ids, normalization, limits, robustness
# ---------------------------------------------------------------------------


def check_prefix_ids_normalization() -> None:
    section("5. Prefixes, parent ids, normalization, size limits")

    record(
        "inject_context normal prefix is exact",
        inject_context("lab_result", "2026-10-15", "Creatinine 1.8")
        == "[lab_result | 2026-10-15] Creatinine 1.8",
    )
    record(
        "inject_context session prefix is exact",
        inject_context("session_report", "2026-10-24", "Headache", "Chief Complaint")
        == "[session_report | 2026-10-24 | Section: Chief Complaint] Headache",
    )
    record("make_parent_id format", make_parent_id("doc", 3) == "doc#p3")

    arabic = chunk_document(
        _ocr_request(
            "lab_result",
            ["Renal Function:", "Creatinine: ١٢.٥ mg/dL (0.6 - 1.2)", "Urea: 5mg"],
        ),
        "lab_result",
        "2026-10-15",
    )
    record(
        "Arabic-Indic digits and 5mg are normalized in child_text",
        any("Creatinine: 12.5 mg/dL" in child.child_text for child in arabic)
        and any("Urea: 5 mg" in child.child_text for child in arabic),
        repr(_texts(arabic)),
    )
    record(
        "raw_snippet keeps the original Arabic digits / 5mg",
        any(child.raw_snippet == "Creatinine: ١٢.٥ mg/dL (0.6 - 1.2)" for child in arabic)
        and any(child.raw_snippet == "Urea: 5mg" for child in arabic),
        repr([c.raw_snippet for c in arabic]),
    )
    record(
        "normalize handles digits, units and whitespace",
        normalize("  Creatinine   ١٢.٥mg/dL  ") == "Creatinine 12.5 mg/dL",
        repr(normalize("  Creatinine   ١٢.٥mg/dL  ")),
    )

    long_line = "word " * 500
    long_children = chunk_document(
        _ocr_request("medical_report", [long_line]), "medical_report", "2026-10-15"
    )
    record(
        "no child exceeds child_max_chars",
        long_children
        and all(len(child.child_text) <= SETTINGS.child_max_chars for child in long_children),
        f"max={max((len(c.child_text) for c in long_children), default=0)}",
    )


def check_robustness_and_fallback() -> None:
    section("6. Empty input, random text, column-OCR warning, fallbacks")

    empty = chunk_document(
        _ocr_request("lab_result", ["   ", ""], raw_text="ignored"),
        "lab_result",
        "2026-10-15",
    )
    record("all-empty lines -> no children, no crash", empty == [], repr(empty))

    raw_only = chunk_document(
        _ocr_request("lab_result", [], raw_text="Renal Function:\nCreatinine: 1.8 mg/dL"),
        "lab_result",
        "2026-10-15",
    )
    record(
        "empty lines falls back to raw_text.split lines",
        len(raw_only) == 1
        and raw_only[0].raw_snippet == "Creatinine: 1.8 mg/dL",
        repr(_texts(raw_only)),
    )

    rng = random.Random(20261024)
    alphabet = "abcXYZ 0123456789.:-()/%\n\t" + "ابتثجحخدذرزسشصضطظعغفقكلمنهوي١٢٣"
    random_ok = True
    detail = ""
    for _ in range(60):
        text = "".join(rng.choice(alphabet) for _ in range(rng.randint(1, 400)))
        if not text.strip():
            text = "x"
        try:
            children = chunk_document(
                _ocr_request("lab_result", text.split("\n"), raw_text=text),
                "lab_result",
                "2026-10-15",
            )
            if any(not child.child_text.strip() or not child.raw_snippet.strip() for child in children):
                random_ok = False
                detail = "empty child"
                break
        except Exception as exc:  # noqa: BLE001
            random_ok = False
            detail = type(exc).__name__
            break
    record("random text never crashes and never yields an empty child", random_ok, detail)

    ocr_lines = ["Creatinine", "Urea", "1.8", "65", "0.6 - 1.2", "15 - 45"]
    with capture_logs() as captured:
        chunk_document(_ocr_request("lab_result", ocr_lines), "lab_result", "2026-10-15")
    column = [r for r in captured if "column_ocr_symptom" in r.getMessage()]
    record(
        "column-by-column OCR symptom logs a warning with counts only",
        bool(column)
        and "numeric_only=" in column[0].getMessage()
        and "name_only=" in column[0].getMessage()
        and "Creatinine" not in column[0].getMessage(),
        column[0].getMessage() if column else "no warning",
    )

    unknown = chunk_document(
        _ocr_request("lab_result", ["some free text", "more free text"]),
        "unknown_type",
        "2026-10-15",
    )
    record(
        "unknown doc type uses the generic chunker",
        len(unknown) == 1
        and unknown[0].child_text.startswith("[unknown_type | 2026-10-15] "),
        repr(_texts(unknown)),
    )

    import app.services.chunking as chunking_pkg

    original = chunking_pkg.chunk_lab

    def boom(*_args, **_kwargs):
        raise RuntimeError("simulated chunker bug")

    chunking_pkg.chunk_lab = boom
    try:
        with capture_logs() as captured:
            fallback = chunk_document(
                _ocr_request("lab_result", ["line one", "line two"]),
                "lab_result",
                "2026-10-15",
            )
    finally:
        chunking_pkg.chunk_lab = original
    record(
        "chunker exception -> generic fallback + warning",
        len(fallback) == 1
        and fallback[0].child_text.startswith("[lab_result | 2026-10-15] ")
        and any("chunk_fallback" in r.getMessage() for r in captured),
        repr(_texts(fallback)),
    )


def check_default_pipeline() -> None:
    section("7. Default pipeline is wired to the real chunker")
    from app.services.ingest_pipeline import default_pipeline

    record(
        "default_pipeline.chunk is chunk_document",
        default_pipeline.chunk is chunk_document,
        repr(default_pipeline.chunk),
    )


def main() -> int:
    print("Phase 3 verification - smart chunking, parents, context injection")
    print(f"child_max_chars={SETTINGS.child_max_chars}, parent_max_chars={SETTINGS.parent_max_chars}")

    check_lab_fixture()
    check_other_doc_types()
    check_session_structured()
    check_session_text_and_edge_cases()
    check_prefix_ids_normalization()
    check_robustness_and_fallback()
    check_default_pipeline()

    total = len(RESULTS)
    passed = sum(1 for _, status, _ in RESULTS if status == "PASS")
    failed = total - passed
    print()
    print(f"SUMMARY: {passed} PASS / {failed} FAIL / {total} checks")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
