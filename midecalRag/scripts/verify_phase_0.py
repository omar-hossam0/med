"""Phase 0 verification for the CareOS Medical RAG service (plan Section E).

Run from the repository root:

    env/Scripts/python.exe scripts/verify_phase_0.py

Prints PASS / FAIL / SKIPPED per check and a final summary line; exits with a
nonzero code if any check fails. SKIPPED is allowed ONLY for the Qdrant
reachability check.

Security rules honoured throughout:
- The .env file is never read or printed directly; all settings come from the
  app itself (pydantic-settings via get_settings()).
- Settings values are never printed - only field names, booleans and counts.
- All patient / clinical data in fixtures below is fictional.
"""

from __future__ import annotations

import copy
import json
import logging
import logging.handlers
import os
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Since Phase 2 the ingest endpoint schedules the real pipeline on accept, so
# re-runs of this script must target a throwaway collection and manifest DB
# (real environment variables beat .env values in pydantic-settings). Set
# BEFORE the app is imported below. The fail-fast subprocess is unaffected:
# its environment is built from a fixed whitelist without these keys.
os.environ.setdefault("COLLECTION_NAME", "careos_phase0_test")
os.environ.setdefault(
    "DB_URL",
    "sqlite:///" + tempfile.gettempdir().replace("\\", "/") + "/careos_phase0_manifest.db",
)
os.environ.setdefault("EMBED_WARMUP_ON_STARTUP", "false")

# UTF-8 console output on Windows without emojis.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover - non-tty streams
    pass


# ---------------------------------------------------------------------------
# Fixtures (fictional data, exact JSON examples from plan Sections 5.1-5.4)
# ---------------------------------------------------------------------------

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

SESSION_STRUCTURED_EXAMPLE = {
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

SESSION_FULL_TEXT_EXAMPLE = {
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

PLAIN_OCR_EXAMPLE = {
    "patient_id": "p_67890",
    "document_id": "doc_plain_1",
    "uploaded_at": "2026-10-26T09:00:00Z",
    "user_selected_type": "prescription",
    "ocr_output": {
        "raw_text": "Paracetamol 500 mg\nOne tablet every 8 hours as needed"
    },
}

LOG_MARKER = "ZZTOP-SECRET-MARKER-Creatinine-9.9"

LOG_ALLOWED_KEYS = {
    "ts",
    "level",
    "event",
    "request_id",
    "method",
    "path",
    "status_code",
    "duration_ms",
}


# ---------------------------------------------------------------------------
# Result collection
# ---------------------------------------------------------------------------

RESULTS: list[tuple[str, str, str]] = []  # (name, status, detail)
QDRANT_REACHABLE = False
QDRANT_SKIPPED = False


def record(name: str, status: str, detail: str = "") -> None:
    RESULTS.append((name, status, detail))
    if status == "PASS":
        print(f"PASS: {name}")
    else:
        suffix = f" -- {detail}" if detail else ""
        print(f"{status}: {name}{suffix}")


def info(message: str) -> None:
    print(f"INFO: {message}")


def section(title: str) -> None:
    print()
    print(f"=== {title} ===")


# ---------------------------------------------------------------------------
# Imports of the application (after sys.path fix) and HTTP helpers
# ---------------------------------------------------------------------------

from fastapi.testclient import TestClient  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.contract import AskRequest, IngestRequest  # noqa: E402

client = TestClient(app)

# The API key value is used ONLY in request headers; it is never printed.
API_KEY = get_settings().rag_api_key.get_secret_value()
AUTH = {"X-API-Key": API_KEY}


def post_ingest(payload: dict, headers: dict | None = None):
    return client.post("/rag/ingest", json=payload, headers=headers or AUTH)


def error_shape_ok(body: object) -> bool:
    """Exact contract shape: {'error': {'code': ..., 'message': ...}} and nothing else."""
    return (
        isinstance(body, dict)
        and set(body.keys()) == {"error"}
        and isinstance(body["error"], dict)
        and set(body["error"].keys()) == {"code", "message"}
    )


def _rejection_payload() -> dict:
    return copy.deepcopy(PLAIN_OCR_EXAMPLE)


def check_http_rejection(name: str, payload: dict, expected_code: str) -> None:
    resp = post_ingest(payload)
    try:
        body = resp.json()
    except ValueError:
        body = None
    ok = (
        resp.status_code == 400
        and error_shape_ok(body)
        and body["error"]["code"] == expected_code
    )
    if ok:
        record(name, "PASS")
    else:
        # Error bodies are built by the app from loc/type/msg only, so they
        # are safe to display for debugging.
        record(
            name,
            "FAIL",
            f"expected 400/{expected_code}, got {resp.status_code} {body}",
        )


# ---------------------------------------------------------------------------
# 1. Contract model parsing (plan Sections 5.1 and 5.2)
# ---------------------------------------------------------------------------


def check_model_parsing() -> None:
    section("1. Contract model parsing (plan 5.1 / 5.2 examples)")
    try:
        IngestRequest.model_validate(copy.deepcopy(INGEST_LAB_EXAMPLE))
        record("model: plan 5.1 ingest lab example parses to IngestRequest", "PASS")
    except Exception as exc:  # noqa: BLE001
        record(
            "model: plan 5.1 ingest lab example parses to IngestRequest",
            "FAIL",
            f"{type(exc).__name__}: {exc}",
        )
    try:
        AskRequest.model_validate(copy.deepcopy(ASK_EXAMPLE))
        record("model: plan 5.2 ask example parses to AskRequest", "PASS")
    except Exception as exc:  # noqa: BLE001
        record(
            "model: plan 5.2 ask example parses to AskRequest",
            "FAIL",
            f"{type(exc).__name__}: {exc}",
        )


# ---------------------------------------------------------------------------
# 2. Rejection rules through the HTTP endpoint
# ---------------------------------------------------------------------------


def check_rejection_rules() -> None:
    section("2. Rejection rules via POST /rag/ingest (expect 400 + documented code)")

    payload = _rejection_payload()
    del payload["patient_id"]
    check_http_rejection("http: missing patient_id -> 400 invalid_request", payload, "invalid_request")

    payload = _rejection_payload()
    payload["ocr_output"]["raw_text"] = "   \n\t  "
    check_http_rejection("http: whitespace-only raw_text -> 400 empty_text", payload, "empty_text")

    payload = _rejection_payload()
    payload["user_selected_type"] = "report"
    check_http_rejection("http: user_selected_type 'report' -> 400 invalid_request", payload, "invalid_request")

    payload = _rejection_payload()
    payload["uploaded_at"] = "not-a-datetime"
    check_http_rejection("http: uploaded_at not a datetime -> 400 invalid_request", payload, "invalid_request")

    payload = _rejection_payload()
    payload["session_report_data"] = {"full_report_text": "Fictional session report text."}
    check_http_rejection(
        "http: both ocr_output and session_report_data -> 400 invalid_request",
        payload,
        "invalid_request",
    )

    payload = _rejection_payload()
    del payload["ocr_output"]
    check_http_rejection(
        "http: neither ocr_output nor session_report_data -> 400 invalid_request",
        payload,
        "invalid_request",
    )

    payload = _rejection_payload()
    payload["user_selected_type"] = "session_report"
    check_http_rejection(
        "http: session_report with ocr_output -> 400 invalid_request",
        payload,
        "invalid_request",
    )

    payload = _rejection_payload()
    del payload["ocr_output"]
    payload["user_selected_type"] = "session_report"
    check_http_rejection(
        "http: session_report with no source data -> 400 invalid_request",
        payload,
        "invalid_request",
    )

    payload = _rejection_payload()
    del payload["ocr_output"]
    payload["session_report_data"] = {"full_report_text": "Fictional session report text."}
    check_http_rejection(
        "http: lab_result with session_report_data -> 400 invalid_request",
        payload,
        "invalid_request",
    )

    payload = _rejection_payload()
    del payload["ocr_output"]
    payload["user_selected_type"] = "session_report"
    payload["session_report_data"] = {"full_report_text": "   ", "chief_complaint": ""}
    check_http_rejection(
        "http: session_report_data all-empty strings -> 400 empty_text",
        payload,
        "empty_text",
    )


# ---------------------------------------------------------------------------
# 3. Section 5.4 fixtures accepted (model level) + plain OCR unchanged
# ---------------------------------------------------------------------------


def check_section_54_fixtures() -> None:
    section("3. Plan 5.4 fixtures accepted (model level)")
    for name, fixture in (
        ("model: plan 5.4 structured-sections fixture accepted", SESSION_STRUCTURED_EXAMPLE),
        ("model: plan 5.4 full_report_text-only fixture accepted", SESSION_FULL_TEXT_EXAMPLE),
        ("model: plain OCR fixture (ocr_output) accepted unchanged", PLAIN_OCR_EXAMPLE),
    ):
        try:
            IngestRequest.model_validate(copy.deepcopy(fixture))
            record(name, "PASS")
        except Exception as exc:  # noqa: BLE001
            record(name, "FAIL", f"{type(exc).__name__}: {exc}")


# ---------------------------------------------------------------------------
# 4. Unknown extra fields ignored
# ---------------------------------------------------------------------------


def check_extra_fields() -> None:
    section("4. Unknown extra fields ignored")
    payload = copy.deepcopy(INGEST_LAB_EXAMPLE)
    payload["future_field"] = 123
    model_ok = False
    try:
        model = IngestRequest.model_validate(payload)
        model_ok = "future_field" not in model.model_dump()
    except Exception:  # noqa: BLE001
        model_ok = False

    resp = post_ingest(payload)
    http_ok = resp.status_code not in (400, 422)
    code = None
    try:
        code = resp.json().get("error", {}).get("code")
    except ValueError:
        http_ok = False
    # Phase 0: validation passes, handler answers 501 not_implemented.
    if model_ok and http_ok:
        record(
            "http+model: unknown extra top-level field ignored",
            "PASS",
        )
        info(f"extra-field ingest status: {resp.status_code}, code: {code}")
    else:
        record(
            "http+model: unknown extra top-level field ignored",
            "FAIL",
            f"model_ok={model_ok}, http status={resp.status_code}, code={code}",
        )


# ---------------------------------------------------------------------------
# 5. Auth
# ---------------------------------------------------------------------------


def check_auth() -> None:
    section("5. API key auth")
    resp = client.post("/rag/ingest", json=copy.deepcopy(INGEST_LAB_EXAMPLE))
    body = None
    try:
        body = resp.json()
    except ValueError:
        pass
    ok = resp.status_code == 401 and error_shape_ok(body) and body["error"]["code"] == "unauthorized"
    record(
        "auth: missing X-API-Key -> 401 with error format",
        "PASS" if ok else "FAIL",
        "" if ok else f"got {resp.status_code} {body}",
    )

    resp = client.post(
        "/rag/ingest",
        json=copy.deepcopy(INGEST_LAB_EXAMPLE),
        headers={"X-API-Key": "definitely-wrong-key"},
    )
    body = None
    try:
        body = resp.json()
    except ValueError:
        pass
    ok = resp.status_code == 401 and error_shape_ok(body) and body["error"]["code"] == "unauthorized"
    record(
        "auth: wrong X-API-Key -> 401",
        "PASS" if ok else "FAIL",
        "" if ok else f"got {resp.status_code} {body}",
    )

    resp = client.get("/health")
    ok = resp.status_code == 200
    record(
        "auth: GET /health without key -> 200",
        "PASS" if ok else "FAIL",
        "" if ok else f"got {resp.status_code}",
    )


# ---------------------------------------------------------------------------
# 6. Malformed JSON
# ---------------------------------------------------------------------------


def check_malformed_json() -> None:
    section("6. Malformed JSON body")
    resp = client.post(
        "/rag/ask",
        content=b"{not json",
        headers={**AUTH, "Content-Type": "application/json"},
    )
    body = None
    try:
        body = resp.json()
    except ValueError:
        pass
    ok = (
        resp.status_code == 400
        and resp.status_code != 422
        and error_shape_ok(body)
        and body["error"]["code"] == "invalid_request"
        and "{not json" not in resp.text
    )
    record(
        "http: malformed JSON -> 400 invalid_request (not 422), body text absent",
        "PASS" if ok else "FAIL",
        "" if ok else f"got {resp.status_code} {body}; body-text-leaked={('{not json' in resp.text)}",
    )


# ---------------------------------------------------------------------------
# 7. Fail-fast on missing required secret (subprocess with scrubbed env)
# ---------------------------------------------------------------------------

_CHILD_PROGRAM = r'''
import sys

from app.config import Settings

# Simulate "no .env present": point env_file at a path that does not exist.
# The real .env at the repository root must NOT be read by this subprocess.
Settings.model_config["env_file"] = r"%ENV_FILE%"

try:
    Settings()
except Exception as exc:
    print("EXC_CLASS:" + type(exc).__name__)
    print("MSG_START")
    print(str(exc))
    print("MSG_END")
    sys.exit(3)

print("SETTINGS_CREATED")
sys.exit(0)
'''

_MINIMAL_ENV_KEYS = (
    "SYSTEMROOT",
    "SYSTEMDRIVE",
    "COMSPEC",
    "PATHEXT",
    "WINDIR",
    "TEMP",
    "TMP",
    "NUMBER_OF_PROCESSORS",
    "PROCESSOR_ARCHITECTURE",
)


def check_fail_fast_secret() -> None:
    section("7. Fail-fast when a required secret is missing (subprocess)")
    tmp_dir = Path(tempfile.mkdtemp(prefix="careos_phase0_"))
    env = {key: os.environ[key] for key in _MINIMAL_ENV_KEYS if key in os.environ}
    env["PATH"] = os.environ.get("PATH", "")
    env["PYTHONPATH"] = str(REPO_ROOT)  # make the real app package importable
    env["PYTHONIOENCODING"] = "utf-8"

    program = _CHILD_PROGRAM.replace("%ENV_FILE%", (tmp_dir / "no_env_file_here").as_posix())
    try:
        proc = subprocess.run(
            [sys.executable, "-c", program],
            cwd=str(tmp_dir),
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
    except Exception as exc:  # noqa: BLE001
        record(
            "config: Settings() fails fast when required secret missing (subprocess)",
            "FAIL",
            f"subprocess did not run: {type(exc).__name__}",
        )
        return

    stdout = proc.stdout or ""
    stderr = proc.stderr or ""

    settings = get_settings()
    # Screen the child output for any real secret value BEFORE using it.
    # Values are compared but never printed.
    secrets_to_screen: list[tuple[str, str]] = [
        ("rag_api_key", settings.rag_api_key.get_secret_value()),
        ("qdrant_api_key", settings.qdrant_api_key.get_secret_value()),
        ("openrouter_api_key", settings.openrouter_api_key.get_secret_value()),
    ]
    leaked = [
        label
        for label, value in secrets_to_screen
        if value and value in stdout + stderr
    ] + (["qdrant_url"] if settings.qdrant_url and settings.qdrant_url in stdout + stderr else [])
    if leaked:
        record(
            "config: Settings() fails fast when required secret missing (subprocess)",
            "FAIL",
            f"secret value(s) appeared in subprocess output: {', '.join(leaked)}",
        )
        return

    message = ""
    if "MSG_START" in stdout and "MSG_END" in stdout:
        message = stdout.split("MSG_START", 1)[1].split("MSG_END", 1)[0].strip()
    exc_class = ""
    for line in stdout.splitlines():
        if line.startswith("EXC_CLASS:"):
            exc_class = line.split(":", 1)[1]
            break

    mentions_rag_api_key = "rag_api_key" in message.lower()
    created_unexpectedly = "SETTINGS_CREATED" in stdout
    ok = (
        proc.returncode == 3
        and exc_class == "ValidationError"
        and mentions_rag_api_key
        and not created_unexpectedly
    )
    if ok:
        mentioned = [name for name in ("rag_api_key", "qdrant_url") if name in message.lower()]
        record(
            "config: Settings() fails fast when required secret missing (subprocess)",
            "PASS",
        )
        info(
            "subprocess raised ValidationError; reported missing field names include: "
            + ", ".join(mentioned)
        )
    else:
        record(
            "config: Settings() fails fast when required secret missing (subprocess)",
            "FAIL",
            (
                f"returncode={proc.returncode}, exc_class={exc_class or '(none)'}, "
                f"mentions rag_api_key={mentions_rag_api_key}, "
                f"settings_created={created_unexpectedly}"
            ),
        )


# ---------------------------------------------------------------------------
# 8. Log hygiene
# ---------------------------------------------------------------------------


class _CaptureHandler(logging.Handler):
    def __init__(self, formatter: logging.Formatter) -> None:
        super().__init__(level=logging.DEBUG)
        self.setFormatter(formatter)
        self.lines: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        try:
            self.lines.append(self.format(record))
        except Exception:  # noqa: BLE001
            self.lines.append("UNFORMATTABLE_RECORD")


def _capture_logs_during_request() -> list[str]:
    from app.logging_config import JsonFormatter

    handler = _CaptureHandler(JsonFormatter())
    root = logging.getLogger()
    root.addHandler(handler)
    try:
        payload = copy.deepcopy(INGEST_LAB_EXAMPLE)
        payload["document_id"] = "doc_loghygiene_1"
        payload["ocr_output"]["raw_text"] = (
            "Fictional Lab Report\nCreatinine: 9.9\n" + LOG_MARKER
        )
        post_ingest(payload)
    finally:
        root.removeHandler(handler)
    return handler.lines


def check_log_hygiene() -> None:
    section("8. Log hygiene (no request body text in logs)")
    lines = _capture_logs_during_request()
    joined = "\n".join(lines)
    marker_absent = LOG_MARKER not in joined and "Creatinine" not in joined
    record(
        "logging: request body marker absent from all captured log lines",
        "PASS" if marker_absent else "FAIL",
        "" if marker_absent else "marker or patient text found in captured logs (not printed)",
    )

    parsed: list[dict] = []
    for line in lines:
        try:
            obj = json.loads(line)
            if isinstance(obj, dict):
                parsed.append(obj)
        except ValueError:
            continue
    request_lines = [
        obj
        for obj in parsed
        if obj.get("event") == "http_request" and obj.get("path") == "/rag/ingest"
    ]
    ok = False
    detail = "no http_request log line captured for /rag/ingest"
    if request_lines:
        last = request_lines[-1]
        keys = set(last.keys())
        ok = keys == LOG_ALLOWED_KEYS
        detail = f"http_request log line keys {sorted(keys)} != allowed {sorted(LOG_ALLOWED_KEYS)}"
    record(
        "logging: http_request line is JSON with keys limited to the safe set",
        "PASS" if ok else "FAIL",
        "" if ok else detail,
    )


# ---------------------------------------------------------------------------
# 9. FastEmbed supported model list [VERIFY check]
# ---------------------------------------------------------------------------


def _model_names(entries: list) -> set[str]:
    names: set[str] = set()
    for entry in entries:
        if isinstance(entry, dict):
            for key in ("model_name", "model"):
                if entry.get(key):
                    names.add(entry[key])
                    break
        else:
            value = getattr(entry, "model_name", None) or getattr(entry, "model", None)
            if value:
                names.add(value)
    return names


def check_fastembed_models() -> None:
    section("9. FastEmbed supported model list (listing only; no downloads)")
    try:
        import fastembed
        from fastembed import SparseTextEmbedding, TextEmbedding
    except Exception as exc:  # noqa: BLE001
        record(
            "fastembed: required models present in supported lists",
            "FAIL",
            f"fastembed import failed: {type(exc).__name__}",
        )
        return

    version = getattr(fastembed, "__version__", "unknown")
    try:
        dense_names = _model_names(TextEmbedding.list_supported_models())
    except Exception as exc:  # noqa: BLE001
        record(
            "fastembed: required models present in supported lists",
            "FAIL",
            f"TextEmbedding.list_supported_models() failed: {type(exc).__name__}",
        )
        return
    try:
        sparse_names = _model_names(SparseTextEmbedding.list_supported_models())
    except Exception as exc:  # noqa: BLE001
        record(
            "fastembed: required models present in supported lists",
            "FAIL",
            f"SparseTextEmbedding.list_supported_models() failed: {type(exc).__name__}",
        )
        return

    dense_target = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    sparse_target = "Qdrant/bm25"
    dense_found = dense_target in dense_names
    sparse_found = sparse_target in sparse_names

    dense_dim = None
    for entry in TextEmbedding.list_supported_models():
        entry_name = (
            (entry.get("model_name") or entry.get("model"))
            if isinstance(entry, dict)
            else getattr(entry, "model_name", None)
        )
        if entry_name == dense_target:
            dense_dim = (
                entry.get("dim") if isinstance(entry, dict) else getattr(entry, "dim", None)
            )
            break

    info(
        f"fastembed {version}: dense '{dense_target}': "
        f"{'FOUND' if dense_found else 'NOT FOUND'} (dim={dense_dim})"
    )
    info(f"fastembed {version}: sparse '{sparse_target}': {'FOUND' if sparse_found else 'NOT FOUND'}")
    if dense_found and sparse_found and dense_dim == 384:
        record("fastembed: required models present in supported lists", "PASS")
    else:
        # e5-small was verified unsupported on every fastembed version that
        # installs on Python 3.14; resolved by owner decision 2026-10-29:
        # switch to paraphrase-multilingual-MiniLM-L12-v2 (dim 384, read from
        # fastembed metadata).
        record(
            "fastembed: required models present in supported lists",
            "FAIL",
            (
                f"dense found={dense_found}, sparse found={sparse_found}, "
                f"dense dim={dense_dim} (expected 384 per owner decision)"
            ),
        )


# ---------------------------------------------------------------------------
# 10. Qdrant reachability (the ONLY check allowed to be SKIPPED)
# ---------------------------------------------------------------------------


def check_qdrant() -> None:
    global QDRANT_REACHABLE, QDRANT_SKIPPED
    section("10. Qdrant reachability")
    try:
        from qdrant_client import QdrantClient
    except Exception as exc:  # noqa: BLE001
        QDRANT_SKIPPED = True
        record("qdrant: reachable", "SKIPPED", f"qdrant_client import failed: {type(exc).__name__}")
        return

    settings = get_settings()
    api_key_value = settings.qdrant_api_key.get_secret_value()

    # Swallow ALL log output during this check: httpx/qdrant_client log lines
    # can embed the instance URL, which must never be printed.
    sink = logging.handlers.BufferingHandler(capacity=1000)
    sink.setLevel(logging.DEBUG)
    root = logging.getLogger()
    saved_handlers = root.handlers[:]
    saved_level = root.level
    root.handlers = [sink]
    qdrant_client_logger = logging.getLogger("qdrant_client")
    httpx_logger = logging.getLogger("httpx")
    saved_q_level, saved_h_level = qdrant_client_logger.level, httpx_logger.level
    qdrant_client_logger.setLevel(logging.CRITICAL)
    httpx_logger.setLevel(logging.CRITICAL)
    try:
        qc = QdrantClient(
            url=settings.qdrant_url,
            api_key=api_key_value or None,
            timeout=10,
        )
        try:
            collections = qc.get_collections()
            names = [getattr(c, "name", "?") for c in collections.collections]
            QDRANT_REACHABLE = True
            record("qdrant: reachable", "PASS", f"{len(names)} collection(s) visible (names not printed)")
        finally:
            try:
                qc.close()
            except Exception:  # noqa: BLE001
                pass
    except Exception as exc:  # noqa: BLE001
        QDRANT_SKIPPED = True
        # Exception CLASS NAME ONLY: never the URL, the key or the message.
        record("qdrant: reachable", "SKIPPED", f"qdrant unreachable -- {type(exc).__name__}")
    finally:
        root.handlers = saved_handlers
        root.setLevel(saved_level)
        qdrant_client_logger.setLevel(saved_q_level)
        httpx_logger.setLevel(saved_h_level)
        sink.close()


# ---------------------------------------------------------------------------
# 11. pytest suite (must run last and be included in the summary)
# ---------------------------------------------------------------------------


def check_pytest() -> None:
    section("11. pytest suite tests/phase_0")
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pytest", "tests/phase_0", "-q"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=600,
        )
    except Exception as exc:  # noqa: BLE001
        record("pytest: tests/phase_0 suite passes", "FAIL", f"pytest did not run: {type(exc).__name__}")
        return
    output = (proc.stdout or "") + (proc.stderr or "")
    tail = output.strip().splitlines()[-1] if output.strip() else "(no output)"
    if proc.returncode == 0:
        record("pytest: tests/phase_0 suite passes", "PASS")
    else:
        record("pytest: tests/phase_0 suite passes", "FAIL", f"exit={proc.returncode}; {tail}")
    print("---- pytest output ----")
    print(output.rstrip())
    print("-----------------------")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def main() -> int:
    print("CareOS Medical RAG - Phase 0 verification")
    print(f"python: {sys.version.split()[0]}  repo: {REPO_ROOT}")
    print("Checks are informational; settings values are never printed.")

    check_model_parsing()
    check_rejection_rules()
    check_section_54_fixtures()
    check_extra_fields()
    check_auth()
    check_malformed_json()
    check_fail_fast_secret()
    check_log_hygiene()
    check_fastembed_models()
    check_qdrant()
    check_pytest()

    passes = sum(1 for _, status, _ in RESULTS if status == "PASS")
    fails = sum(1 for _, status, _ in RESULTS if status == "FAIL")
    skips = sum(1 for _, status, _ in RESULTS if status == "SKIPPED")
    qdrant_state = "reachable" if QDRANT_REACHABLE else ("skipped" if QDRANT_SKIPPED else "failed")

    print()
    print("---- result table ----")
    for name, status, detail in RESULTS:
        line = f"{status:8s} {name}"
        if detail:
            line += f"  [{detail}]"
        print(line)
    print("----------------------")
    print(
        f"PHASE 0 VERIFICATION: {passes} PASS, {fails} FAIL, {skips} SKIPPED "
        f"(qdrant: {qdrant_state})"
    )
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
