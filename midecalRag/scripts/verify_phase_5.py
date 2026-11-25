"""Phase 5 verification: hybrid retrieval, over-fetch, recency, parent dedupe.

Run from the repository root:

    env/Scripts/python.exe scripts/verify_phase_5.py

Uses a DEDICATED TEST collection against the real Qdrant Cloud (never the real
collection) and a temp SQLite manifest. All patients/documents are fictional.
Settings values and secrets are never printed.

Scenarios (plan Phase 5, section E):
  1. recency trap (20 prescriptions, newest worded least like the query)
  2. exact dose (Amlodipine 5mg must win)
  3. analyzer keyword table (EN + AR + the ambiguous "another drug" case)
  4. trend mode (window applied, oldest first)
  5. hard filters (doc_type / date_from) and soft-hint fallback
  6. parent deduplication
  7. relevance gate calibration (measured, not guessed)
  8. cross-patient isolation over 50 queries
  9. empty patient and live query-expansion behaviour
"""

from __future__ import annotations

import os
import random
import shutil
import sys
import tempfile
import time
import uuid
from contextlib import contextmanager
from datetime import date, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Test isolation FIRST (real env vars beat .env in pydantic-settings).
_TMP = tempfile.mkdtemp(prefix="careos_phase5_")
os.environ["COLLECTION_NAME"] = "careos_phase5_test"
os.environ["DB_URL"] = "sqlite:///" + _TMP.replace("\\", "/") + "/manifest.db"
os.environ["EMBED_WARMUP_ON_STARTUP"] = "false"
os.environ["EMBED_BATCH_SIZE"] = "16"
os.environ.setdefault("QDRANT_RETRY_ATTEMPTS", "2")
os.environ.setdefault("QDRANT_RETRY_WAIT_SECONDS", "0.2")
# Expansion must be OFF by default here: the retriever is exercised with an
# injected expander, and one explicit live call is made in its own check.
os.environ["QUERY_EXPANSION_ENABLED"] = "true"

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
    """Record a measured/quality result: weak values are WARN, not FAIL."""
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

from app.config import get_settings  # noqa: E402
from app.schemas.contract import IngestRequest, OptionalFilters  # noqa: E402
from app.services import retriever as retriever_module  # noqa: E402
from app.services import vectorstore as vs  # noqa: E402
from app.services.embedder import get_embedder  # noqa: E402
from app.services.ingest_pipeline import process_document  # noqa: E402
from app.services.normalizer import normalize  # noqa: E402
from app.services.query_analyzer import analyze_query  # noqa: E402
from app.services.query_expander import QueryExpander  # noqa: E402
from app.services.retriever import retrieve_debug  # noqa: E402

SETTINGS = get_settings()
TEST_COLLECTION = SETTINGS.collection_name
CLOCK = date(2026, 11, 23)

TRAP = "p5_trap"
DOSE = "p5_dose"
TREND = "p5_trend"
HINT = "p5_hint"
DEDUPE = "p5_dedupe"
GATE = "p5_gate"
ISO_A = "p5_iso_a"
ISO_B = "p5_iso_b"

CLIENT = None
EMBEDDER = None


class _NoExpansion:
    """Deterministic expander for every check except the live-provider one."""

    def expand(self, query: str):
        from app.services.query_expander import QueryExpansion

        cleaned = (query or "").strip()
        return QueryExpansion(original=cleaned, variants=[cleaned], source="disabled")


NO_EXPANSION = _NoExpansion()


@contextmanager
def floor(value: float):
    """Temporarily override RELEVANCE_FLOOR for the gate checks."""
    original = retriever_module.get_settings
    base = original()
    retriever_module.get_settings = lambda: base.model_copy(
        update={"relevance_floor": value}
    )
    try:
        yield
    finally:
        retriever_module.get_settings = original


# ---------------------------------------------------------------------------
# Ingest helpers
# ---------------------------------------------------------------------------


def _payload(patient: str, document_id: str, doc_type: str, doc_date: str, lines: list[str]) -> dict:
    return {
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


def ingest(patient: str, document_id: str, doc_type: str, doc_date: str, lines: list[str]) -> None:
    process_document(
        IngestRequest.model_validate(_payload(patient, document_id, doc_type, doc_date, lines)),
        doc_type,
        doc_date,
        "ocr",
        version="v1",
        collection_name=TEST_COLLECTION,
        client=CLIENT,
    )


def ingest_prescription(patient: str, document_id: str, doc_date: str, drug_lines: list[str]) -> None:
    ingest(
        patient,
        document_id,
        "prescription",
        doc_date,
        ["Dr. Hassan Clinic", f"Date: {doc_date}", *drug_lines],
    )


def ingest_lab(patient: str, document_id: str, doc_date: str, panel: list[str]) -> None:
    ingest(
        patient,
        document_id,
        "lab_result",
        doc_date,
        ["Al-Borg Lab", f"Date: {doc_date}", "Renal Function:", *panel],
    )


def run(patient: str, query: str, filters=None, *, expander=None, clock=CLOCK, **kwargs):
    return retrieve_debug(
        patient,
        query,
        filters,
        clock,
        expander=expander or NO_EXPANSION,
        embedder=EMBEDDER,
        **kwargs,
    )


def doc_ids(parents) -> list[str]:
    return [parent.document_id for parent in parents]


def show(debug, label: str) -> None:
    dates = ", ".join(f"{p.doc_date}" for p in debug.parents)
    info(
        f"{label}: mode={debug.mode} children={debug.candidate_children} "
        f"parents={debug.candidate_parents} gated={debug.gated_parents} "
        f"returned={len(debug.parents)} hint={debug.hint_used or '-'} "
        f"retry={debug.hint_retry} window={debug.effective_date_from or '-'} "
        f"dates=[{dates}] timings={debug.timings_ms}"
    )


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------


def seed() -> None:
    section("0. Seed synthetic patients through the real ingest pipeline")

    # --- recency trap: 19 near-duplicate old prescriptions + 1 sparse new one
    for index in range(19):
        doc_date = (date(2024, 1, 15) + timedelta(days=45 * index)).isoformat()
        ingest_prescription(
            TRAP,
            f"doc_p5_trap_{index:02d}",
            doc_date,
            [f"Losartan 50 mg for blood pressure medication, hypertension control plan {index}"],
        )
    # The newest prescription: dated 5 days before the clock, and worded the
    # least like the query (no "blood pressure", no "medication").
    ingest_prescription(TRAP, "doc_p5_trap_new", "2026-11-18", ["Amlodipine 5 mg once daily"])

    # --- exact dose
    ingest_prescription(DOSE, "doc_p5_dose_5mg", "2026-11-01", ["Amlodipine 5 mg once daily"])
    ingest_prescription(DOSE, "doc_p5_dose_10mg", "2026-11-01", ["Amlodipine 10 mg once daily"])
    ingest_prescription(DOSE, "doc_p5_dose_aten", "2026-11-01", ["Atenolol 50 mg once daily"])

    # --- trend: creatinine across four dates (two inside the 3-month window)
    ingest_lab(TREND, "doc_p5_trend_old", "2025-12-01", ["Creatinine: 1.1 mg/dL"])
    ingest_lab(TREND, "doc_p5_trend_jun", "2026-06-01", ["Creatinine: 1.3 mg/dL"])
    ingest_lab(TREND, "doc_p5_trend_sep", "2026-09-10", ["Creatinine: 1.6 mg/dL"])
    ingest_lab(TREND, "doc_p5_trend_nov", "2026-11-01", ["Creatinine: 1.9 mg/dL"])

    # --- soft-hint fallback: only a medical_report mentions creatinine
    ingest(
        HINT,
        "doc_p5_hint_report",
        "medical_report",
        "2026-11-05",
        ["Nephrology Report", "Date: 2026-11-05", "Findings:", "Creatinine: 1.8 mg/dL"],
    )

    # --- parent dedupe: one lab document, two matching children in one parent
    ingest_lab(
        DEDUPE,
        "doc_p5_dedupe",
        "2026-10-20",
        ["Creatinine: 1.4 mg/dL", "Urea: 55 mg/dL"],
    )

    # --- relevance gate: creatinine labs only (no HbA1c anywhere)
    ingest_lab(GATE, "doc_p5_gate_oct", "2026-10-01", ["Creatinine: 1.2 mg/dL"])
    ingest_lab(GATE, "doc_p5_gate_nov", "2026-11-01", ["Creatinine: 1.5 mg/dL"])

    # --- isolation: two patients with identical text
    for patient, prefix in ((ISO_A, "a"), (ISO_B, "b")):
        ingest_lab(
            patient,
            f"doc_p5_iso{prefix}_1",
            "2026-11-02",
            ["Creatinine: 2.0 mg/dL", "Urea: 70 mg/dL"],
        )
        ingest_prescription(
            patient,
            f"doc_p5_iso{prefix}_2",
            "2026-10-05",
            ["Amlodipine 5 mg once daily for blood pressure"],
        )

    patients = (TRAP, DOSE, TREND, HINT, DEDUPE, GATE, ISO_A, ISO_B)
    info(f"seeded {len(patients)} patients into '{TEST_COLLECTION}'")
    for patient in patients:
        info(f"  {patient}: {vs.count_for_patient(patient, collection_name=TEST_COLLECTION, client=CLIENT)} points")


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


def check_config() -> None:
    section("1. Configuration contract")
    record(
        "WIDE_K inside the plan's 30..50 over-fetch band",
        30 <= SETTINGS.wide_k <= 50,
        str(SETTINGS.wide_k),
    )
    record("FINAL_PARENTS equals 5", SETTINGS.final_parents == 5, str(SETTINGS.final_parents))
    record(
        "recency weight and decay come from configuration",
        SETTINGS.recency_weight > 0 and SETTINGS.recency_decay_days > 0,
        f"w={SETTINGS.recency_weight} d={SETTINGS.recency_decay_days}",
    )
    record(
        "retriever never references upload time",
        "upload_date" not in Path(retriever_module.__file__).read_text(encoding="utf-8")
        and "uploaded_at" not in Path(retriever_module.__file__).read_text(encoding="utf-8"),
    )
    record(
        "expansion is provider-driven (OpenRouter primary, Gemini fallback)",
        QueryExpander(enabled=True).available("openrouter"),
        "openrouter key present",
    )


def check_recency_trap() -> None:
    section("2. Recency trap (P5) - over-fetch then chronological re-rank")
    query = "latest blood pressure medication"

    # Baseline: the naive "fetch 5 by fused score, then sort by date" approach.
    dense, sparse = EMBEDDER.embed_query(normalize(query))
    naive = vs.hybrid_search(
        TRAP,
        dense,
        vs.make_sparse_vector(sparse[0], sparse[1]),
        limit=5,
        collection_name=TEST_COLLECTION,
        client=CLIENT,
    )
    naive_ids = [point.payload["document_id"] for point in naive]
    info(f"naive top-5 by fused score: {naive_ids}")
    measure(
        "naive fetch-5-then-sort misses the newest prescription (proves the test)",
        "doc_p5_trap_new" not in naive_ids,
        "naive baseline happened to include the newest document",
    )

    full = vs.hybrid_search(
        TRAP,
        dense,
        vs.make_sparse_vector(sparse[0], sparse[1]),
        limit=SETTINGS.wide_k,
        collection_name=TEST_COLLECTION,
        client=CLIENT,
    )
    full_ids = [point.payload["document_id"] for point in full]
    rank = full_ids.index("doc_p5_trap_new") + 1 if "doc_p5_trap_new" in full_ids else None
    info(f"newest prescription fused rank: {rank} of {len(full_ids)}")

    debug = run(TRAP, query)
    show(debug, "latest mode")
    record("recency trap: mode is latest", debug.mode == "latest", debug.mode)
    record(
        "recency trap: newest parent is present",
        "doc_p5_trap_new" in doc_ids(debug.parents),
        str(doc_ids(debug.parents)),
    )
    record(
        "recency trap: newest parent ranks FIRST",
        bool(debug.parents) and debug.parents[0].document_id == "doc_p5_trap_new",
        str(doc_ids(debug.parents[:2])),
    )
    record(
        "recency trap: newest date is the maximum",
        bool(debug.parents)
        and debug.parents[0].doc_date == max(p.doc_date for p in debug.parents),
    )
    record(
        "recency trap: no parent is returned twice",
        len(doc_ids(debug.parents)) == len(set(doc_ids(debug.parents))),
    )


def check_exact_dose() -> None:
    section("3. Exact dose matching (P10, query side)")
    debug = run(DOSE, "Amlodipine 5mg")
    show(debug, "dose query")
    record("dose: mode is normal", debug.mode == "normal", debug.mode)
    record(
        "dose: Amlodipine 5 mg parent ranks first",
        bool(debug.parents) and debug.parents[0].document_id == "doc_p5_dose_5mg",
        str(doc_ids(debug.parents)),
    )
    record(
        "dose: 10 mg parent is not first",
        bool(debug.parents) and debug.parents[0].document_id != "doc_p5_dose_10mg",
    )


def check_analyzer_table() -> None:
    section("4. Analyzer keyword table (EN + AR + ambiguous Arabic)")
    cases = [
        ("latest creatinine", "latest"),
        ("most recent creatinine", "latest"),
        ("current blood pressure medication", "latest"),
        ("newest lab", "latest"),
        ("اخر تحليل كرياتينين", "latest"),
        ("احدث اشعة", "latest"),
        ("الحالي", "latest"),
        ("how did creatinine change", "trend"),
        ("show the trend over time", "trend"),
        ("compare creatinine values", "trend"),
        ("history of creatinine", "trend"),
        ("تغير الكرياتينين", "trend"),
        ("مقارنه بين التحاليل", "trend"),
        ("creatinine value in October", "normal"),
        ("creatinine", "normal"),
        ("patient phone number", "normal"),
    ]
    failures = []
    for query, expected in cases:
        actual = analyze_query(query, CLOCK).mode
        if actual != expected:
            failures.append(f"{query!r}: expected {expected}, got {actual}")
    record(
        f"analyzer: {len(cases)} EN/AR keyword cases classified",
        not failures,
        "; ".join(failures),
    )

    # The ambiguous Arabic "another drug" (دواء آخر) is a documented limitation:
    # after normalization it contains "اخر", so it is detected as latest. The
    # plan accepts this as a hint and asks for the outcome to be recorded.
    ambiguous = analyze_query("هل اخد دواء اخر", CLOCK)
    info(
        "ambiguous Arabic 'دواء اخر' -> "
        f"latest={ambiguous.latest} mode={ambiguous.mode} (recorded limitation)"
    )
    record(
        "analyzer: inferred window uses the injected clock",
        analyze_query("creatinine over the last 3 months", CLOCK).date_from == "2026-08-25",
    )
    record(
        "analyzer: soft doc_type hint is advisory",
        analyze_query("latest creatinine", CLOCK).soft_doc_type == "lab_result",
    )


def check_trend() -> None:
    section("5. Trend mode: window applied, oldest first (P14)")
    query = "how did creatinine change over the last 3 months"
    debug = run(TREND, query)
    show(debug, "trend mode")
    record("trend: mode is trend", debug.mode == "trend", debug.mode)
    record(
        "trend: inferred window is 2026-08-25",
        debug.effective_date_from == "2026-08-25",
        str(debug.effective_date_from),
    )
    dates = [p.doc_date for p in debug.parents]
    record("trend: older documents are excluded", all(d >= "2026-08-25" for d in dates), str(dates))
    record("trend: oldest first", dates == sorted(dates), str(dates))
    record(
        "trend: both in-window documents are represented",
        {d for d in dates} == {"2026-09-10", "2026-11-01"},
        str(sorted(set(dates))),
    )


def check_filters() -> None:
    section("6. Hard filters and soft-hint fallback (D24)")

    # hard doc_type: the trap patient has prescriptions only
    debug = run(TRAP, "creatinine", OptionalFilters(doc_type="lab_result"))
    record(
        "hard doc_type: lab_result excludes every prescription",
        debug.parents == [],
        str(doc_ids(debug.parents)),
    )
    debug = run(TRAP, "blood pressure medication", OptionalFilters(doc_type="prescription"))
    record(
        "hard doc_type: prescription keeps prescriptions",
        len(debug.parents) > 0
        and all(p.doc_type == "prescription" for p in debug.parents),
        str({p.doc_type for p in debug.parents}),
    )

    # hard date_from
    debug = run(
        TRAP,
        "blood pressure medication",
        OptionalFilters(date_from=date(2026, 4, 1)),
    )
    show(debug, "explicit date_from")
    record(
        "hard date_from: every parent is on/after the filter",
        all(p.doc_date >= "2026-04-01" for p in debug.parents) and debug.parents != [],
        str([p.doc_date for p in debug.parents]),
    )

    # explicit date_from beats the inferred window
    debug = run(
        TREND,
        "how did creatinine change over the last 3 months",
        OptionalFilters(date_from=date(2026, 11, 1)),
    )
    record(
        "explicit date_from overrides the inferred window",
        debug.effective_date_from == "2026-11-01"
        and all(p.doc_date >= "2026-11-01" for p in debug.parents),
        str(debug.effective_date_from),
    )

    # soft hint fallback: the hint hides the only relevant document
    debug = run(HINT, "latest creatinine")
    show(debug, "hint fallback")
    record(
        "soft hint: first attempt uses the lab_result hint",
        debug.hint_used == "lab_result",
        str(debug.hint_used),
    )
    record("soft hint: retried without the hint", debug.hint_retry is True)
    record(
        "soft hint: the medical_report is returned after the retry",
        set(doc_ids(debug.parents)) == {"doc_p5_hint_report"} and debug.parents != [],
        str(doc_ids(debug.parents)),
    )


def check_parent_dedupe() -> None:
    section("7. Parent deduplication (P8, part 2)")
    points = vs.scroll_document(
        "doc_p5_dedupe", DEDUPE, collection_name=TEST_COLLECTION, client=CLIENT
    )
    by_parent: dict[str, int] = {}
    for point in points:
        parent_id = point.payload["parent_id"]
        by_parent[parent_id] = by_parent.get(parent_id, 0) + 1
    info(f"document children per parent: {by_parent}")

    debug = run(DEDUPE, "creatinine urea")
    show(debug, "dedupe")
    parent_ids = [p.parent_id for p in debug.parents]
    record(
        "dedupe: one parent per parent_id",
        len(parent_ids) == len(set(parent_ids)),
        str(parent_ids),
    )
    # The panel parent holds two matching children (Creatinine + Urea); the
    # preamble parent ("Al-Borg Lab / Date") is a separate, legitimate parent.
    panels = [p for p in debug.parents if "Renal Function" in p.parent_text]
    record(
        "dedupe: the panel parent appears exactly once",
        len(panels) == 1,
        str([p.parent_id for p in panels]),
    )
    record(
        "dedupe: its two matching children collapsed into that one parent",
        bool(panels) and by_parent.get(panels[0].parent_id) == 2,
        str(by_parent),
    )
    record(
        "dedupe: the citation snippet comes from the best child",
        bool(panels) and bool(panels[0].best_child_raw_snippet),
    )
    record(
        "dedupe: full parent_text is returned (not the child line)",
        bool(panels) and "Renal Function" in panels[0].parent_text,
    )


def check_gate() -> None:
    section("8. Relevance gate calibration (O15)")
    with floor(0.0):
        relevant = run(GATE, "latest creatinine")
        irrelevant = run(GATE, "latest hba1c")

    relevant_cos = sorted((p.relevance for p in relevant.parents), reverse=True)
    irrelevant_cos = sorted((p.relevance for p in irrelevant.parents), reverse=True)
    info(f"cosine per parent (relevant query) = {[round(v, 4) for v in relevant_cos]}")
    info(f"cosine per parent (irrelevant query) = {[round(v, 4) for v in irrelevant_cos]}")

    # The gate is applied per parent, so the calibration compares the strongest
    # relevant evidence with the strongest irrelevant evidence.
    best_relevant = relevant_cos[0] if relevant_cos else 0.0
    max_irrelevant = irrelevant_cos[0] if irrelevant_cos else 0.0
    separation = best_relevant > max_irrelevant
    calibrated = round((best_relevant + max_irrelevant) / 2, 4) if separation else None
    measure(
        "gate: relevant evidence scores above irrelevant evidence",
        separation,
        f"best_relevant={best_relevant:.4f} max_irrelevant={max_irrelevant:.4f}",
    )
    info(
        f"calibrated RELEVANCE_FLOOR candidate: {calibrated} "
        "(provisional: 4 parents; Phase 8 Golden Set must confirm)"
    )

    record(
        "gate OFF returns irrelevant parents for 'latest hba1c'",
        len(irrelevant.parents) > 0,
        f"{len(irrelevant.parents)} parents",
    )

    if calibrated is None:
        record(
            "gate ON returns an empty result for 'latest hba1c'",
            False,
            "no calibrated floor available (evidence ranges overlap)",
        )
        return

    with floor(calibrated):
        gated = run(GATE, "latest hba1c")
        still = run(GATE, "latest creatinine")
    show(gated, f"gate at {calibrated} (irrelevant query)")
    show(still, f"gate at {calibrated} (relevant query)")
    record(
        "gate ON returns an empty result for 'latest hba1c'",
        gated.parents == [],
        str(doc_ids(gated.parents)),
    )
    record(
        "gate ON still returns the relevant parent",
        len(still.parents) > 0,
        f"{len(still.parents)} parents",
    )
    record(
        "gate ON drops the low-content preamble parent",
        all("Renal Function" in p.parent_text for p in still.parents),
        str([p.parent_text[:20] for p in still.parents]),
    )


def check_isolation() -> None:
    section("9. Cross-patient isolation over 50 queries")
    queries = [
        "creatinine",
        "urea",
        "latest creatinine",
        "blood pressure medication",
        "latest blood pressure medication",
        "how did creatinine change over the last 3 months",
        "املوديبين",
        "كرياتينين",
        "احدث تحليل",
        "Amlodipine 5mg",
    ]
    rng = random.Random(20261123)
    leaks: list[str] = []
    empty = 0
    for _ in range(50):
        query = rng.choice(queries)
        debug = run(ISO_A, query)
        if not debug.parents:
            empty += 1
        for parent in debug.parents:
            if not parent.document_id.startswith("doc_p5_isoa_"):
                leaks.append(f"{query!r} -> {parent.document_id}")
    record("isolation: 50 patient-A queries returned zero patient-B parents", not leaks, "; ".join(leaks[:5]))
    info(f"queries with no result: {empty}/50 (both patients hold identical text)")

    # identical text, other patient: B sees only B
    debug = run(ISO_B, "creatinine")
    record(
        "isolation: identical text stays separated (patient B)",
        bool(debug.parents)
        and all(p.document_id.startswith("doc_p5_isob_") for p in debug.parents),
        str(doc_ids(debug.parents)),
    )


def check_empty_patient() -> None:
    section("10. Empty patient and degradation")
    missing = f"p5_missing_{uuid.uuid4().hex[:8]}"
    debug = run(missing, "latest creatinine")
    record("empty patient returns an empty list", debug.parents == [], str(doc_ids(debug.parents)))
    record("empty patient: no candidates fetched", debug.candidate_parents == 0)
    record("empty patient: timings still recorded", "total_ms" in debug.timings_ms)

    def boom(_prompt: str) -> str:
        raise RuntimeError("provider down")

    failing = QueryExpander(enabled=True, providers={"openrouter": boom, "gemini": boom})
    debug = run(TRAP, "latest blood pressure medication", expander=failing)
    record(
        "graceful degradation: failing providers still return results",
        len(debug.parents) > 0 and debug.mode == "latest",
        f"{len(debug.parents)} parents, mode={debug.mode}",
    )


def check_live_expansion() -> None:
    section("11. Live query expansion (OpenRouter primary -> Gemini fallback)")
    expander = QueryExpander()
    started = time.perf_counter()
    expansion = expander.expand("مستوى الكرياتينين في آخر تحليل")
    elapsed = round(time.perf_counter() - started, 2)
    info(
        f"source={expansion.source} variants={len(expansion.variants)} "
        f"error={expansion.error} latency={elapsed}s"
    )
    measure(
        "live expansion returns at least the original query",
        expansion.variants and expansion.variants[0] == "مستوى الكرياتينين في آخر تحليل",
    )
    measure(
        "live expansion produced a translated variant",
        expansion.source in ("openrouter", "gemini") and len(expansion.variants) > 1,
        f"source={expansion.source} variants={len(expansion.variants)}",
    )

    debug = run(TREND, "اخر تحليل كرياتينين", expander=expander)
    show(debug, "retrieval with live expansion")
    record(
        "retrieval works end-to-end with live expansion",
        len(debug.parents) > 0,
        f"{len(debug.parents)} parents, source={debug.expansion_source}",
    )


def check_http_contract() -> None:
    section("12. API contract untouched")
    from fastapi.testclient import TestClient

    from app.api import routes
    from app.main import app
    from app.services.generator import GeneratedAnswer

    # Phase 6 wires /rag/ask to the real pipeline; the generator is stubbed here
    # so this Phase 5 script stays focused on retrieval and never calls an LLM.
    original = routes.answer_question
    routes.answer_question = lambda *args, **kwargs: GeneratedAnswer(
        answer="stub", sources=[], mode="normal", result_type="answered", rewritten=False
    )
    headers = {"X-API-Key": SETTINGS.rag_api_key.get_secret_value()}
    try:
        with TestClient(app) as client:
            health = client.get("/health")
            response = client.post(
                "/rag/ask",
                json={
                    "patient_id": TRAP,
                    "doctor_query": "latest creatinine",
                    "chat_history": [],
                },
                headers=headers,
            )
            unauthorized = client.post(
                "/rag/ask",
                json={"patient_id": TRAP, "doctor_query": "latest creatinine"},
            )
    finally:
        routes.answer_question = original
    record("/health still open", health.status_code == 200, str(health.status_code))
    body = response.json()
    record(
        "/rag/ask contract unchanged: 200 with answer + sources",
        response.status_code == 200 and set(body) == {"answer", "sources"},
        f"{response.status_code} {sorted(body)}",
    )
    record(
        "/rag/ask still requires the API key",
        unauthorized.status_code == 401,
        str(unauthorized.status_code),
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
    print("CareOS Medical RAG - Phase 5 verification")
    print(f"python: {sys.version.split()[0]}  repo: {REPO_ROOT}")
    print(f"test collection: {TEST_COLLECTION} (temp manifest DB in {_TMP})")
    print("Settings values and secrets are never printed.")

    EMBEDDER = get_embedder()
    EMBEDDER.load()
    CLIENT = vs.get_client()
    try:
        vs.ensure_collection(TEST_COLLECTION, client=CLIENT)
        check_config()
        seed()
        check_recency_trap()
        check_exact_dose()
        check_analyzer_table()
        check_trend()
        check_filters()
        check_parent_dedupe()
        check_gate()
        check_isolation()
        check_empty_patient()
        check_live_expansion()
        check_http_contract()
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
    print(f"PHASE 5 VERIFICATION: {passes} PASS, {warns} WARN, {fails} FAIL")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
