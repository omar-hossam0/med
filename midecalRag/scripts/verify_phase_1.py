"""Phase 1 verification: Qdrant collection, access layer, patient isolation.

Run from the repository root:

    env/Scripts/python.exe scripts/verify_phase_1.py

Uses a DEDICATED TEST collection (never the real careos_medical_records) and
fictional patient ids. Prints PASS/FAIL per check; exits nonzero on any FAIL.
Qdrant Cloud is contacted through the real settings (values never printed).
"""

from __future__ import annotations

import importlib.metadata
import os
import random
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

os.environ.setdefault("EMBED_WARMUP_ON_STARTUP", "false")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover
    pass

TEST_COLLECTION = "careos_phase1_test"
PATIENT_A = "pat_A_phase1"
PATIENT_B = "pat_B_phase1"
PATIENT_C = "pat_C_phase1"
PATIENT_D = "pat_D_phase1"

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


# ---------------------------------------------------------------------------
# Imports (after sys.path fix)
# ---------------------------------------------------------------------------

from qdrant_client import QdrantClient, models  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.schemas.errors import ApiError, DependencyUnavailable  # noqa: E402
from app.services import vectorstore as vs  # noqa: E402

SETTINGS = get_settings()
AUTH_CLIENT = None  # created in main


def _random_dense(rng: random.Random) -> list[float]:
    vec = [rng.uniform(-1.0, 1.0) for _ in range(SETTINGS.dense_dim)]
    norm = sum(v * v for v in vec) ** 0.5 or 1.0
    return [v / norm for v in vec]


def _random_sparse(rng: random.Random, vocab: int = 50, terms: int = 6) -> models.SparseVector:
    indices = rng.sample(range(vocab), terms)
    values = [round(rng.uniform(0.5, 2.0), 3) for _ in indices]
    return models.SparseVector(indices=indices, values=values)


def _make_point(
    patient_id: str,
    document_id: str,
    version: str,
    child_index: int,
    doc_date: str,
    rng: random.Random,
    doc_type: str = "lab_result",
) -> models.PointStruct:
    return models.PointStruct(
        id=vs.point_id(document_id, version, child_index),
        vector={"dense": _random_dense(rng), "bm25": _random_sparse(rng)},
        payload={
            "patient_id": patient_id,
            "document_id": document_id,
            "parent_id": f"{document_id}#p0",
            "doc_type": doc_type,
            "doc_date": doc_date,
            "child_text": f"[{doc_type} | {doc_date}] fictional child {child_index}",
            "raw_snippet": f"fictional child {child_index}",
            "parent_text": f"fictional parent of {document_id}",
            "version": version,
            "child_index": child_index,
        },
    )


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


def check_versions() -> None:
    section("0. Versions")
    client_version = importlib.metadata.version("qdrant-client")
    info(f"qdrant-client: {client_version}")
    try:
        server_version = AUTH_CLIENT.get_version()
        info(f"qdrant server: {server_version}")
    except Exception:
        info("qdrant server version: unavailable (not printed on failure)")


def check_ensure_collection() -> dict[str, str]:
    section("1. ensure_collection idempotent + config + indexes")
    first = vs.ensure_collection(TEST_COLLECTION, client=AUTH_CLIENT)
    second = vs.ensure_collection(TEST_COLLECTION, client=AUTH_CLIENT)
    record(
        "ensure_collection twice: no error, same date-index decision",
        first == second,
        f"{first} vs {second}",
    )
    info(f"date-index decision: {first['date_index']}")

    coll = AUTH_CLIENT.get_collection(TEST_COLLECTION)
    dense = coll.config.params.vectors.get("dense")
    sparse = coll.config.params.sparse_vectors.get("bm25")
    ok_dense = (
        dense is not None
        and dense.size == SETTINGS.dense_dim
        and dense.distance == models.Distance.COSINE
    )
    record(
        f"dense named vector: size={SETTINGS.dense_dim}, cosine",
        ok_dense,
        f"got size={getattr(dense, 'size', None)}, distance={getattr(dense, 'distance', None)}",
    )
    ok_sparse = sparse is not None and sparse.modifier == models.Modifier.IDF
    record("sparse bm25 named vector with IDF modifier", ok_sparse, f"modifier={getattr(sparse, 'modifier', None)}")

    indexes = {}
    for field_schema in coll.payload_schema.values():
        indexes[field_schema.data_type] = indexes.get(field_schema.data_type, 0) + 1
    keyword_count = indexes.get(models.PayloadSchemaType.KEYWORD, 0)
    datetime_count = indexes.get(models.PayloadSchemaType.DATETIME, 0)
    integer_count = indexes.get(models.PayloadSchemaType.INTEGER, 0)
    expected_dt = 1 if first["date_index"] == "datetime" else 0
    expected_int = 1 if first["date_index"] == "integer" else 0
    ok_indexes = (
        keyword_count == 5  # 4 per plan 6.2 + version per plan 6.3 allowance
        and datetime_count == expected_dt
        and integer_count == expected_int
    )
    record(
        "payload indexes: 5 keyword (incl. version) + date index per decision",
        ok_indexes,
        f"keyword={keyword_count}, datetime={datetime_count}, integer={integer_count}",
    )
    return first


def seed_isolation_data() -> None:
    rng = random.Random(41001)
    points: list[models.PointStruct] = []
    for patient in (PATIENT_A, PATIENT_B):
        for doc_i in range(4):
            for child in range(5):
                points.append(
                    _make_point(
                        patient,
                        f"{patient}_doc{doc_i}",
                        "v1",
                        child,
                        "2026-09-01",
                        rng,
                    )
                )
    vs.upsert_points(points, collection_name=TEST_COLLECTION, client=AUTH_CLIENT)


def check_isolation() -> None:
    section("2. Isolation: 50 random queries per patient per mode, zero leaks")
    seed_isolation_data()
    rng = random.Random(41002)
    leaks: list[str] = []
    total_results = 0
    for patient, _other in ((PATIENT_A, PATIENT_B), (PATIENT_B, PATIENT_A)):
        for _i in range(50):
            dense_q = _random_dense(rng)
            sparse_q = _random_sparse(rng)
            for mode, points in (
                ("dense", vs.search_dense(patient, dense_q, collection_name=TEST_COLLECTION, client=AUTH_CLIENT)),
                ("sparse", vs.search_sparse(patient, sparse_q, collection_name=TEST_COLLECTION, client=AUTH_CLIENT)),
                (
                    "hybrid",
                    vs.hybrid_search(
                        patient, dense_q, sparse_q, collection_name=TEST_COLLECTION, client=AUTH_CLIENT
                    ),
                ),
            ):
                total_results += len(points)
                for p in points:
                    if p.payload.get("patient_id") != patient:
                        leaks.append(f"{mode}:{patient}:{p.id}")
    record(
        "isolation: 200 queries (2 patients x 50 x 3 modes) returned zero foreign points",
        not leaks and total_results > 0,
        f"leaks={len(leaks)}, total_results={total_results}",
    )
    info(f"total points returned across all queries: {total_results}")


def check_empty_patient_raises() -> None:
    section("3. Empty/blank patient_id raises on every read/delete path")
    dense_q = _random_dense(random.Random(1))
    sparse_q = _random_sparse(random.Random(2))
    cases = [
        ("patient_filter", lambda: vs.patient_filter("")),
        ("patient_filter blank", lambda: vs.patient_filter("   ")),
        ("search_dense", lambda: vs.search_dense("", dense_q, collection_name=TEST_COLLECTION, client=AUTH_CLIENT)),
        (
            "search_sparse",
            lambda: vs.search_sparse("", sparse_q, collection_name=TEST_COLLECTION, client=AUTH_CLIENT),
        ),
        (
            "hybrid_search",
            lambda: vs.hybrid_search("", dense_q, sparse_q, collection_name=TEST_COLLECTION, client=AUTH_CLIENT),
        ),
        (
            "search_by_date",
            lambda: vs.search_by_date("", collection_name=TEST_COLLECTION, client=AUTH_CLIENT),
        ),
        (
            "scroll_document",
            lambda: vs.scroll_document("doc_x", "", collection_name=TEST_COLLECTION, client=AUTH_CLIENT),
        ),
        (
            "count_for_patient",
            lambda: vs.count_for_patient("", collection_name=TEST_COLLECTION, client=AUTH_CLIENT),
        ),
        (
            "delete_patient",
            lambda: vs.delete_patient("", collection_name=TEST_COLLECTION, client=AUTH_CLIENT),
        ),
    ]
    failures: list[str] = []
    for name, fn in cases:
        try:
            fn()
            failures.append(f"{name}: no raise")
        except ApiError as exc:
            if exc.status_code != 400:
                failures.append(f"{name}: status {exc.status_code}")
        except Exception as exc:  # noqa: BLE001
            failures.append(f"{name}: wrong type {type(exc).__name__}")
    record("9 read/delete paths raise 400 ApiError on empty patient_id", not failures, "; ".join(failures))


def check_date_ordering() -> None:
    section("4. order_by doc_date + date_from range filter")
    rng = random.Random(41003)
    doc_dates = {
        "doc_old": "2026-01-05",
        "doc_mid": "2026-02-10",
        "doc_new": "2026-03-01",
    }
    vs.upsert_points(
        [
            _make_point(PATIENT_C, doc_id, "v1", 0, date, rng)
            for doc_id, date in doc_dates.items()
        ],
        collection_name=TEST_COLLECTION,
        client=AUTH_CLIENT,
    )
    desc = vs.search_by_date(PATIENT_C, collection_name=TEST_COLLECTION, client=AUTH_CLIENT)
    got_desc = [p.payload["document_id"] for p in desc]
    record(
        "search_by_date returns newest-first order",
        got_desc == ["doc_new", "doc_mid", "doc_old"],
        f"got {got_desc}",
    )
    asc = vs.search_by_date(
        PATIENT_C, ascending=True, collection_name=TEST_COLLECTION, client=AUTH_CLIENT
    )
    got_asc = [p.payload["document_id"] for p in asc]
    record(
        "search_by_date ascending returns oldest-first order",
        got_asc == ["doc_old", "doc_mid", "doc_new"],
        f"got {got_asc}",
    )
    subset = vs.search_by_date(
        PATIENT_C, date_from="2026-02-01", collection_name=TEST_COLLECTION, client=AUTH_CLIENT
    )
    got_subset = sorted(p.payload["document_id"] for p in subset)
    record(
        "date_from range filter returns only doc_date >= 2026-02-01",
        got_subset == ["doc_mid", "doc_new"],
        f"got {got_subset}",
    )


def check_point_id() -> None:
    section("5. Deterministic point ids")
    a1 = vs.point_id("doc_x", "v1", 0)
    a2 = vs.point_id("doc_x", "v1", 0)
    b_version = vs.point_id("doc_x", "v2", 0)
    b_index = vs.point_id("doc_x", "v1", 1)
    b_doc = vs.point_id("doc_y", "v1", 0)
    ok = (
        a1 == a2
        and len({a1, b_version, b_index, b_doc}) == 4
        and all(
            len(x) == 36 and x.count("-") == 4 for x in (a1, b_version, b_index, b_doc)
        )
    )
    record("point_id deterministic; distinct across version/child_index/document", ok)


def check_versioned_delete() -> None:
    section("6. delete_document(keep_version=...) removes only other versions")
    rng = random.Random(41004)
    doc_id = "pat_D_docX"
    v1_points = [_make_point(PATIENT_D, doc_id, "v1", i, "2026-05-01", rng) for i in range(3)]
    v2_points = [_make_point(PATIENT_D, doc_id, "v2", i, "2026-05-01", rng) for i in range(2)]
    vs.upsert_points(v1_points + v2_points, collection_name=TEST_COLLECTION, client=AUTH_CLIENT)
    before = vs.scroll_document(doc_id, PATIENT_D, collection_name=TEST_COLLECTION, client=AUTH_CLIENT)
    record("5 points visible before delete (v1 x3 + v2 x2)", len(before) == 5, f"got {len(before)}")

    vs.delete_document(doc_id, keep_version="v2", collection_name=TEST_COLLECTION, client=AUTH_CLIENT)
    after = vs.scroll_document(doc_id, PATIENT_D, collection_name=TEST_COLLECTION, client=AUTH_CLIENT)
    versions = {p.payload.get("version") for p in after}
    record(
        "after keep_version='v2': exactly 2 points, all v2",
        len(after) == 2 and versions == {"v2"},
        f"count={len(after)}, versions={versions}",
    )

    vs.delete_document(doc_id, collection_name=TEST_COLLECTION, client=AUTH_CLIENT)
    vs.delete_document(doc_id, collection_name=TEST_COLLECTION, client=AUTH_CLIENT)
    gone = vs.scroll_document(doc_id, PATIENT_D, collection_name=TEST_COLLECTION, client=AUTH_CLIENT)
    record("full delete is idempotent and removes the rest", len(gone) == 0, f"got {len(gone)}")


def check_dependency_unavailable() -> None:
    section("7. Qdrant failure -> DependencyUnavailable (503), not a crash")
    bad_client = QdrantClient(url="http://127.0.0.1:9", timeout=1, check_compatibility=False)
    try:
        vs._call(bad_client.get_collections)
        record("unreachable qdrant raises DependencyUnavailable", False, "no exception raised")
    except DependencyUnavailable as exc:
        record(
            "unreachable qdrant raises DependencyUnavailable (ApiError 503, standard code)",
            exc.status_code == 503 and exc.code == "dependency_unavailable",
        )
        info(f"wrapped failure class (detail, logged only): {exc.detail}")
    except Exception as exc:  # noqa: BLE001
        record("unreachable qdrant raises DependencyUnavailable", False, f"wrong type {type(exc).__name__}")
    finally:
        bad_client.close()


def check_static_import_rule() -> None:
    section("8. Static rule: qdrant_client imported ONLY inside vectorstore.py")
    offenders: list[str] = []
    for path in (REPO_ROOT / "app").rglob("*.py"):
        if path.name == "vectorstore.py":
            continue
        text = path.read_text(encoding="utf-8")
        if "qdrant_client" in text:
            offenders.append(str(path.relative_to(REPO_ROOT)))
    record("no qdrant_client import outside app/services/vectorstore.py", not offenders, ", ".join(offenders))


def check_pytest() -> None:
    section("9. pytest suite tests/phase_1")
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pytest", "tests/phase_1", "-q"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=600,
        )
    except Exception as exc:  # noqa: BLE001
        record("pytest: tests/phase_1 suite passes", False, f"pytest did not run: {type(exc).__name__}")
        return
    output = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode == 0:
        record("pytest: tests/phase_1 suite passes", True)
    else:
        tail = output.strip().splitlines()[-1] if output.strip() else "(no output)"
        record("pytest: tests/phase_1 suite passes", False, f"exit={proc.returncode}; {tail}")
    print("---- pytest output ----")
    print(output.rstrip())
    print("-----------------------")


def cleanup() -> None:
    try:
        AUTH_CLIENT.delete_collection(TEST_COLLECTION)
        info(f"test collection '{TEST_COLLECTION}' deleted")
    except Exception:  # noqa: BLE001
        info("test collection cleanup skipped (already absent)")


def main() -> int:
    global AUTH_CLIENT
    print("CareOS Medical RAG - Phase 1 verification")
    print(f"python: {sys.version.split()[0]}  repo: {REPO_ROOT}")
    print("Uses a dedicated test collection; settings values are never printed.")

    AUTH_CLIENT = vs._client()
    try:
        check_versions()
        check_ensure_collection()
        check_isolation()
        check_empty_patient_raises()
        check_date_ordering()
        check_point_id()
        check_versioned_delete()
        check_dependency_unavailable()
        check_static_import_rule()
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
    print(f"PHASE 1 VERIFICATION: {passes} PASS, {fails} FAIL")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
