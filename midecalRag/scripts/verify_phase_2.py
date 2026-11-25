"""Phase 2 verification: ingest endpoint, date resolution, versioned
replacement, crash recovery (plan Section E).

Run from the repository root:

    env/Scripts/python.exe scripts/verify_phase_2.py

Uses a dedicated TEST collection and a temp SQLite manifest DB (set via
environment BEFORE the app is imported). All data is fictional.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Test isolation FIRST (real env vars beat .env in pydantic-settings).
_TMP = tempfile.mkdtemp(prefix="careos_phase2_")
os.environ["COLLECTION_NAME"] = "careos_phase2_test"
os.environ["DB_URL"] = "sqlite:///" + _TMP.replace("\\", "/") + "/manifest.db"
os.environ["MAX_TEXT_CHARS"] = "400"
os.environ["EMBED_WARMUP_ON_STARTUP"] = "false"

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


def info(message: str) -> None:
    print(f"INFO: {message}")


def section(title: str) -> None:
    print()
    print(f"=== {title} ===")


from datetime import UTC, date, datetime, timedelta  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import manifest  # noqa: E402
from app.main import app  # noqa: E402
from app.services import vectorstore as vs  # noqa: E402
from app.services.ingest_pipeline import process_document  # noqa: E402
from app.services.resolver import resolve_doc_date, resolve_doc_type  # noqa: E402

SETTINGS = get_settings()
AUTH: dict[str, str] = {}
CLIENT: TestClient | None = None

TODAY = date(2026, 10, 29)


def _ingest(payload: dict, headers: dict | None = None):
    return CLIENT.post("/rag/ingest", json=payload, headers=headers or AUTH)


def _lab_payload(document_id: str = "doc_lab", lines: list[str] | None = None, **ocr_extra):
    lines = lines or [
        "Al-Borg Lab",
        "Date: 15/10/2026",
        "Renal Function:",
        "Creatinine: 1.8 mg/dL (0.6 - 1.2)",
        "Urea: 65 mg/dL (15 - 45)",
    ]
    return {
        "patient_id": "p_2",
        "document_id": document_id,
        "uploaded_at": "2026-10-24T10:30:00Z",
        "user_selected_type": "lab_result",
        "user_selected_date": None,
        "ocr_output": {
            "raw_text": "\n".join(lines),
            "lines": lines,
            "detected_doc_type": None,
            "extracted_date": "2026-10-15",
            **ocr_extra,
        },
    }


def _row(document_id: str):
    return manifest.get_document(document_id)


# ---------------------------------------------------------------------------
# 1-2. Resolver table (direct calls, deterministic clock)
# ---------------------------------------------------------------------------


def _resolve(**kwargs):
    base = dict(
        user_selected_date=None,
        extracted_date=None,
        raw_text="",
        uploaded_at=datetime(2026, 10, 24, 10, 30, tzinfo=UTC),
        is_session_report=False,
        today=TODAY,
    )
    base.update(kwargs)
    return resolve_doc_date(**base)


def check_date_resolution_table() -> None:
    section("1. Date resolution priority table")
    cases = [
        ("user date wins", dict(user_selected_date=date(2026, 1, 5), extracted_date="2026-10-15"), ("2026-01-05", "user")),
        ("ocr date when user null", dict(extracted_date="2026-10-15"), ("2026-10-15", "ocr")),
        ("text ISO date", dict(raw_text="Report\nDate: 2026-03-08"), ("2026-03-08", "text")),
        ("text 15/10/2026 day-first", dict(raw_text="Date: 15/10/2026"), ("2026-10-15", "text")),
        ("ambiguous 03/04/2026", dict(raw_text="Visit 03/04/2026"), ("2026-04-03", "text_ambiguous")),
        ("upload last resort", dict(), ("2026-10-24", "upload")),
        ("future ocr date ignored", dict(extracted_date="2027-01-01"), ("2026-10-24", "upload")),
        ("garbage ignored", dict(extracted_date="not-a-date", raw_text="nothing"), ("2026-10-24", "upload")),
        ("before 1900 ignored", dict(raw_text="1899-12-01 archive"), ("2026-10-24", "upload")),
    ]
    failures = []
    for name, kwargs, expected in cases:
        got = _resolve(**kwargs)
        if got != expected:
            failures.append(f"{name}: got {got}, want {expected}")
    record("9-case date resolution table matches the plan", not failures, "; ".join(failures))
    for name, kwargs, _expected in cases:
        info(f"  {name}: {_resolve(**kwargs)}")


def check_session_dates() -> None:
    section("2. Session-report date branch (D30, Africa/Cairo)")
    d1, s1 = _resolve(is_session_report=True, consultation_date="2026-10-20")
    record(
        "consultation_date wins over uploaded_at",
        (d1, s1) == ("2026-10-20", "consultation"),
        f"{d1}, {s1}",
    )
    d2, s2 = _resolve(
        is_session_report=True,
        approved_at=datetime(2026, 10, 23, 22, 30, tzinfo=UTC),
    )
    record(
        "approved_at 2026-10-23T22:30:00Z -> 2026-10-24 (Africa/Cairo)",
        (d2, s2) == ("2026-10-24", "approval"),
        f"{d2}, {s2}",
    )
    d3, s3 = _resolve(is_session_report=True)
    record(
        "upload fallback flagged approval_time; doc_date never text-parsed",
        (d3, s3) == ("2026-10-24", "approval_time"),
        f"{d3}, {s3}",
    )


def check_type_resolution() -> None:
    section("3. Type resolution + mismatch logging (ids only)")
    captured: list[logging.LogRecord] = []

    class Cap(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            captured.append(record)

    cap = Cap(level=logging.DEBUG)
    root = logging.getLogger()
    root.addHandler(cap)
    try:
        doc_type, mismatch = resolve_doc_type("lab_result", "prescription", document_id="doc_mismatch_1")
        resolve_doc_type("lab_result", "unknown_kind", document_id="doc_mismatch_2")
    finally:
        root.removeHandler(cap)

    text = " ".join(str(r.getMessage()) + str(r.__dict__) for r in captured)
    record(
        "user type wins; invalid OCR type ignored",
        doc_type == "lab_result" and not any(
            r for r in captured if "doc_mismatch_2" in str(r.getMessage())
        ),
    )
    record(
        "mismatch logged with document id, never text",
        mismatch and "doc_mismatch_1" in text and "Creatinine" not in text,
    )


# ---------------------------------------------------------------------------
# 4-7. HTTP ingest lifecycle against real Qdrant + SQLite
# ---------------------------------------------------------------------------


def check_http_ingest_and_points() -> None:
    section("4. POST /rag/ingest -> 202, manifest indexed, points in Qdrant")
    resp = _ingest(_lab_payload())
    body = resp.json()
    ok202 = resp.status_code == 202 and body == {"document_id": "doc_lab", "status": "processing"}
    record("202 with exact IngestAccepted body", ok202, f"got {resp.status_code} {body}")

    row = _row("doc_lab")
    record(
        "manifest row: indexed, child_count=4, date_source=ocr, doc_date=2026-10-15",
        row is not None
        and row.status == "indexed"
        and row.child_count == 4
        and row.date_source == "ocr"
        and row.doc_date == "2026-10-15"
        and row.source == "ocr"
        and row.dense_model == SETTINGS.dense_model,
        f"row={None if row is None else (row.status, row.child_count, row.date_source, row.doc_date, row.source)}",
    )
    points = vs.scroll_document("doc_lab", "p_2", client=None)
    versions = {p.payload.get("version") for p in points}
    expected_ids = {vs.point_id("doc_lab", row.version, i) for i in range(4)}
    got_ids = {str(p.id) for p in points}
    record(
        "exactly 4 points, all latest version, deterministic point ids",
        len(points) == 4 and versions == {row.version} and got_ids == expected_ids,
        f"count={len(points)}, versions={versions}",
    )


def check_idempotency_and_stale_removal() -> None:
    section("5. Idempotency + stale-chunk removal (P12)")
    _ingest(_lab_payload())  # same payload again
    row = _row("doc_lab")
    points = vs.scroll_document("doc_lab", "p_2")
    versions = {p.payload.get("version") for p in points}
    record(
        "re-ingest same payload: same child_count, single version, no dup ids",
        row.child_count == 4 and len(points) == 4 and versions == {row.version},
        f"count={len(points)}, manifest={row.child_count}, versions={versions}",
    )

    _ingest(_lab_payload(lines=[f"line {i}" for i in range(10)]))
    row10 = _row("doc_lab")
    _ingest(_lab_payload(lines=[f"line {i}" for i in range(3)]))
    row3 = _row("doc_lab")
    points = vs.scroll_document("doc_lab", "p_2")
    record(
        "10 children then 3: exactly 3 points remain (stale removed)",
        row10.child_count == 10 and row3.child_count == 3 and len(points) == 3,
        f"10-ingest={row10.child_count}, 3-ingest={row3.child_count}, points={len(points)}",
    )


def check_failure_safety() -> None:
    section("6. Failure safety: embedder fails on re-ingest -> old version intact")
    _ingest(_lab_payload(document_id="doc_fail", lines=["a", "b"]))
    before = vs.scroll_document("doc_fail", "p_2")
    record("baseline: 2 points searchable", len(before) == 2, f"got {len(before)}")

    class Boom:
        def chunk(self, request, doc_type, doc_date):
            from app.services.ingest_pipeline import Child

            return [
                Child(f"c{i}", f"c{i}", "p", f"{request.document_id}#p0", i) for i in range(6)
            ]

        def embed(self, texts):
            raise RuntimeError("simulated embedder crash")

    from app.schemas.contract import IngestRequest

    request = IngestRequest.model_validate(
        _lab_payload(document_id="doc_fail", lines=["x", "y", "z"])
    )
    process_document(
        request, "lab_result", "2026-10-24", "upload", version="boom_version"
    , pipeline=Boom())
    after = vs.scroll_document("doc_fail", "p_2")
    row = _row("doc_fail")
    record(
        "old 2 points still searchable; status=failed with short code",
        len(after) == 2 and row.status == "failed" and row.error_code == "ingest_failed",
        f"points={len(after)}, status={row.status}, code={row.error_code}",
    )


def check_concurrent_ingests() -> None:
    section("7. Two concurrent ingests of one id -> one consistent version")
    from app.schemas.contract import IngestRequest

    manifest.create_processing(
        document_id="doc_race", patient_id="p_2", version="race_v1", doc_type="lab_result",
        doc_date="2026-10-24", date_source="upload", upload_date="2026-10-24T10:30:00+00:00",
        source="ocr",
    )
    manifest.create_processing(
        document_id="doc_race", patient_id="p_2", version="race_v2", doc_type="lab_result",
        doc_date="2026-10-24", date_source="upload", upload_date="2026-10-24T10:30:00+00:00",
        source="ocr",
    )
    errors: list[str] = []

    def job(version_token: str, n: int) -> None:
        try:
            request = IngestRequest.model_validate(
                _lab_payload(document_id="doc_race", lines=[f"race {version_token} {i}" for i in range(n)])
            )
            process_document(request, "lab_result", "2026-10-24", "upload", version=version_token)
        except Exception as exc:  # noqa: BLE001
            errors.append(type(exc).__name__)

    threads = [
        threading.Thread(target=job, args=("race_v1", 4)),
        threading.Thread(target=job, args=("race_v2", 6)),
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    row = _row("doc_race")
    points = vs.scroll_document("doc_race", "p_2")
    point_versions = {p.payload.get("version") for p in points}
    record(
        "manifest and points end on ONE consistent version",
        not errors
        and row.status == "indexed"
        and point_versions == {row.version}
        and len(points) == row.child_count,
        f"errors={errors}, manifest_v={row.version}, point_v={point_versions}, "
        f"count={len(points)}, manifest_child={row.child_count}",
    )


def check_session_http() -> None:
    section("8. Session-report ingest through the same endpoint (D28)")
    payload = {
        "patient_id": "p_2",
        "document_id": "doc_session_1",
        "uploaded_at": "2026-10-24T11:05:00Z",
        "user_selected_type": "session_report",
        "user_selected_date": None,
        "session_report_data": {
            "chief_complaint": "Headache and dizziness for one week.",
            "history_of_present_illness": "Known hypertensive.",
            "assessment_and_diagnosis": "Hypertension, stage 1.",
            "treatment_plan": "Start Amlodipine 5 mg once daily.",
            "consultation_date": "2026-10-20",
        },
    }
    resp = _ingest(payload)
    row = _row("doc_session_1")
    record(
        "consultation_date becomes doc_date (never the upload date)",
        resp.status_code == 202
        and row.doc_date == "2026-10-20"
        and row.date_source == "consultation"
        and row.source == "session_agent",
        f"status={resp.status_code}, doc_date={row.doc_date if row else None}, "
        f"source={row.source if row else None}",
    )
    points = vs.scroll_document("doc_session_1", "p_2")
    record(
        "4 section children, one parent per document",
        len(points) == 4 and len({p.payload["parent_id"] for p in points}) == 1,
        f"points={len(points)}",
    )

    # (c) re-ingest with fewer sections -> only the new version remains
    payload["session_report_data"] = {
        "chief_complaint": "Follow-up headache.",
        "consultation_date": "2026-10-25",
    }
    _ingest(payload)
    row2 = _row("doc_session_1")
    points2 = vs.scroll_document("doc_session_1", "p_2")
    record(
        "re-ingest with fewer sections leaves exactly the new version",
        row2.child_count == 1 and len(points2) == 1 and row2.doc_date == "2026-10-25",
        f"child={row2.child_count}, points={len(points2)}, date={row2.doc_date}",
    )


def check_size_limits() -> None:
    section("9. empty_text (400) and text_too_large (413)")
    payload = _lab_payload(document_id="doc_empty")
    payload["ocr_output"]["raw_text"] = "   \n\t "
    resp = _ingest(payload)
    body = resp.json()
    record(
        "whitespace raw_text -> 400 empty_text",
        resp.status_code == 400 and body.get("error", {}).get("code") == "empty_text",
        f"got {resp.status_code} {body}",
    )
    payload = _lab_payload(document_id="doc_big")
    payload["ocr_output"]["raw_text"] = "x" * 401  # MAX_TEXT_CHARS=400 in this run
    resp = _ingest(payload)
    body = resp.json()
    record(
        "oversized text -> 413 text_too_large",
        resp.status_code == 413 and body.get("error", {}).get("code") == "text_too_large",
        f"got {resp.status_code} {body}",
    )


def check_recovery() -> None:
    section("10. Startup recovery of stuck processing rows (P13)")
    engine = None
    from app.db import get_engine
    from app.db.models import Document, utcnow_naive

    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(
            Document.__table__.insert().values(
                document_id="doc_stuck",
                patient_id="p_9",
                status="processing",
                version="stale_v",
                child_count=0,
                doc_type="lab_result",
                doc_date="2026-01-01",
                date_source="upload",
                upload_date="2026-01-01T00:00:00+00:00",
                source="ocr",
                updated_at=utcnow_naive() - timedelta(hours=2),
            )
        )
        conn.execute(
            Document.__table__.insert().values(
                document_id="doc_fresh",
                patient_id="p_9",
                status="processing",
                version="fresh_v",
                child_count=0,
                doc_type="lab_result",
                doc_date="2026-01-01",
                date_source="upload",
                upload_date="2026-01-01T00:00:00+00:00",
                source="ocr",
                updated_at=utcnow_naive(),
            )
        )
    recovered = manifest.recover_stuck(SETTINGS.recovery_stale_seconds)
    stuck = _row("doc_stuck")
    fresh = _row("doc_fresh")
    record(
        "stale row -> failed/stale_processing; fresh row untouched; app starts clean",
        recovered >= 1
        and stuck.status == "failed"
        and stuck.error_code == "stale_processing"
        and fresh.status == "processing",
        f"recovered={recovered}, stuck={stuck.status}, fresh={fresh.status}",
    )
    # Simulated restart: a fresh app instance boots with lifespan recovery.
    with TestClient(app) as boot_client:
        health = boot_client.get("/health").status_code
    record("app boots with recovery wired (lifespan) and /health ok", health == 200)


def check_pytest() -> None:
    section("11. pytest suite tests/phase_2")
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pytest", "tests/phase_2", "-q"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=600,
        )
    except Exception as exc:  # noqa: BLE001
        record("pytest: tests/phase_2 suite passes", False, f"did not run: {type(exc).__name__}")
        return
    output = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode == 0:
        record("pytest: tests/phase_2 suite passes", True)
    else:
        tail = output.strip().splitlines()[-1] if output.strip() else "(no output)"
        record("pytest: tests/phase_2 suite passes", False, f"exit={proc.returncode}; {tail}")
    print("---- pytest output ----")
    print(output.rstrip())
    print("-----------------------")


def cleanup() -> None:
    try:
        client = vs._client()
        client.delete_collection(SETTINGS.collection_name)
        client.close()
        info(f"test collection '{SETTINGS.collection_name}' deleted")
    except Exception:  # noqa: BLE001
        info("collection cleanup skipped")
    shutil.rmtree(_TMP, ignore_errors=True)


def main() -> int:
    global CLIENT, AUTH
    print("CareOS Medical RAG - Phase 2 verification")
    print(f"python: {sys.version.split()[0]}  repo: {REPO_ROOT}")
    print(f"test collection: {SETTINGS.collection_name} (temp manifest DB in {_TMP})")

    vs.ensure_collection(client=None)
    AUTH = {"X-API-Key": SETTINGS.rag_api_key.get_secret_value()}
    CLIENT = TestClient(app)
    try:
        check_date_resolution_table()
        check_session_dates()
        check_type_resolution()
        check_http_ingest_and_points()
        check_idempotency_and_stale_removal()
        check_failure_safety()
        check_concurrent_ingests()
        check_session_http()
        check_size_limits()
        check_recovery()
        check_pytest()
    finally:
        cleanup()

    passes = sum(1 for _, s, _ in RESULTS if s == "PASS")
    fails = sum(1 for _, s, _ in RESULTS if s == "FAIL")
    print()
    print("---- result table ----")
    for name, status, detail in RESULTS:
        line = f"{status:8s} {name}"
        if detail and status == "FAIL":
            line += f"  [{detail}]"
        print(line)
    print("----------------------")
    print(f"PHASE 2 VERIFICATION: {passes} PASS, {fails} FAIL")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
