"""Phase 7 verification: patient summary / doctor brief (POST /rag/patient-summary).

Run from the repository root:

    env/Scripts/python.exe scripts/verify_phase_7.py

Record collection runs against the REAL Qdrant Cloud test collection and the
real embedding model; generation runs through a scripted fake LLM so every
check is deterministic. A separate optional smoke test calls the real provider
chain and is reported on its own.

All patients/documents are fictional. Settings values and secrets are never
printed, and no patient text is logged.
"""

from __future__ import annotations

import io
import json
import logging
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path
from types import SimpleNamespace

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

_TMP = tempfile.mkdtemp(prefix="careos_phase7_")
os.environ["COLLECTION_NAME"] = "careos_phase7_test"
os.environ["DB_URL"] = "sqlite:///" + _TMP.replace("\\", "/") + "/manifest.db"
os.environ["EMBED_WARMUP_ON_STARTUP"] = "false"
os.environ["EMBED_BATCH_SIZE"] = "16"
os.environ["QUERY_EXPANSION_ENABLED"] = "false"
os.environ.setdefault("QDRANT_RETRY_ATTEMPTS", "2")
os.environ.setdefault("QDRANT_RETRY_WAIT_SECONDS", "0.2")

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


def measure(name: str, ok: bool, detail: str = "") -> None:
    status = "PASS" if ok else "WARN"
    RESULTS.append((name, status, detail))
    suffix = f" -- {detail}" if detail else ""
    print(f"{status}: {name}{suffix}")


def info(message: str) -> None:
    print(f"INFO: {message}")


def section(title: str) -> None:
    print()
    print(f"=== {title} ===")


# ---------------------------------------------------------------------------
# Imports (after sys.path/env setup)
# ---------------------------------------------------------------------------

from fastapi.testclient import TestClient  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.contract import IngestRequest  # noqa: E402
from app.services import vectorstore as vs  # noqa: E402
from app.services.embedder import get_embedder  # noqa: E402
from app.services.ingest_pipeline import process_document  # noqa: E402
from app.services.llm.base import LlmChain, LlmResult  # noqa: E402
from app.services.llm.factory import get_llm_chain  # noqa: E402
from app.services.patient_summary import (  # noqa: E402
    build_patient_summary,
    collect_recent_records,
    parse_sections,
)
from app.services.prompt import NO_RECORDS_AR, NO_RECORDS_EN  # noqa: E402

SETTINGS = get_settings()
TEST_COLLECTION = SETTINGS.collection_name

MAIN = "p7_main"
OTHER = "p7_other"
EMPTY = "p7_empty"

CLIENT = None
EMBEDDER = None


# ---------------------------------------------------------------------------
# Fake LLM
# ---------------------------------------------------------------------------


class ScriptedProvider:
    name = "scripted"
    model = "scripted-model"

    def __init__(self, replies: list[object] | None = None, default: str = "") -> None:
        self.replies = list(replies or [])
        self.default = default
        self.calls: list[dict] = []

    def available(self) -> bool:
        return True

    def generate(self, messages, *, temperature=None, max_tokens=None, timeout=None):
        self.calls.append(
            {"messages": list(messages), "temperature": temperature, "max_tokens": max_tokens}
        )
        reply = self.replies.pop(0) if self.replies else self.default
        if isinstance(reply, BaseException):
            raise reply
        return LlmResult(
            text=reply,
            provider=self.name,
            model=self.model,
            latency_ms=2.0,
            prompt_tokens=len(" ".join(m.content for m in messages).split()),
            completion_tokens=len(reply.split()),
        )


def run(replies, *, patient=MAIN, language=None, filters=None, max_documents=None):
    provider = ScriptedProvider(replies)
    started = time.perf_counter()
    outcome = build_patient_summary(
        patient,
        filters,
        language,
        max_documents,
        chain=LlmChain([provider]),
    )
    elapsed = round(time.perf_counter() - started, 2)
    return outcome, provider, elapsed


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------


def _ingest_ocr(patient: str, document_id: str, doc_type: str, doc_date: str, lines: list[str]) -> None:
    payload = {
        "patient_id": patient,
        "document_id": document_id,
        "uploaded_at": "2026-11-20T09:00:00Z",
        "user_selected_type": doc_type,
        "user_selected_date": None,
        "ocr_output": {
            "raw_text": "\n".join(lines),
            "lines": lines,
            "detected_doc_type": None,
            "extracted_date": doc_date,
        },
    }
    process_document(
        IngestRequest.model_validate(payload),
        doc_type,
        doc_date,
        "ocr",
        version="v1",
        collection_name=TEST_COLLECTION,
        client=CLIENT,
    )


def _ingest_session(patient: str, document_id: str, doc_date: str, data: dict) -> None:
    payload = {
        "patient_id": patient,
        "document_id": document_id,
        "uploaded_at": "2026-11-20T09:00:00Z",
        "user_selected_type": "session_report",
        "user_selected_date": None,
        "session_report_data": data,
    }
    process_document(
        IngestRequest.model_validate(payload),
        "session_report",
        doc_date,
        "session_agent",
        version="v1",
        collection_name=TEST_COLLECTION,
        client=CLIENT,
    )


def seed() -> None:
    section("0. Seed synthetic patients (real ingest pipeline)")
    _ingest_ocr(
        MAIN,
        "doc_p7_main_rx",
        "prescription",
        "2026-11-01",
        [
            "Dr. Hassan Clinic",
            "Date: 2026-11-01",
            "Amlodipine 5 mg once daily",
            "Contact 01012345678 for follow up",
        ],
    )
    _ingest_ocr(
        MAIN,
        "doc_p7_main_lab_oct",
        "lab_result",
        "2026-10-15",
        ["Al-Borg Lab", "Date: 2026-10-15", "Renal Function:", "Creatinine: 1.8 mg/dL (0.6 - 1.2)"],
    )
    _ingest_ocr(
        MAIN,
        "doc_p7_main_lab_jun",
        "lab_result",
        "2026-06-01",
        ["Al-Borg Lab", "Date: 2026-06-01", "Renal Function:", "Creatinine: 1.3 mg/dL (0.6 - 1.2)"],
    )
    _ingest_ocr(
        MAIN,
        "doc_p7_main_report",
        "medical_report",
        "2026-08-20",
        [
            "Nephrology Report",
            "Date: 2026-08-20",
            "Findings:",
            "Mild renal impairment. Creatinine 1.5 mg/dL.",
        ],
    )
    _ingest_session(
        MAIN,
        "doc_p7_main_visit",
        "2026-09-01",
        {
            "chief_complaint": "Fatigue for two weeks",
            "assessment_and_diagnosis": "Stable chronic kidney disease",
            "treatment_plan": "Continue Amlodipine 5 mg",
            "consultation_date": "2026-09-01",
        },
    )
    _ingest_ocr(
        OTHER,
        "doc_p7_other_lab",
        "lab_result",
        "2026-10-10",
        ["Al-Borg Lab", "Date: 2026-10-10", "Renal Function:", "Creatinine: 3.4 mg/dL"],
    )
    info(f"seeded patients: {MAIN}, {OTHER} (+ empty patient {EMPTY})")
    for patient in (MAIN, OTHER, EMPTY):
        info(
            f"  {patient}: "
            f"{vs.count_for_patient(patient, collection_name=TEST_COLLECTION, client=CLIENT)} points"
        )


# ---------------------------------------------------------------------------
# 1. record collection
# ---------------------------------------------------------------------------


def check_collection() -> None:
    section("1. Record collection (real Qdrant, newest first, per type)")
    records = collect_recent_records(MAIN, None)
    info(
        "records: "
        + ", ".join(f"{i}:{r.doc_type}/{r.doc_date}/{r.document_id}" for i, r in enumerate(records, 1))
    )
    types = {record.doc_type for record in records}
    documents = {record.document_id for record in records}
    record(
        "collect: every document type of the patient is represented",
        types >= {"prescription", "lab_result", "medical_report", "session_report"},
        str(sorted(types)),
    )
    record(
        "collect: newest first",
        [r.doc_date for r in records] == sorted((r.doc_date for r in records), reverse=True),
    )
    record(
        "collect: only this patient's documents",
        all(document.startswith("doc_p7_main_") for document in documents),
        str(sorted(documents)),
    )
    record(
        "collect: capped by SUMMARY_MAX_DOCUMENTS",
        len(documents) <= SETTINGS.summary_max_documents,
        f"{len(documents)} > {SETTINGS.summary_max_documents}",
    )
    record(
        "collect: every record carries a parent text and a snippet",
        all(r.parent_text and r.snippet for r in records),
    )

    filtered = collect_recent_records(MAIN, {"doc_type": "lab_result"})
    record(
        "collect: hard doc_type filter respected",
        {r.doc_type for r in filtered} == {"lab_result"} and filtered,
        str(sorted({r.doc_type for r in filtered})),
    )
    recent = collect_recent_records(MAIN, {"date_from": "2026-10-01"})
    record(
        "collect: hard date_from filter respected",
        all(r.doc_date >= "2026-10-01" for r in recent) and recent,
        str(sorted({r.doc_date for r in recent})),
    )
    record(
        "collect: empty patient yields no records",
        collect_recent_records(EMPTY, None) == [],
    )


# ---------------------------------------------------------------------------
# 2. brief generation
# ---------------------------------------------------------------------------


def _brief_for(records, *, rx_index: int, lab_index: int) -> str:
    return (
        f"MEDICATIONS:\n- Amlodipine 5 mg once daily [{rx_index}]\n"
        f"LABS:\n- Creatinine 1.8 mg/dL on 2026-10-15 [{lab_index}]\n"
        "REPORTS:\nNone documented.\n"
        "VISITS:\nNone documented.\n"
    )


def check_brief() -> None:
    section("2. Grounded brief (real records, scripted LLM)")
    records = collect_recent_records(MAIN, None)
    rx_index = next(i for i, r in enumerate(records, 1) if r.doc_type == "prescription")
    lab_index = next(i for i, r in enumerate(records, 1) if r.doc_type == "lab_result")
    outcome, provider, elapsed = run([_brief_for(records, rx_index=rx_index, lab_index=lab_index)])
    info(
        f"status={outcome.status} sections={[s.key for s in outcome.sections]} "
        f"documents={outcome.document_count} sources={len(outcome.sources)} "
        f"timings={outcome.timings_ms} tokens={outcome.tokens} wall={elapsed}s"
    )
    record("brief: status ok", outcome.status == "ok", outcome.status)
    record("brief: one LLM call (no retry)", len(provider.calls) == 1)
    record(
        "brief: sections follow the fixed order",
        [s.key for s in outcome.sections] == ["medications", "labs"],
        str([s.key for s in outcome.sections]),
    )
    record(
        "brief: Arabic titles by default",
        [s.title for s in outcome.sections] == ["الأدوية الحالية", "أحدث التحاليل"],
        str([s.title for s in outcome.sections]),
    )
    record(
        "brief: citation markers stripped from the content",
        all("[" not in s.content for s in outcome.sections),
        str([s.content for s in outcome.sections]),
    )
    record(
        "brief: medication section cites the prescription",
        [s.document_id for s in outcome.sections[0].sources] == ["doc_p7_main_rx"],
        str([s.document_id for s in outcome.sections[0].sources]),
    )
    record(
        "brief: lab section cites a lab document",
        all(s.document_id.startswith("doc_p7_main_lab") for s in outcome.sections[1].sources),
        str([s.document_id for s in outcome.sections[1].sources]),
    )
    record(
        "brief: top-level sources are deduplicated",
        len([s.document_id for s in outcome.sources])
        == len({s.document_id for s in outcome.sources}),
    )
    record(
        "brief: every source belongs to this patient",
        all(s.document_id.startswith("doc_p7_main_") for s in outcome.sources),
    )
    record(
        "brief: timings recorded for every stage",
        all(key in outcome.timings_ms for key in ("collect_ms", "context_ms", "generation_ms", "total_ms")),
        str(sorted(outcome.timings_ms)),
    )


def check_language() -> None:
    section("3. Language handling")
    records = collect_recent_records(MAIN, None)
    rx_index = next(i for i, r in enumerate(records, 1) if r.doc_type == "prescription")
    brief = f"MEDICATIONS:\n- Amlodipine 5 mg once daily [{rx_index}]\n"
    outcome, provider, _ = run([brief], language="en")
    record(
        "language: English titles and prompt when requested",
        outcome.sections
        and outcome.sections[0].title == "Current medications"
        and "Write in English" in provider.calls[0]["messages"][0].content,
        outcome.sections[0].title if outcome.sections else "no sections",
    )
    outcome, provider, _ = run([brief], language="ar")
    record(
        "language: Arabic by default",
        "Write in Arabic" in provider.calls[0]["messages"][0].content,
    )


def check_citations() -> None:
    section("4. Strict citations and hallucination handling")
    records = collect_recent_records(MAIN, None)
    lab_index = next(i for i, r in enumerate(records, 1) if r.doc_type == "lab_result")
    brief = f"LABS:\n- Creatinine 1.8 mg/dL on 2026-10-15 [{lab_index}] and an extra claim [99]\n"
    outcome, _, _ = run([brief])
    record("citations: hallucinated [99] dropped and counted", outcome.hallucinated_citations == 1, str(outcome.hallucinated_citations))
    record("citations: valid citation still resolved", bool(outcome.sections[0].sources))
    record("citations: markers removed", "[" not in outcome.sections[0].content, outcome.sections[0].content)

    brief = "LABS:\n- Creatinine 1.8 mg/dL on 2026-10-15\n"
    outcome, _, _ = run([brief])
    record(
        "citations: uncited section falls back to its own doc type",
        outcome.sections
        and all(s.document_id.startswith("doc_p7_main_lab") for s in outcome.sections[0].sources),
        str([s.document_id for s in outcome.sections[0].sources]),
    )


def check_verification() -> None:
    section("5. Post-generation verification")
    bad = "LABS:\n- Creatinine 9.9 mg/dL on 2026-10-15\n"
    outcome, provider, _ = run([bad, bad])
    record("verification: two failures withhold the brief", outcome.status == "verification_failed", outcome.status)
    record("verification: sections are empty when withheld", outcome.sections == [])
    record("verification: sources still listed for review", bool(outcome.sources), str(len(outcome.sources)))
    record("verification: exactly two LLM calls", len(provider.calls) == 2, str(len(provider.calls)))
    record(
        "verification: retry carries the stricter instruction",
        "Use ONLY numbers" in provider.calls[1]["messages"][0].content,
    )
    info(f"withheld message: {outcome.message[:80]}")

    outcome, _, _ = run([bad, "LABS:\n- Creatinine 1.8 mg/dL on 2026-10-15\n"])
    record(
        "verification: a corrected retry is accepted",
        outcome.status == "ok" and outcome.regenerated is True,
        f"{outcome.status} regenerated={outcome.regenerated}",
    )

    outcome, _, _ = run(["The patient seems fine overall.", "Still just prose."])
    record(
        "verification: unstructured prose is never accepted as a brief",
        outcome.status == "verification_failed" and outcome.sections == [],
        outcome.status,
    )


def check_empty_patient() -> None:
    section("6. Empty patient: localized message, no LLM call")
    for language, expected in (("ar", NO_RECORDS_AR), ("en", NO_RECORDS_EN)):
        outcome, provider, _ = run([], patient=EMPTY, language=language)
        record(
            f"empty ({language}): message, empty sections/sources, no LLM call",
            outcome.status == "no_records"
            and outcome.message == expected
            and outcome.sections == []
            and outcome.sources == []
            and provider.calls == [],
            f"status={outcome.status} calls={len(provider.calls)}",
        )


def check_privacy() -> None:
    section("7. De-identification and context budget")
    records = collect_recent_records(MAIN, None)
    rx_index = next(i for i, r in enumerate(records, 1) if r.doc_type == "prescription")
    outcome, provider, _ = run([f"MEDICATIONS:\n- Amlodipine 5 mg once daily [{rx_index}]\n"])
    user = provider.calls[0]["messages"][1].content
    record("privacy: patient phone removed before the call", "01012345678" not in user)
    record("privacy: redaction placeholder present", "[REDACTED_PHONE]" in user)
    record("privacy: clinical content preserved", "Amlodipine 5 mg" in user)
    record(
        "privacy: context stays inside SUMMARY_MAX_CHARS",
        len(user) <= SETTINGS.summary_max_chars + 400,
        f"{len(user)} > {SETTINGS.summary_max_chars + 400}",
    )
    info(
        "KNOWN LIMITATION: free-text names are not removed by the scrubber "
        "(documented in deidentify.py and PROGRESS.md; O1 decision pending)"
    )


def check_isolation() -> None:
    section("8. Cross-patient isolation")
    records = collect_recent_records(MAIN, None)
    rx_index = next(i for i, r in enumerate(records, 1) if r.doc_type == "prescription")
    # A malicious/hallucinating model tries to cite a block far outside the context.
    outcome, _, _ = run([f"MEDICATIONS:\n- Amlodipine 5 mg once daily [{rx_index}] [42]\n"])
    cited = {s.document_id for s in outcome.sources}
    record(
        "isolation: patient A never cites patient B",
        all(document.startswith("doc_p7_main_") for document in cited),
        str(sorted(cited)),
    )
    other_records = collect_recent_records(OTHER, None)
    record(
        "isolation: patient B collects only its own documents",
        other_records and all(r.document_id.startswith("doc_p7_other_") for r in other_records),
        str(sorted({r.document_id for r in other_records})),
    )
    record(
        "isolation: patient A's records never include patient B's ids",
        all(r.document_id.startswith("doc_p7_main_") for r in records),
    )


def check_log_hygiene() -> None:
    section("9. Logs carry no patient text")
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setLevel(logging.DEBUG)
    root = logging.getLogger()
    previous = root.level
    root.setLevel(logging.DEBUG)
    root.addHandler(handler)
    try:
        records = collect_recent_records(MAIN, None)
        rx_index = next(i for i, r in enumerate(records, 1) if r.doc_type == "prescription")
        run([f"MEDICATIONS:\n- Amlodipine 5 mg once daily [{rx_index}]\n"])
    finally:
        root.removeHandler(handler)
        root.setLevel(previous)
    logs = stream.getvalue()
    record("logs: no medication text leaked", "Amlodipine" not in logs)
    record("logs: no patient phone leaked", "01012345678" not in logs)
    record("logs: no creatinine value leaked", "1.8 mg/dL" not in logs)
    record("logs: patient_summary_result line present", "patient_summary_result" in logs)


# ---------------------------------------------------------------------------
# 10. HTTP
# ---------------------------------------------------------------------------


def check_http() -> None:
    section("10. POST /rag/patient-summary (HTTP contract)")
    from app.api import routes
    from app.schemas.summary import PatientSummaryResponse

    stub = PatientSummaryResponse(
        status="ok",
        message="stub",
        sections=[],
        sources=[],
    )
    original = routes.build_patient_summary
    routes.build_patient_summary = lambda *args, **kwargs: SimpleNamespace(
        status=stub.status,
        message=stub.message,
        sections=stub.sections,
        sources=stub.sources,
        language="ar",
        provider="stub",
        document_count=0,
    )
    headers = {"X-API-Key": SETTINGS.rag_api_key.get_secret_value()}
    try:
        with TestClient(app) as client:
            response = client.post(
                "/rag/patient-summary", json={"patient_id": MAIN}, headers=headers
            )
            unauthorized = client.post("/rag/patient-summary", json={"patient_id": MAIN})
            client.app.state.model_guard_ok = False
            guarded = client.post(
                "/rag/patient-summary", json={"patient_id": MAIN}, headers=headers
            )
            client.app.state.model_guard_ok = None
            invalid = client.post(
                "/rag/patient-summary", json={"patient_id": ""}, headers=headers
            )
            extra = client.post(
                "/rag/patient-summary",
                json={"patient_id": MAIN, "future_field": 1, "language": "ar"},
                headers=headers,
            )
            bad_language = client.post(
                "/rag/patient-summary",
                json={"patient_id": MAIN, "language": "fr"},
                headers=headers,
            )
    finally:
        routes.build_patient_summary = original

    body = response.json()
    record("http: 200 for a valid summary request", response.status_code == 200, str(response.status_code))
    record(
        "http: body has exactly status/message/sections/sources",
        set(body) == {"status", "message", "sections", "sources"},
        str(sorted(body)),
    )
    record("http: missing API key -> 401", unauthorized.status_code == 401, str(unauthorized.status_code))
    record(
        "http: model guard preserved -> 503 model_mismatch",
        guarded.status_code == 503 and guarded.json()["error"]["code"] == "model_mismatch",
        f"{guarded.status_code} {guarded.text[:60]}",
    )
    record(
        "http: empty patient_id -> 400 invalid_request",
        invalid.status_code == 400 and invalid.json()["error"]["code"] == "invalid_request",
        str(invalid.status_code),
    )
    record("http: unknown fields ignored", extra.status_code == 200, str(extra.status_code))
    record(
        "http: unknown language -> 400 (validated by the schema)",
        bad_language.status_code == 400,
        str(bad_language.status_code),
    )


def check_parser() -> None:
    section("11. Heading parser")
    parsed = parse_sections(
        "**MEDICATIONS:**\n- A [1]\n### LABS:\n- B [2]\nREPORTS:\nNone documented.\n"
    )
    record(
        "parser: markdown headings tolerated, 'None documented' dropped",
        parsed == {"medications": "A [1]", "labs": "B [2]"},
        json.dumps(parsed, ensure_ascii=False),
    )
    record("parser: prose without headings yields nothing", parse_sections("free text") == {})


# ---------------------------------------------------------------------------
# 12. real provider smoke test
# ---------------------------------------------------------------------------


def check_real_provider() -> None:
    section("12. Real provider smoke test (optional)")
    chain = get_llm_chain()
    info(f"chain: {chain.name} available={chain.available}")
    if not chain.available:
        measure("real provider brief", False, "no provider key configured")
        return
    started = time.perf_counter()
    try:
        outcome = build_patient_summary(MAIN, None, "en", None, chain=chain)
    except Exception as exc:  # noqa: BLE001
        measure("real provider brief", False, f"{type(exc).__name__} (quota/availability)")
        return
    elapsed = round(time.perf_counter() - started, 2)
    info(
        f"real: status={outcome.status} provider={outcome.provider} "
        f"sections={[s.key for s in outcome.sections]} documents={outcome.document_count} "
        f"sources={len(outcome.sources)} tokens={outcome.tokens} wall={elapsed}s"
    )
    for summary_section in outcome.sections:
        info(f"real section [{summary_section.key}]: {summary_section.content[:180]}")
    measure(
        "real provider produces a grounded brief",
        outcome.status == "ok" and len(outcome.sections) >= 2,
        f"status={outcome.status} sections={len(outcome.sections)}",
    )
    measure(
        "real brief survived verification",
        outcome.status != "verification_failed",
        "verification withheld the real brief",
    )


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def cleanup() -> None:
    try:
        if CLIENT is not None:
            CLIENT.delete_collection(TEST_COLLECTION)
            info(f"deleted test collection '{TEST_COLLECTION}'")
    except Exception as exc:  # noqa: BLE001
        info(f"collection cleanup skipped: {type(exc).__name__}")
    finally:
        try:
            if CLIENT is not None:
                CLIENT.close()
        except Exception:  # noqa: BLE001
            pass
        shutil.rmtree(_TMP, ignore_errors=True)


def main() -> int:
    global CLIENT, EMBEDDER
    print("CareOS Medical RAG - Phase 7 verification (patient summary)")
    print(f"python: {sys.version.split()[0]}  repo: {REPO_ROOT}")
    print(f"test collection: {TEST_COLLECTION} (temp manifest DB in {_TMP})")
    print("Settings values and secrets are never printed.")

    EMBEDDER = get_embedder()
    EMBEDDER.load()
    CLIENT = vs.get_client()
    try:
        vs.ensure_collection(TEST_COLLECTION, client=CLIENT)
        seed()
        check_collection()
        check_brief()
        check_language()
        check_citations()
        check_verification()
        check_empty_patient()
        check_privacy()
        check_isolation()
        check_log_hygiene()
        check_http()
        check_parser()
        check_real_provider()
    finally:
        cleanup()

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
    print(f"PHASE 7 VERIFICATION: {passes} PASS, {warns} WARN, {fails} FAIL")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
