"""Offline unit tests for Phase 9 (hardening, audit, rate limiting, aliases)."""

from __future__ import annotations

import json
import threading
import time

import pytest

from app.api import routes as routes_module
from app.api.ratelimit import RateLimiter, bucket_key, reset_limiter
from app.config import Settings
from app.schemas.errors import ApiError
from app.services.audit import AuditLogger, reset_audit_logger
from app.services.verifier import verify_answer

# --------------------------------------------------------------------------- #
# bilingual clinical aliases
# --------------------------------------------------------------------------- #
ARABIC_LAB = "وظائف الكلى:\nكرياتينين: 1.4 mg/dL (0.6 - 1.2)"


def test_english_answer_from_arabic_document_is_grounded():
    result = verify_answer("Creatinine is 1.4 mg/dL on 2026-10-05 [1].", [ARABIC_LAB])
    assert result.ok, result.missing


def test_alias_handles_alef_and_taa_marboota_variants():
    # "أملوديبين" in the document, "املوديبين" in the answer's source text.
    document = "الروشتة: أملوديبين 5 mg مرة يوميًا"
    assert verify_answer("Amlodipine 5 mg once daily [1].", [document]).ok


def test_alias_covers_hba1c_and_urea():
    document = "التحاليل: سكر تراكمي 7.2 %، يوريا 40 mg/dL"
    result = verify_answer("HbA1c was 7.2 % and urea 40 mg/dL [1].", [document])
    assert result.ok, result.missing


def test_alias_does_not_excuse_an_unlisted_drug():
    result = verify_answer("Furosemide 40 mg [1].", [ARABIC_LAB])
    assert result.ok is False
    assert "Furosemide" in result.missing_terms


def test_alias_does_not_relax_number_checking():
    result = verify_answer("Creatinine is 9.9 mg/dL [1].", [ARABIC_LAB])
    assert result.ok is False
    assert "9.9" in result.missing_numbers


def test_aliases_are_case_insensitive():
    assert verify_answer("creatinine 1.4 mg/dL [1].", [ARABIC_LAB]).ok


def test_english_context_still_works_without_aliases():
    assert verify_answer("Creatinine 1.8 mg/dL [1].", ["Creatinine: 1.8 mg/dL"]).ok


# --------------------------------------------------------------------------- #
# rate limiter
# --------------------------------------------------------------------------- #
class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def test_rate_limiter_allows_then_blocks():
    clock = FakeClock()
    limiter = RateLimiter(3, clock=clock)
    assert [limiter.check("k")[0] for _ in range(3)] == [True, True, True]
    allowed, retry_after = limiter.check("k")
    assert allowed is False
    assert 0 < retry_after <= 60


def test_rate_limiter_window_slides():
    clock = FakeClock()
    limiter = RateLimiter(2, clock=clock)
    assert limiter.check("k")[0] is True
    assert limiter.check("k")[0] is True
    assert limiter.check("k")[0] is False
    clock.advance(61)
    assert limiter.check("k")[0] is True


def test_rate_limiter_is_per_bucket():
    clock = FakeClock()
    limiter = RateLimiter(1, clock=clock)
    assert limiter.check("a")[0] is True
    assert limiter.check("b")[0] is True
    assert limiter.check("a")[0] is False


def test_rate_limiter_zero_disables_it():
    limiter = RateLimiter(0)
    assert limiter.enabled is False
    assert all(limiter.check("k")[0] for _ in range(100))


def test_rate_limiter_is_thread_safe():
    limiter = RateLimiter(50)
    allowed: list[bool] = []
    lock = threading.Lock()

    def worker() -> None:
        for _ in range(20):
            ok, _ = limiter.check("shared")
            with lock:
                allowed.append(ok)

    threads = [threading.Thread(target=worker) for _ in range(10)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert allowed.count(True) == 50
    assert allowed.count(False) == 150


def test_bucket_key_never_contains_the_raw_key():
    key = bucket_key("super-secret-api-key", "10.0.0.5")
    assert "super-secret-api-key" not in key
    assert key.endswith(":10.0.0.5")
    assert bucket_key("a", "h") != bucket_key("b", "h")


def test_rate_limit_error_carries_retry_after():
    from app.schemas.errors import rate_limited

    error = rate_limited(12.4)
    assert error.status_code == 429
    assert error.code == "rate_limited"
    assert error.headers["Retry-After"] == "12"
    assert set(error.to_body()) == {"error"}


# --------------------------------------------------------------------------- #
# audit
# --------------------------------------------------------------------------- #
def test_audit_record_has_the_required_fields_and_no_pii(tmp_path):
    path = tmp_path / "audit.jsonl"
    audit = AuditLogger(path, "test-salt")
    audit.record(
        request_id="req-1",
        endpoint="/rag/ask",
        patient_id="patient-42",
        status=200,
        latency_ms=123.456,
        source_count=2,
        mode="latest",
        result_type="answered",
    )
    line = json.loads(path.read_text(encoding="utf-8").strip())
    assert set(line) == {
        "timestamp",
        "request_id",
        "endpoint",
        "patient_id_hash",
        "status",
        "latency_ms",
        "source_count",
        "mode",
        "result_type",
    }
    assert line["request_id"] == "req-1"
    assert line["latency_ms"] == 123.46
    assert line["source_count"] == 2
    assert "patient-42" not in path.read_text(encoding="utf-8")
    assert len(line["patient_id_hash"]) == 32


def test_audit_hash_is_stable_and_salted(tmp_path):
    first = AuditLogger(tmp_path / "a.jsonl", "salt-one")
    second = AuditLogger(tmp_path / "b.jsonl", "salt-two")
    assert first.hash_patient("p1") == first.hash_patient("p1")
    assert first.hash_patient("p1") != second.hash_patient("p1")
    assert first.hash_patient("p1") != first.hash_patient("p2")


def test_audit_appends_one_line_per_request(tmp_path):
    path = tmp_path / "audit.jsonl"
    audit = AuditLogger(path, "s")
    for index in range(3):
        audit.record(
            request_id=f"r{index}",
            endpoint="/rag/ask",
            patient_id="p",
            status=200,
            latency_ms=1.0,
        )
    lines = path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 3
    assert [json.loads(line)["request_id"] for line in lines] == ["r0", "r1", "r2"]


def test_audit_disabled_writes_nothing(tmp_path):
    path = tmp_path / "audit.jsonl"
    AuditLogger(path, "s", enabled=False).record(
        request_id="r", endpoint="/x", patient_id="p", status=200, latency_ms=1.0
    )
    assert not path.exists()


def test_audit_write_failure_never_raises(tmp_path):
    # A directory where the file should be: open() fails with OSError.
    blocked = tmp_path / "blocked"
    blocked.mkdir()
    audit = AuditLogger(blocked, "s")
    audit.record(request_id="r", endpoint="/x", patient_id="p", status=200, latency_ms=1.0)


def test_audit_uses_a_random_salt_when_missing(tmp_path):
    first = AuditLogger(tmp_path / "a.jsonl", "")
    second = AuditLogger(tmp_path / "b.jsonl", "")
    assert first.hash_patient("p") != second.hash_patient("p")


# --------------------------------------------------------------------------- #
# configuration
# --------------------------------------------------------------------------- #
def test_cors_origins_are_parsed_and_closed_by_default():
    assert Settings.model_fields["cors_allowed_origins_csv"].default == ""
    settings = Settings(cors_allowed_origins_csv="https://a.local, https://b.local")
    assert settings.cors_allowed_origins == ["https://a.local", "https://b.local"]


def test_security_defaults_are_safe():
    assert Settings.model_fields["rate_limit_per_minute"].default == 60
    assert Settings.model_fields["audit_enabled"].default is True
    assert Settings.model_fields["audit_log_path"].default == "logs/audit.jsonl"


# --------------------------------------------------------------------------- #
# API level (stubbed generation)
# --------------------------------------------------------------------------- #
@pytest.fixture()
def client_with_stubs(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app
    from app.schemas.contract import Source
    from app.services.generator import GeneratedAnswer

    def fake_answer(patient_id, doctor_query, chat_history=None, filters=None, clock=None, **kw):
        return GeneratedAnswer(
            answer="Creatinine 1.8 mg/dL.",
            sources=[
                Source(
                    document_id=f"{patient_id}-doc",
                    doc_type="lab_result",
                    doc_date="2026-10-15",
                    reference_snippet="Creatinine: 1.8 mg/dL",
                )
            ],
            mode="normal",
            result_type="answered",
            rewritten=False,
        )

    monkeypatch.setattr(routes_module, "answer_question", fake_answer)
    with TestClient(app) as client:
        yield client


def _auth() -> dict[str, str]:
    from app.config import get_settings

    return {"X-API-Key": get_settings().rag_api_key.get_secret_value()}


def test_api_rate_limit_returns_429_with_retry_after(client_with_stubs, monkeypatch):
    from app.api import ratelimit

    limiter = RateLimiter(2)
    monkeypatch.setattr(ratelimit, "get_limiter", lambda: limiter)
    body = {"patient_id": "p1", "doctor_query": "creatinine", "chat_history": []}
    assert client_with_stubs.post("/rag/ask", json=body, headers=_auth()).status_code == 200
    assert client_with_stubs.post("/rag/ask", json=body, headers=_auth()).status_code == 200
    blocked = client_with_stubs.post("/rag/ask", json=body, headers=_auth())
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "rate_limited"
    assert int(blocked.headers["Retry-After"]) >= 1
    # /health is outside the router and must stay reachable.
    assert client_with_stubs.get("/health").status_code == 200


def test_api_rate_limit_does_not_count_unauthenticated_calls(client_with_stubs, monkeypatch):
    from app.api import ratelimit

    limiter = RateLimiter(1)
    monkeypatch.setattr(ratelimit, "get_limiter", lambda: limiter)
    body = {"patient_id": "p1", "doctor_query": "creatinine"}
    assert client_with_stubs.post("/rag/ask", json=body).status_code == 401
    assert client_with_stubs.post("/rag/ask", json=body, headers=_auth()).status_code == 200


def test_api_writes_a_zero_pii_audit_record(client_with_stubs, tmp_path):
    path = tmp_path / "audit.jsonl"
    audit = AuditLogger(path, "unit-salt")
    reset_audit_logger(audit)
    try:
        response = client_with_stubs.post(
            "/rag/ask",
            json={
                "patient_id": "secret-patient-999",
                "doctor_query": "my private question about creatinine",
                "chat_history": [],
            },
            headers=_auth(),
        )
    finally:
        reset_audit_logger(None)
    assert response.status_code == 200
    text = path.read_text(encoding="utf-8")
    line = json.loads(text.strip())
    assert line["endpoint"] == "/rag/ask"
    assert line["status"] == 200
    assert line["source_count"] == 1
    assert line["result_type"] == "answered"
    assert line["request_id"]
    assert "secret-patient-999" not in text
    assert "private question" not in text
    assert "Creatinine 1.8" not in text


def test_api_returns_retry_after_only_on_429(client_with_stubs, monkeypatch):
    from app.api import ratelimit

    limiter = RateLimiter(1)
    monkeypatch.setattr(ratelimit, "get_limiter", lambda: limiter)
    body = {"patient_id": "p1", "doctor_query": "creatinine"}
    first = client_with_stubs.post("/rag/ask", json=body, headers=_auth())
    second = client_with_stubs.post("/rag/ask", json=body, headers=_auth())
    assert "Retry-After" not in first.headers
    assert "Retry-After" in second.headers


def test_limiter_reset_helper():
    reset_limiter(RateLimiter(5))
    from app.api.ratelimit import get_limiter

    assert get_limiter().limit == 5
    reset_limiter(None)


def test_api_error_keeps_standard_body_shape():
    error = ApiError(429, "rate_limited", "slow down", headers={"Retry-After": "5"})
    assert error.to_body() == {"error": {"code": "rate_limited", "message": "slow down"}}
    assert error.headers == {"Retry-After": "5"}


def test_ratelimit_window_constant_is_a_minute():
    limiter = RateLimiter(10)
    started = time.monotonic()
    assert limiter.check("k")[0]
    assert time.monotonic() - started < 1.0
