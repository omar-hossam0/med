"""Pytest mirror of the fast Phase 0 checks (contract, auth, errors, log hygiene).

No subprocesses, no fastembed import, no Qdrant calls: this suite must be
quick and fully deterministic. All fixture data is fictional.
"""

from __future__ import annotations

import copy
import json
import logging

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.schemas.contract import AskRequest, IngestRequest

INGEST_LAB_EXAMPLE = {
    "patient_id": "p_12345",
    "document_id": "doc_987",
    "uploaded_at": "2026-10-24T10:30:00Z",
    "user_selected_type": "lab_result",
    "user_selected_date": None,
    "ocr_output": {
        "raw_text": (
            "Al-Borg Lab\nDate: 15/10/2026\nRenal Function:\n"
            "Creatinine: 1.8 mg/dL (0.6 - 1.2)\nUrea: 65 mg/dL (15 - 45)"
        ),
        "lines": [
            "Al-Borg Lab",
            "Date: 15/10/2026",
            "Renal Function:",
            "Creatinine: 1.8 mg/dL (0.6 - 1.2)",
            "Urea: 65 mg/dL (15 - 45)",
        ],
        "detected_doc_type": "lab_result",
        "extracted_date": "2026-10-15",
    },
}

ASK_EXAMPLE = {
    "patient_id": "p_12345",
    "doctor_query": "What is the Creatinine level in the latest lab result?",
    "chat_history": [
        {"role": "user", "content": "What chronic conditions does the patient have?"},
        {
            "role": "assistant",
            "content": "The patient has a history of hypertension and Type 2 diabetes.",
        },
    ],
    "optional_filters": {"doc_type": None, "date_from": None},
}

SESSION_STRUCTURED = {
    "patient_id": "p_12345",
    "document_id": "doc_session_5521",
    "uploaded_at": "2026-10-24T11:05:00Z",
    "user_selected_type": "session_report",
    "user_selected_date": None,
    "session_report_data": {
        "chief_complaint": "Headache and dizziness for one week.",
        "history_of_present_illness": "Known hypertensive, stopped medication two weeks ago.",
        "assessment_and_diagnosis": "Hypertension, stage 1.",
        "treatment_plan": "Start Amlodipine 5 mg once daily. Follow-up in 4 weeks.",
        "consultation_date": "2026-10-24",
    },
}

SESSION_FULL_TEXT = {
    "patient_id": "p_12345",
    "document_id": "doc_session_5522",
    "uploaded_at": "2026-10-24T11:05:00Z",
    "user_selected_type": "session_report",
    "user_selected_date": None,
    "session_report_data": {
        "full_report_text": (
            "Chief Complaint: Headache and dizziness for one week.\n"
            "Diagnosis: Hypertension, stage 1.\n"
            "Treatment Plan: Start Amlodipine 5 mg once daily."
        ),
        "consultation_date": "2026-10-24",
    },
}

PLAIN_OCR = {
    "patient_id": "p_67890",
    "document_id": "doc_plain_1",
    "uploaded_at": "2026-10-26T09:00:00Z",
    "user_selected_type": "prescription",
    "ocr_output": {
        "raw_text": "Paracetamol 500 mg\nOne tablet every 8 hours as needed"
    },
}


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture()
def auth() -> dict[str, str]:
    # Value used in headers only; never printed, never asserted against.
    return {"X-API-Key": get_settings().rag_api_key.get_secret_value()}


def error_shape_ok(body: object) -> bool:
    return (
        isinstance(body, dict)
        and set(body.keys()) == {"error"}
        and isinstance(body["error"], dict)
        and set(body["error"].keys()) == {"code", "message"}
    )


# --- 1. contract model parsing -------------------------------------------------


def test_plan_51_ingest_example_parses():
    IngestRequest.model_validate(copy.deepcopy(INGEST_LAB_EXAMPLE))


def test_plan_52_ask_example_parses():
    AskRequest.model_validate(copy.deepcopy(ASK_EXAMPLE))


# --- 3. Section 5.4 fixtures ---------------------------------------------------


def test_session_structured_fixture_accepted():
    IngestRequest.model_validate(copy.deepcopy(SESSION_STRUCTURED))


def test_session_full_text_fixture_accepted():
    IngestRequest.model_validate(copy.deepcopy(SESSION_FULL_TEXT))


def test_plain_ocr_fixture_accepted():
    IngestRequest.model_validate(copy.deepcopy(PLAIN_OCR))


# --- 2. rejection rules over HTTP ----------------------------------------------


def _post_ingest(client: TestClient, auth: dict, payload: dict):
    return client.post("/rag/ingest", json=payload, headers=auth)


def _expect_rejection(client, auth, payload, status, code):
    resp = _post_ingest(client, auth, payload)
    body = resp.json()
    assert resp.status_code == status, body
    assert error_shape_ok(body)
    assert body["error"]["code"] == code


def test_missing_patient_id_rejected(client, auth):
    payload = copy.deepcopy(PLAIN_OCR)
    del payload["patient_id"]
    _expect_rejection(client, auth, payload, 400, "invalid_request")


def test_whitespace_raw_text_rejected(client, auth):
    payload = copy.deepcopy(PLAIN_OCR)
    payload["ocr_output"]["raw_text"] = "   \n\t "
    _expect_rejection(client, auth, payload, 400, "empty_text")


def test_invalid_doc_type_rejected(client, auth):
    payload = copy.deepcopy(PLAIN_OCR)
    payload["user_selected_type"] = "report"
    _expect_rejection(client, auth, payload, 400, "invalid_request")


def test_bad_uploaded_at_rejected(client, auth):
    payload = copy.deepcopy(PLAIN_OCR)
    payload["uploaded_at"] = "not-a-datetime"
    _expect_rejection(client, auth, payload, 400, "invalid_request")


def test_both_sources_rejected(client, auth):
    payload = copy.deepcopy(PLAIN_OCR)
    payload["session_report_data"] = {"full_report_text": "Fictional session report."}
    _expect_rejection(client, auth, payload, 400, "invalid_request")


def test_neither_source_rejected(client, auth):
    payload = copy.deepcopy(PLAIN_OCR)
    del payload["ocr_output"]
    _expect_rejection(client, auth, payload, 400, "invalid_request")


def test_session_report_with_ocr_rejected(client, auth):
    payload = copy.deepcopy(PLAIN_OCR)
    payload["user_selected_type"] = "session_report"
    _expect_rejection(client, auth, payload, 400, "invalid_request")


def test_session_report_without_data_rejected(client, auth):
    payload = copy.deepcopy(PLAIN_OCR)
    del payload["ocr_output"]
    payload["user_selected_type"] = "session_report"
    _expect_rejection(client, auth, payload, 400, "invalid_request")


def test_lab_with_session_data_rejected(client, auth):
    payload = copy.deepcopy(PLAIN_OCR)
    del payload["ocr_output"]
    payload["session_report_data"] = {"full_report_text": "Fictional session report."}
    _expect_rejection(client, auth, payload, 400, "invalid_request")


def test_all_empty_session_data_rejected(client, auth):
    payload = copy.deepcopy(PLAIN_OCR)
    del payload["ocr_output"]
    payload["user_selected_type"] = "session_report"
    payload["session_report_data"] = {"full_report_text": "  ", "chief_complaint": ""}
    _expect_rejection(client, auth, payload, 400, "empty_text")


# --- 4. extra fields ignored ----------------------------------------------------


def test_unknown_extra_field_ignored(client, auth):
    payload = copy.deepcopy(INGEST_LAB_EXAMPLE)
    payload["future_field"] = 123
    model = IngestRequest.model_validate(copy.deepcopy(payload))
    assert "future_field" not in model.model_dump()
    resp = _post_ingest(client, auth, payload)
    assert resp.status_code == 202  # validated fine; pipeline is Phase 2's job


# --- endpoints validate then answer 501 in Phase 0 ------------------------------


def test_ingest_valid_returns_202_accepted(client, auth):
    # Phase 2: valid ingest writes the manifest and schedules the pipeline;
    # the endpoint answers 202 immediately.
    resp = _post_ingest(client, auth, copy.deepcopy(INGEST_LAB_EXAMPLE))
    body = resp.json()
    assert resp.status_code == 202
    assert body == {"document_id": "doc_987", "status": "processing"}


def test_ask_valid_returns_answer_and_sources(client, auth, monkeypatch):
    # Phase 6 wires the real pipeline; the generator is stubbed here so the
    # contract test stays offline and deterministic.
    from app.api import routes
    from app.schemas.contract import Source
    from app.services.generator import GeneratedAnswer

    def fake_answer(patient_id, doctor_query, chat_history=None, filters=None, clock=None, **kwargs):
        return GeneratedAnswer(
            answer="Creatinine 1.8 mg/dL.",
            sources=[
                Source(
                    document_id="doc_1",
                    doc_type="lab_result",
                    doc_date="2026-10-15",
                    reference_snippet="Creatinine: 1.8 mg/dL",
                )
            ],
            mode="normal",
            result_type="answered",
            rewritten=False,
        )

    monkeypatch.setattr(routes, "answer_question", fake_answer)
    resp = client.post("/rag/ask", json=copy.deepcopy(ASK_EXAMPLE), headers=auth)
    body = resp.json()
    assert resp.status_code == 200
    assert set(body) == {"answer", "sources"}
    assert body["answer"] == "Creatinine 1.8 mg/dL."
    assert body["sources"][0]["document_id"] == "doc_1"


# --- 5. auth ---------------------------------------------------------------------


def test_missing_api_key_401(client):
    resp = client.post("/rag/ingest", json=copy.deepcopy(INGEST_LAB_EXAMPLE))
    body = resp.json()
    assert resp.status_code == 401
    assert error_shape_ok(body)
    assert body["error"]["code"] == "unauthorized"


def test_wrong_api_key_401(client):
    resp = client.post(
        "/rag/ingest",
        json=copy.deepcopy(INGEST_LAB_EXAMPLE),
        headers={"X-API-Key": "definitely-wrong-key"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


def test_health_open_without_key(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# --- 6. malformed JSON -----------------------------------------------------------


def test_malformed_json_400_not_422(client, auth):
    resp = client.post(
        "/rag/ask",
        content=b"{not json",
        headers={**auth, "Content-Type": "application/json"},
    )
    body = resp.json()
    assert resp.status_code == 400
    assert resp.status_code != 422
    assert error_shape_ok(body)
    assert body["error"]["code"] == "invalid_request"
    assert "{not json" not in resp.text


# --- 8. log hygiene --------------------------------------------------------------


def test_no_body_text_in_logs(client, auth):
    marker = "ZZTOP-SECRET-MARKER-Creatinine-9.9"
    captured: list[logging.LogRecord] = []

    class _Capture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            captured.append(record)

    root = logging.getLogger()
    capture = _Capture(level=logging.DEBUG)
    root.addHandler(capture)
    try:
        payload = copy.deepcopy(INGEST_LAB_EXAMPLE)
        payload["document_id"] = "doc_loghygiene_1"
        payload["ocr_output"]["raw_text"] = f"Fictional Lab Report\nCreatinine: 9.9\n{marker}"
        _post_ingest(client, auth, payload)
    finally:
        root.removeHandler(capture)

    rendered = "\n".join(
        str(r.getMessage()) + " " + str(r.__dict__) for r in captured
    )
    assert marker not in rendered
    assert "Creatinine" not in rendered


def test_request_log_line_is_sanitized_json(client, auth):
    from app.logging_config import JsonFormatter

    captured: list[logging.LogRecord] = []

    class _Capture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            captured.append(record)

    root = logging.getLogger()
    capture = _Capture(level=logging.DEBUG)
    root.addHandler(capture)
    try:
        client.post(
            "/rag/ingest",
            json=copy.deepcopy(PLAIN_OCR),
            headers={**auth, "X-Request-ID": "test-req-123"},
        )
    finally:
        root.removeHandler(capture)

    formatter = JsonFormatter()
    lines = [formatter.format(r) for r in captured]
    request_lines = [json.loads(line) for line in lines if '"http_request"' in line]
    assert request_lines, "expected an http_request log line"
    allowed = {"ts", "level", "event", "request_id", "method", "path", "status_code", "duration_ms"}
    last = request_lines[-1]
    assert set(last.keys()) == allowed
    assert last["request_id"] == "test-req-123"
    assert last["path"] == "/rag/ingest"
