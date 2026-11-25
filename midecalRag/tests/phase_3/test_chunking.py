"""Phase 3 unit tests: normalizer, chunkers, context injection, fallbacks."""

from __future__ import annotations

import logging
import random
import re

import pytest

from app.config import get_settings
from app.schemas.contract import IngestRequest
from app.services.chunking import chunk_document
from app.services.chunking.base import inject_context, make_parent_id
from app.services.normalizer import normalize

SETTINGS = get_settings()

LAB_LINES = [
    "Al-Borg Lab",
    "Date: 15/10/2026",
    "Renal Function:",
    "Creatinine: 1.8 mg/dL (0.6 - 1.2)",
    "Urea: 65 mg/dL (15 - 45)",
]

SESSION_DATA = {
    "chief_complaint": "Headache and dizziness for one week.",
    "history_of_present_illness": "Known hypertensive on treatment.",
    "assessment_and_diagnosis": "Hypertension, stage 1.",
    "treatment_plan": "Start Amlodipine 5 mg once daily. Follow-up in 4 weeks.",
    "consultation_date": "2026-10-24",
}


def ocr_request(
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


def session_request(data: dict, document_id: str = "doc") -> IngestRequest:
    return IngestRequest.model_validate(
        {
            "patient_id": "p1",
            "document_id": document_id,
            "uploaded_at": "2026-10-24T11:05:00Z",
            "user_selected_type": "session_report",
            "session_report_data": data,
        }
    )


def by_parent(children):
    grouped: dict[str, list] = {}
    for child in children:
        grouped.setdefault(child.parent_id, []).append(child)
    return grouped


# ---------------------------------------------------------------------------
# Lab
# ---------------------------------------------------------------------------


def test_primary_lab_fixture_exact() -> None:
    children = chunk_document(ocr_request("lab_result", LAB_LINES), "lab_result", "2026-10-15")
    grouped = by_parent(children)
    assert len(children) == 4
    assert list(grouped) == ["doc#p0", "doc#p1"]
    assert [len(grouped[key]) for key in grouped] == [2, 2]
    assert grouped["doc#p0"][0].parent_text == "Al-Borg Lab\nDate: 15/10/2026"
    assert grouped["doc#p1"][0].parent_text == (
        "Renal Function:\nCreatinine: 1.8 mg/dL (0.6 - 1.2)\nUrea: 65 mg/dL (15 - 45)"
    )
    assert [child.child_text for child in children] == [
        "[lab_result | 2026-10-15] Al-Borg Lab",
        "[lab_result | 2026-10-15] Date: 15/10/2026",
        "[lab_result | 2026-10-15] Creatinine: 1.8 mg/dL (0.6 - 1.2)",
        "[lab_result | 2026-10-15] Urea: 65 mg/dL (15 - 45)",
    ]
    assert grouped["doc#p1"][0].raw_snippet == "Creatinine: 1.8 mg/dL (0.6 - 1.2)"
    assert [child.child_index for child in children] == [0, 1, 2, 3]


def test_lab_test_children_keep_name_value_unit_range() -> None:
    children = chunk_document(ocr_request("lab_result", LAB_LINES), "lab_result", "2026-10-15")
    pattern = re.compile(
        r"^\[lab_result \| 2026-10-15\] [A-Za-z][^:]*: \d.*mg/dL.*\(\d.*-.*\d.*\)$"
    )
    tests = [child for child in children if child.parent_id == "doc#p1"]
    assert tests
    assert all(pattern.match(child.child_text) for child in tests)


def test_lab_wrapped_lines_join() -> None:
    children = chunk_document(
        ocr_request("lab_result", ["Renal Function:", "Creatinine", "1.8 mg/dL (0.6 - 1.2)"]),
        "lab_result",
        "2026-10-15",
    )
    assert len(children) == 1
    assert children[0].child_text == "[lab_result | 2026-10-15] Creatinine 1.8 mg/dL (0.6 - 1.2)"
    assert children[0].raw_snippet == "Creatinine\n1.8 mg/dL (0.6 - 1.2)"


# ---------------------------------------------------------------------------
# Prescription / report / radiology
# ---------------------------------------------------------------------------


def test_prescription_one_child_per_drug() -> None:
    children = chunk_document(
        ocr_request(
            "prescription",
            [
                "Paracetamol",
                "500 mg",
                "One tablet every 8 hours as needed",
                "Amlodipine",
                "5mg",
            ],
        ),
        "prescription",
        "2026-10-15",
    )
    assert [child.child_text for child in children] == [
        "[prescription | 2026-10-15] Paracetamol 500 mg",
        "[prescription | 2026-10-15] One tablet every 8 hours as needed",
        "[prescription | 2026-10-15] Amlodipine 5 mg",
    ]
    assert len({child.parent_id for child in children}) == 1
    assert "Paracetamol" in children[0].parent_text
    assert "Amlodipine" in children[0].parent_text


def test_report_sections() -> None:
    children = chunk_document(
        ocr_request(
            "medical_report",
            ["Findings:", "The lungs are clear.", "Impression:", "No acute disease."],
        ),
        "medical_report",
        "2026-10-15",
    )
    assert [child.child_text for child in children] == [
        "[medical_report | 2026-10-15] The lungs are clear.",
        "[medical_report | 2026-10-15] No acute disease.",
    ]
    assert len(by_parent(children)) == 2
    assert all(child.parent_text.split("\n")[0].endswith(":") for child in children)


def test_radiology_uses_report_chunker() -> None:
    children = chunk_document(
        ocr_request("radiology", ["Findings:", "No fracture seen."]),
        "radiology",
        "2026-10-15",
    )
    assert len(children) == 1
    assert children[0].child_text == "[radiology | 2026-10-15] No fracture seen."


# ---------------------------------------------------------------------------
# Session report
# ---------------------------------------------------------------------------


def test_session_structured_exact() -> None:
    children = chunk_document(
        session_request(SESSION_DATA), "session_report", "2026-10-24"
    )
    assert len(children) == 4
    assert len({child.parent_id for child in children}) == 1
    assert children[0].parent_id == "doc#p0"
    assert [child.child_text for child in children] == [
        "[session_report | 2026-10-24 | Section: Chief Complaint] Headache and dizziness for one week.",
        "[session_report | 2026-10-24 | Section: History of Present Illness] Known hypertensive on treatment.",
        "[session_report | 2026-10-24 | Section: Diagnosis] Hypertension, stage 1.",
        "[session_report | 2026-10-24 | Section: Treatment Plan] Start Amlodipine 5 mg once daily. Follow-up in 4 weeks.",
    ]
    parent_text = children[0].parent_text
    assert all(
        value in parent_text
        for value in SESSION_DATA.values()
        if value != "2026-10-24"
    )
    assert children[3].raw_snippet == SESSION_DATA["treatment_plan"]


def test_session_full_text_headings() -> None:
    children = chunk_document(
        session_request(
            {"full_report_text": "Chief Complaint:\nHeadache\nDiagnosis:\nHypertension, stage 1."}
        ),
        "session_report",
        "2026-10-24",
    )
    assert [child.child_text for child in children] == [
        "[session_report | 2026-10-24 | Section: Chief Complaint] Headache",
        "[session_report | 2026-10-24 | Section: Diagnosis] Hypertension, stage 1.",
    ]


def test_session_no_headings_general() -> None:
    children = chunk_document(
        session_request({"full_report_text": "A free paragraph with no headings."}),
        "session_report",
        "2026-10-24",
    )
    assert len(children) == 1
    assert children[0].child_text == (
        "[session_report | 2026-10-24 | Section: General] A free paragraph with no headings."
    )


def test_session_long_section_same_label() -> None:
    children = chunk_document(
        session_request({"treatment_plan": "word " * 400}),
        "session_report",
        "2026-10-24",
    )
    assert len(children) > 1
    labels = {child.child_text.split("]")[0] for child in children}
    assert labels == {"[session_report | 2026-10-24 | Section: Treatment Plan"}
    assert all(len(child.child_text) <= SETTINGS.child_max_chars for child in children)


def test_session_missing_section_no_empty_child() -> None:
    data = dict(SESSION_DATA)
    data.pop("treatment_plan")
    children = chunk_document(session_request(data), "session_report", "2026-10-24")
    assert len(children) == 3
    assert all(child.child_text.strip() and child.raw_snippet.strip() for child in children)


def test_session_both_sources_parent_and_warning(caplog: pytest.LogCaptureFixture) -> None:
    data = dict(SESSION_DATA)
    data["full_report_text"] = "A completely different report body."
    with caplog.at_level(logging.WARNING):
        children = chunk_document(
            session_request(data), "session_report", "2026-10-24"
        )
    assert children[0].parent_text == "A completely different report body."
    assert len(children) == 4
    assert any("session_sections_mismatch" in record.getMessage() for record in caplog.records)


def test_session_extra_section_label() -> None:
    data = dict(SESSION_DATA)
    data["follow_up"] = "Return in 4 weeks."
    children = chunk_document(session_request(data), "session_report", "2026-10-24")
    assert children[-1].child_text == (
        "[session_report | 2026-10-24 | Section: Follow Up] Return in 4 weeks."
    )


# ---------------------------------------------------------------------------
# Prefixes, ids, normalization, limits, robustness
# ---------------------------------------------------------------------------


def test_prefix_formats() -> None:
    assert inject_context("lab_result", "2026-10-15", "Creatinine 1.8") == (
        "[lab_result | 2026-10-15] Creatinine 1.8"
    )
    assert inject_context(
        "session_report", "2026-10-24", "Headache", "Chief Complaint"
    ) == "[session_report | 2026-10-24 | Section: Chief Complaint] Headache"


def test_parent_id_format() -> None:
    assert make_parent_id("doc", 0) == "doc#p0"
    assert make_parent_id("doc", 12) == "doc#p12"


def test_normalization_keeps_raw_snippet() -> None:
    children = chunk_document(
        ocr_request(
            "lab_result",
            ["Renal Function:", "Creatinine: ١٢.٥ mg/dL (0.6 - 1.2)", "Urea: 5mg"],
        ),
        "lab_result",
        "2026-10-15",
    )
    assert any("Creatinine: 12.5 mg/dL" in child.child_text for child in children)
    assert any("Urea: 5 mg" in child.child_text for child in children)
    assert any(child.raw_snippet == "Creatinine: ١٢.٥ mg/dL (0.6 - 1.2)" for child in children)
    assert any(child.raw_snippet == "Urea: 5mg" for child in children)
    assert normalize("  Creatinine   ١٢.٥mg/dL  ") == "Creatinine 12.5 mg/dL"


def test_no_empty_child_and_child_limit() -> None:
    children = chunk_document(
        ocr_request("medical_report", ["word " * 500]),
        "medical_report",
        "2026-10-15",
    )
    assert children
    assert all(child.child_text.strip() and child.raw_snippet.strip() for child in children)
    assert all(len(child.child_text) <= SETTINGS.child_max_chars for child in children)


@pytest.mark.parametrize("seed", [1, 7, 42])
def test_random_text_never_crashes(seed: int) -> None:
    rng = random.Random(seed)
    alphabet = "abcXYZ 0123456789.:-()/%\n\t" + "ابتثجحخدذرزسشصضطظعغفقكلمنهوي١٢٣"
    for _ in range(30):
        text = "".join(rng.choice(alphabet) for _ in range(rng.randint(1, 400)))
        if not text.strip():
            text = "x"
        children = chunk_document(
            ocr_request("lab_result", text.split("\n"), raw_text=text),
            "lab_result",
            "2026-10-15",
        )
        assert all(child.child_text.strip() and child.raw_snippet.strip() for child in children)


def test_column_ocr_warning(caplog: pytest.LogCaptureFixture) -> None:
    lines = ["Creatinine", "Urea", "1.8", "65", "0.6 - 1.2", "15 - 45"]
    with caplog.at_level(logging.WARNING):
        chunk_document(ocr_request("lab_result", lines), "lab_result", "2026-10-15")
    warnings = [r for r in caplog.records if "column_ocr_symptom" in r.getMessage()]
    assert warnings
    message = warnings[0].getMessage()
    assert "numeric_only=" in message and "name_only=" in message
    assert "Creatinine" not in message


# ---------------------------------------------------------------------------
# Fallbacks and pipeline wiring
# ---------------------------------------------------------------------------


def test_generic_fallback_unknown_type() -> None:
    children = chunk_document(
        ocr_request("lab_result", ["some free text", "more free text"]),
        "unknown_type",
        "2026-10-15",
    )
    assert len(children) == 1
    assert children[0].child_text.startswith("[unknown_type | 2026-10-15] ")


def test_chunker_exception_falls_back(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    import app.services.chunking as chunking_pkg

    def boom(*_args, **_kwargs):
        raise RuntimeError("simulated chunker bug")

    monkeypatch.setattr(chunking_pkg, "chunk_lab", boom)
    with caplog.at_level(logging.WARNING):
        children = chunk_document(
            ocr_request("lab_result", ["line one", "line two"]),
            "lab_result",
            "2026-10-15",
        )
    assert len(children) == 1
    assert children[0].child_text.startswith("[lab_result | 2026-10-15] ")
    assert any("chunk_fallback" in record.getMessage() for record in caplog.records)


def test_ocr_lines_empty_falls_back_to_raw_text() -> None:
    children = chunk_document(
        ocr_request(
            "lab_result",
            [],
            raw_text="Renal Function:\nCreatinine: 1.8 mg/dL",
        ),
        "lab_result",
        "2026-10-15",
    )
    assert len(children) == 1
    assert children[0].raw_snippet == "Creatinine: 1.8 mg/dL"


def test_all_empty_lines_no_children() -> None:
    children = chunk_document(
        ocr_request("lab_result", ["   ", ""], raw_text="ignored"),
        "lab_result",
        "2026-10-15",
    )
    assert children == []


def test_default_pipeline_uses_real_chunker() -> None:
    from app.services.ingest_pipeline import default_pipeline

    assert default_pipeline.chunk is chunk_document
