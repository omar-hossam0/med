"""Phase 4 verification: FastEmbed embeddings, indexing, ranking, guards.

Run from the repository root:

    env/Scripts/python.exe scripts/verify_phase_4.py

Uses a DEDICATED TEST collection against the real Qdrant Cloud (never the real
collection) and a temp SQLite manifest. The first run downloads the FastEmbed
models. All data is fictional; settings values are never printed.
"""

from __future__ import annotations

import ctypes
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Test isolation FIRST (real env vars beat .env in pydantic-settings).
_TMP = tempfile.mkdtemp(prefix="careos_phase4_")
os.environ["COLLECTION_NAME"] = "careos_phase4_test"
os.environ["DB_URL"] = "sqlite:///" + _TMP.replace("\\", "/") + "/manifest.db"
os.environ["EMBED_WARMUP_ON_STARTUP"] = "false"
os.environ["EMBED_BATCH_SIZE"] = "16"
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
    """Record a measured quality result; weak values are WARN, not FAIL.

    The plan requires cross-language ranks to be recorded, not hidden. A WARN
    keeps the phase green while making a weak model result visible.
    """
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
from qdrant_client import models  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import manifest  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.contract import IngestRequest  # noqa: E402
from app.services import model_guard  # noqa: E402
from app.services import vectorstore as vs  # noqa: E402
from app.services.embedder import EmbedderInputTooLong, get_embedder  # noqa: E402
from app.services.ingest_pipeline import process_document  # noqa: E402
from app.services.normalizer import normalize  # noqa: E402

SETTINGS = get_settings()
TEST_COLLECTION = SETTINGS.collection_name
PATIENT = "p_phase4"
DOSE_PATIENT = "p_phase4_dose"
XL_PATIENT = "p_phase4_xl"
PAYLOAD_KEYS = set(vs.PAYLOAD_FIELDS) | {"version", "child_index"}

CLIENT = None
EMBEDDER = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _lab_payload(
    document_id: str = "doc_p4_lab",
    lines: list[str] | None = None,
    patient_id: str = PATIENT,
) -> dict:
    lines = lines or [
        "Al-Borg Lab",
        "Date: 15/10/2026",
        "Renal Function:",
        "Creatinine: 1.8 mg/dL (0.6 - 1.2)",
        "Urea: 65 mg/dL (15 - 45)",
    ]
    return {
        "patient_id": patient_id,
        "document_id": document_id,
        "uploaded_at": "2026-10-24T10:30:00Z",
        "user_selected_type": "lab_result",
        "user_selected_date": None,
        "ocr_output": {
            "raw_text": "\n".join(lines),
            "lines": lines,
            "detected_doc_type": None,
            "extracted_date": "2026-10-15",
        },
    }


def _request(payload: dict) -> IngestRequest:
    return IngestRequest.model_validate(payload)


def _ingest(payload: dict, version: str) -> None:
    process_document(
        _request(payload),
        "lab_result",
        "2026-10-15",
        "ocr",
        version=version,
        collection_name=TEST_COLLECTION,
        client=CLIENT,
    )


def _doc_points(document_id: str, patient_id: str = PATIENT) -> list:
    return vs.scroll_document(
        document_id,
        patient_id,
        collection_name=TEST_COLLECTION,
        client=CLIENT,
    )


def _point_texts(points: list) -> list[str]:
    return [point.payload.get("child_text", "") for point in points]


def _rank_of(points: list, doc_key: str, key: str = "document_id") -> int | None:
    for index, point in enumerate(points, start=1):
        if point.payload.get(key) == doc_key:
            return index
    return None


def _ask_body(patient_id: str = PATIENT, query: str = "creatinine") -> dict:
    return {"patient_id": patient_id, "doctor_query": query, "chat_history": []}


def _auth_headers() -> dict[str, str]:
    return {"X-API-Key": SETTINGS.rag_api_key.get_secret_value()}


class _ProcessMemoryCounters(ctypes.Structure):
    _fields_ = [
        ("cb", ctypes.c_ulong),
        ("PageFaultCount", ctypes.c_ulong),
        ("PeakWorkingSetSize", ctypes.c_size_t),
        ("WorkingSetSize", ctypes.c_size_t),
        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
        ("PagefileUsage", ctypes.c_size_t),
        ("PeakPagefileUsage", ctypes.c_size_t),
    ]


def _rss_mb() -> float | None:
    """Working-set size on Windows; None elsewhere."""
    if os.name != "nt":
        return None
    try:
        counters = _ProcessMemoryCounters()
        counters.cb = ctypes.sizeof(_ProcessMemoryCounters)
        process = ctypes.windll.kernel32.GetCurrentProcess()
        ok = ctypes.windll.psapi.GetProcessMemoryInfo(
            process, ctypes.byref(counters), counters.cb
        )
        if not ok:
            return None
        return round(counters.WorkingSetSize / (1024 * 1024), 1)
    except Exception:  # noqa: BLE001
        return None


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


def check_models_and_collection() -> None:
    section("1. Models load once; dense dimension and collection agree")
    rss_before = _rss_mb()
    started = time.perf_counter()
    metrics = EMBEDDER.warmup()
    elapsed = time.perf_counter() - started
    rss_after = _rss_mb()

    info(
        f"load_seconds={metrics['load_seconds']} warmup_encode_seconds="
        f"{metrics['warmup_encode_seconds']} total_seconds={elapsed:.3f}"
    )
    if rss_before is not None and rss_after is not None:
        info(f"process_rss_mb before={rss_before} after={rss_after}")

    record(
        "dense model equals DENSE_MODEL",
        EMBEDDER.dense_model == SETTINGS.dense_model,
        EMBEDDER.dense_model,
    )
    record(
        "sparse model equals SPARSE_MODEL",
        EMBEDDER.sparse_model == SETTINGS.sparse_model,
        EMBEDDER.sparse_model,
    )
    record(
        "loaded dense dimension equals DENSE_DIM",
        metrics["dense_dim"] == SETTINGS.dense_dim,
        f"{metrics['dense_dim']} vs {SETTINGS.dense_dim}",
    )

    created = vs.ensure_collection(TEST_COLLECTION, client=CLIENT)
    collection_dim = vs.collection_dim(TEST_COLLECTION, client=CLIENT)
    record(
        "collection dense size equals DENSE_DIM",
        collection_dim == SETTINGS.dense_dim,
        f"{collection_dim} vs {SETTINGS.dense_dim}",
    )

    info_ = CLIENT.get_collection(TEST_COLLECTION)
    sparse = info_.config.params.sparse_vectors or {}
    bm25 = sparse.get("bm25")
    record("collection has bm25 sparse vector with IDF modifier", bm25 is not None and bm25.modifier == models.Modifier.IDF)
    info(f"collection '{created['collection']}' date_index={created['date_index']}")


def check_embedding_basics() -> None:
    section("2. Determinism, normalization, no double prefix, input length")
    text = "Creatinine: 1.8 mg/dL (0.6 - 1.2)"
    dense_a, sparse_a = EMBEDDER.embed_children([text])
    dense_b, sparse_b = EMBEDDER.embed_children([text])
    record("same text encodes to the same dense vector twice", dense_a == dense_b)
    record("same text encodes to the same sparse vector twice", sparse_a == sparse_b)
    record(
        "model input is the normalized text (no E5 prefix added)",
        EMBEDDER.last_inputs == [normalize(text)]
        and not EMBEDDER.last_inputs[0].startswith(("passage:", "query:")),
        repr(EMBEDDER.last_inputs),
    )

    tokens = EMBEDDER.token_count([text])
    record("sample child fits the 128-token limit", tokens <= 128, f"tokens={tokens}")

    too_long = "x" * (SETTINGS.child_max_chars + 1)
    try:
        EMBEDDER.embed_children([too_long])
        guarded = False
    except EmbedderInputTooLong:
        guarded = True
    record("input-length guard rejects a child over CHILD_MAX_CHARS", guarded)


def check_end_to_end_ingest() -> None:
    section("3. End-to-end ingest: real points, exact payload, both vectors")
    request = _request(_lab_payload())
    started = time.perf_counter()
    process_document(
        request,
        "lab_result",
        "2026-10-15",
        "ocr",
        version="v_p4_1",
        collection_name=TEST_COLLECTION,
        client=CLIENT,
    )
    ingest_seconds = time.perf_counter() - started

    row = manifest.get_document("doc_p4_lab")
    record(
        "manifest indexed with real model signature and child count",
        row is not None
        and row.status == "indexed"
        and row.child_count == 4
        and row.dense_model == SETTINGS.dense_model
        and row.sparse_model == SETTINGS.sparse_model
        and row.dense_dim == SETTINGS.dense_dim,
        repr(
            None
            if row is None
            else (row.status, row.child_count, row.dense_model, row.dense_dim)
        ),
    )

    points = _doc_points("doc_p4_lab")
    record("exactly 4 points written", len(points) == 4, f"count={len(points)}")

    records = CLIENT.retrieve(
        collection_name=TEST_COLLECTION,
        ids=[point.id for point in points],
        with_payload=True,
        with_vectors=True,
    )
    payload_keys_ok = all(set(stored.payload or {}) == PAYLOAD_KEYS for stored in records)
    record(
        "payload keys are exactly Section 6.2 + version/child_index",
        payload_keys_ok,
        repr([sorted((stored.payload or {}).keys()) for stored in records][:1]),
    )

    vectors_ok = True
    dense_len = None
    for stored in records:
        vector = stored.vector or {}
        if set(vector.keys()) != {"dense", "bm25"}:
            vectors_ok = False
            continue
        dense_len = len(vector["dense"])
        if not vector["bm25"].indices:
            vectors_ok = False
    record(
        "every point has dense + bm25 vectors",
        vectors_ok and dense_len == SETTINGS.dense_dim,
        f"dense_len={dense_len}",
    )

    texts = _point_texts(points)
    token_counts = [EMBEDDER.token_count([text]) for text in texts]
    record(
        "every ingested child fits the 128-token limit",
        all(count <= 128 for count in token_counts),
        repr(token_counts),
    )

    sizes = [len(json.dumps(point.payload, ensure_ascii=False).encode("utf-8")) for point in points]
    info(
        f"ingest_seconds={ingest_seconds:.3f} payload_bytes_per_doc={sum(sizes)} "
        f"per_child_bytes={sizes}"
    )

    started = time.perf_counter()
    EMBEDDER.embed_children(texts)
    encode_seconds = time.perf_counter() - started
    info(
        f"encode_seconds={encode_seconds:.4f} per_child_seconds="
        f"{encode_seconds / max(1, len(texts)):.4f}"
    )


def _upsert_child_docs(patient_id: str, docs: list[tuple[str, str]], doc_type: str = "lab_result") -> None:
    texts = [text for _, text in docs]
    dense, sparse = EMBEDDER.embed_children(texts)
    points = []
    for (document_id, text), dense_vector, (indices, values) in zip(
        docs, dense, sparse, strict=True
    ):
        payload = {
            "patient_id": patient_id,
            "document_id": document_id,
            "parent_id": f"{document_id}#p0",
            "doc_type": doc_type,
            "doc_date": "2026-10-01",
            "child_text": text,
            "raw_snippet": text,
            "parent_text": text,
            "version": "v1",
            "child_index": 0,
        }
        points.append(
            vs.build_point(
                vs.point_id(document_id, "v1", 0),
                dense_vector,
                indices,
                values,
                payload,
            )
        )
    vs.upsert_points(points, collection_name=TEST_COLLECTION, client=CLIENT)


def _hybrid(patient_id: str, query: str, limit: int = 10) -> list:
    dense, (indices, values) = EMBEDDER.embed_query(query)
    return vs.hybrid_search(
        patient_id,
        dense,
        vs.make_sparse_vector(indices, values),
        limit=limit,
        collection_name=TEST_COLLECTION,
        client=CLIENT,
    )


def check_exact_dose() -> None:
    section("4. Exact-dose ranking (P10): hybrid, dense-only, BM25-only")
    _upsert_child_docs(
        DOSE_PATIENT,
        [
            ("dose_5", "Amlodipine 5 mg once daily"),
            ("dose_10", "Amlodipine 10 mg once daily"),
            ("dose_atenolol", "Atenolol 50 mg once daily"),
        ],
        doc_type="prescription",
    )

    query = normalize("Amlodipine 5mg")
    dense, (indices, values) = EMBEDDER.embed_query(query)

    hybrid = vs.hybrid_search(
        DOSE_PATIENT,
        dense,
        vs.make_sparse_vector(indices, values),
        limit=5,
        collection_name=TEST_COLLECTION,
        client=CLIENT,
    )
    dense_only = vs.search_dense(
        DOSE_PATIENT,
        dense,
        limit=5,
        collection_name=TEST_COLLECTION,
        client=CLIENT,
    )
    sparse_only = vs.search_sparse(
        DOSE_PATIENT,
        vs.make_sparse_vector(indices, values),
        limit=5,
        collection_name=TEST_COLLECTION,
        client=CLIENT,
    )

    hybrid_ids = [point.payload["document_id"] for point in hybrid]
    record(
        "hybrid ranks Amlodipine 5 mg first",
        bool(hybrid_ids) and hybrid_ids[0] == "dose_5",
        repr(hybrid_ids),
    )
    info(f"query='{query}'")
    info(f"hybrid ranking: {hybrid_ids}")
    info(f"dense-only ranking: {[p.payload['document_id'] for p in dense_only]}")
    info(f"bm25-only ranking: {[p.payload['document_id'] for p in sparse_only]}")


def check_cross_language() -> None:
    section("5. Cross-language (Arabic <-> English) and Arabic BM25")
    docs = [
        ("xl_en_creatinine", "Creatinine: 1.8 mg/dL (0.6 - 1.2)"),
        ("xl_ar_creatinine", "الكرياتينين: 1.8 مجم/دل (0.6 - 1.2)"),
        ("xl_en_urea", "Urea: 65 mg/dL (15 - 45)"),
        ("xl_ar_urea", "اليوريا: 65 مجم/دل (15 - 45)"),
        ("xl_en_glucose", "Glucose: 90 mg/dL (70 - 110)"),
        ("xl_ar_glucose", "الجلوكوز: 90 مجم/دل (70 - 110)"),
    ]
    _upsert_child_docs(XL_PATIENT, docs)

    ar_query = "إيه نسبة الكرياتينين؟"
    ar_hits = _hybrid(XL_PATIENT, ar_query)
    en_rank = _rank_of(ar_hits, "xl_en_creatinine")
    measure(
        "Arabic creatinine question retrieves the English child (top 3)",
        en_rank is not None and en_rank <= 3,
        f"rank={en_rank} of {len(ar_hits)}",
    )
    info(f"Arabic query hybrid ranking: {[p.payload['document_id'] for p in ar_hits]}")
    ar_dense = vs.search_dense(
        XL_PATIENT,
        EMBEDDER.embed_query(ar_query)[0],
        limit=10,
        collection_name=TEST_COLLECTION,
        client=CLIENT,
    )
    info(f"Arabic query dense-only ranking: {[p.payload['document_id'] for p in ar_dense]}")

    en_query = "what is the creatinine level"
    en_hits = _hybrid(XL_PATIENT, en_query)
    ar_rank = _rank_of(en_hits, "xl_ar_creatinine")
    measure(
        "English creatinine question retrieves the Arabic child (top 3)",
        ar_rank is not None and ar_rank <= 3,
        f"rank={ar_rank} of {len(en_hits)}",
    )
    info(f"English query hybrid ranking: {[p.payload['document_id'] for p in en_hits]}")
    en_dense = vs.search_dense(
        XL_PATIENT,
        EMBEDDER.embed_query(en_query)[0],
        limit=10,
        collection_name=TEST_COLLECTION,
        client=CLIENT,
    )
    info(f"English query dense-only ranking: {[p.payload['document_id'] for p in en_dense]}")

    _, (indices, values) = EMBEDDER.embed_query("الكرياتينين")
    bm25 = vs.search_sparse(
        XL_PATIENT,
        vs.make_sparse_vector(indices, values),
        limit=5,
        collection_name=TEST_COLLECTION,
        client=CLIENT,
    )
    bm25_rank = _rank_of(bm25, "xl_ar_creatinine")
    record(
        "Arabic exact term ranks the Arabic child first in BM25",
        bm25_rank == 1,
        f"rank={bm25_rank}, order={[p.payload['document_id'] for p in bm25]}",
    )
    info(f"Arabic BM25 ranking: {[p.payload['document_id'] for p in bm25]}")


def check_idempotency_and_stale_removal() -> None:
    section("6. Re-ingest idempotency + stale-point removal with real vectors")
    _ingest(_lab_payload(), version="v_p4_2")
    row = manifest.get_document("doc_p4_lab")
    points = _doc_points("doc_p4_lab")
    versions = {point.payload.get("version") for point in points}
    record(
        "re-ingest same payload: 4 points, one version, manifest indexed",
        row.status == "indexed"
        and row.child_count == 4
        and len(points) == 4
        and versions == {row.version},
        f"count={len(points)}, versions={versions}",
    )

    _ingest(_lab_payload(lines=[f"line {i}" for i in range(10)]), version="v_p4_10")
    row10 = manifest.get_document("doc_p4_lab")
    _ingest(_lab_payload(lines=[f"line {i}" for i in range(3)]), version="v_p4_3")
    row3 = manifest.get_document("doc_p4_lab")
    points = _doc_points("doc_p4_lab")
    record(
        "10 children then 3: exactly 3 points remain (stale removed)",
        row10.child_count == 10 and row3.child_count == 3 and len(points) == 3,
        f"10-ingest={row10.child_count}, 3-ingest={row3.child_count}, points={len(points)}",
    )


def check_model_guard() -> None:
    section("7. Model guard: manifest mismatch + ingest/query refusal")
    signature = model_guard.current_signature()
    manifest.update_models(
        "doc_p4_lab", "wrong/dense-model", signature.sparse_model, signature.dense_dim
    )
    mismatches = model_guard.manifest_mismatches()
    record("changed model id is detected in the manifest", len(mismatches) == 1)
    try:
        model_guard.assert_manifest_consistent()
        raised = False
    except model_guard.ModelMismatchError:
        raised = True
    record("assert_manifest_consistent raises on mismatch", raised)

    manifest.update_models(
        "doc_p4_lab", signature.dense_model, signature.sparse_model, signature.dense_dim
    )
    record("restored model signature passes the manifest guard", not model_guard.manifest_mismatches())

    original = getattr(app.state, "model_guard_ok", None)
    app.state.model_guard_ok = False
    app.state.model_guard_problems = ["dense_model changed"]
    try:
        client = TestClient(app)
        ask = client.post("/rag/ask", json=_ask_body(), headers=_auth_headers())
        ingest = client.post(
            "/rag/ingest", json=_lab_payload("doc_guard_http"), headers=_auth_headers()
        )
        record(
            "POST /rag/ask refused with 503 model_mismatch",
            ask.status_code == 503
            and ask.json().get("error", {}).get("code") == "model_mismatch",
            f"status={ask.status_code}",
        )
        record(
            "POST /rag/ingest refused with 503 model_mismatch",
            ingest.status_code == 503
            and ingest.json().get("error", {}).get("code") == "model_mismatch",
            f"status={ingest.status_code}",
        )
    finally:
        app.state.model_guard_ok = original
        app.state.model_guard_problems = []


def check_startup_wiring() -> None:
    section("8. Real lifespan: warm-up + ensure_collection + model guard")
    probe = (
        "import sys\n"
        f"sys.path.insert(0, {str(REPO_ROOT)!r})\n"
        "from fastapi.testclient import TestClient\n"
        "from app.main import app\n"
        "with TestClient(app) as client:\n"
        "    state = app.state\n"
        "    print('EMBEDDER_READY', state.embedder_ready)\n"
        "    print('COLLECTION_READY', state.collection_ready)\n"
        "    print('MODEL_GUARD_OK', state.model_guard_ok)\n"
        "    print('HEALTH', client.get('/health').status_code)\n"
    )
    env = os.environ.copy()
    env["EMBED_WARMUP_ON_STARTUP"] = "true"
    try:
        proc = subprocess.run(
            [sys.executable, "-c", probe],
            cwd=str(REPO_ROOT),
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=600,
        )
    except Exception as exc:  # noqa: BLE001
        record("app boots with Phase 4 lifespan", False, f"did not run: {type(exc).__name__}")
        return
    output = (proc.stdout or "") + (proc.stderr or "")
    embedded = "EMBEDDER_READY True" in output
    ensured = "COLLECTION_READY True" in output
    guarded = "MODEL_GUARD_OK True" in output
    health = "HEALTH 200" in output
    record(
        "app boots with warm-up + ensure_collection + model guard",
        proc.returncode == 0 and embedded and ensured and guarded and health,
        f"exit={proc.returncode} embedder={embedded} collection={ensured} "
        f"guard={guarded} health={health}",
    )
    summary = " | ".join(
        line
        for line in output.splitlines()
        if line.startswith(
            ("EMBEDDER_READY", "COLLECTION_READY", "MODEL_GUARD_OK", "HEALTH")
        )
    )
    info(f"startup probe: {summary}")


def check_pytest() -> None:
    section("9. pytest tests/phase_4")
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pytest", "tests/phase_4", "-q"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=600,
        )
    except Exception as exc:  # noqa: BLE001
        record("pytest: tests/phase_4 passes", False, f"did not run: {type(exc).__name__}")
        return
    output = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode == 0:
        record("pytest: tests/phase_4 passes", True)
    else:
        tail = output.strip().splitlines()[-1] if output.strip() else "(no output)"
        record("pytest: tests/phase_4 passes", False, f"exit={proc.returncode}; {tail}")
    print("---- pytest output ----")
    print(output.rstrip())
    print("-----------------------")


def cleanup() -> None:
    try:
        CLIENT.delete_collection(TEST_COLLECTION)
        info(f"test collection '{TEST_COLLECTION}' deleted")
    except Exception:  # noqa: BLE001
        info("collection cleanup skipped")
    try:
        CLIENT.close()
    except Exception:  # noqa: BLE001
        pass
    shutil.rmtree(_TMP, ignore_errors=True)


def main() -> int:
    global CLIENT, EMBEDDER
    print("CareOS Medical RAG - Phase 4 verification")
    print(f"python: {sys.version.split()[0]}  repo: {REPO_ROOT}")
    print(f"test collection: {TEST_COLLECTION} (temp manifest DB in {_TMP})")
    print("Settings values are never printed.")

    EMBEDDER = get_embedder()
    CLIENT = vs.get_client()
    try:
        check_models_and_collection()
        check_embedding_basics()
        check_end_to_end_ingest()
        check_exact_dose()
        check_cross_language()
        check_idempotency_and_stale_removal()
        check_model_guard()
        check_startup_wiring()
        check_pytest()
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
    print(f"PHASE 4 VERIFICATION: {passes} PASS, {warns} WARN, {fails} FAIL")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
