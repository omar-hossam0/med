"""Qdrant access layer (plan Phase 1).

This is the ONLY application module that imports qdrant_client. Every read,
write and delete goes through :func:`patient_filter`, which raises unless a
non-empty ``patient_id`` is provided - strict patient isolation (plan rule 4,
issue A6: the filter is applied to every prefetch branch AND the outer query).

Payload schema (plan Section 6.2): patient_id, document_id, parent_id,
doc_type, doc_date, child_text, raw_snippet, parent_text. Two extra payload
keys are stored by explicit plan allowance (Section 6.3): ``version`` and
``child_index`` (deviation recorded in PROGRESS.md) so versioned replacement
can delete exactly the other versions without a manifest join.
"""

from __future__ import annotations

import functools
import logging
import uuid
from typing import Any

import httpx
from qdrant_client import QdrantClient, models
from qdrant_client.http.exceptions import ResponseHandlingException
from tenacity import Retrying, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.config import get_settings
from app.schemas.errors import ApiError, DependencyUnavailable, invalid_request

logger = logging.getLogger(__name__)

# Only transient transport/timeout failures are retried; API errors (e.g. a
# schema rejection or a missing index) must surface immediately.
_TRANSIENT_ERRORS = (
    httpx.TransportError,
    TimeoutError,
    ConnectionError,
    ResponseHandlingException,
)


def _before_retry(state: Any) -> None:
    """Log ids only: exception messages may embed the instance URL."""
    exc = state.outcome.exception() if state.outcome else None
    logger.warning(
        "qdrant_retry attempt=%d class=%s",
        state.attempt_number,
        type(exc).__name__ if exc is not None else "unknown",
    )


def _retrying() -> Retrying:
    settings = get_settings()
    return Retrying(
        reraise=True,
        stop=stop_after_attempt(max(1, settings.qdrant_retry_attempts)),
        wait=wait_exponential(
            multiplier=max(0.0, settings.qdrant_retry_wait_seconds), max=4
        ),
        retry=retry_if_exception_type(_TRANSIENT_ERRORS),
        before_sleep=_before_retry,
    )

# Fixed namespace so point ids are stable across processes and restarts.
POINT_ID_NAMESPACE = uuid.UUID("5b6c1e2a-9d3f-4c8b-a7e1-2f4d6a8b0c9e")

PAYLOAD_FIELDS = (
    "patient_id",
    "document_id",
    "parent_id",
    "doc_type",
    "doc_date",
    "child_text",
    "raw_snippet",
    "parent_text",
)


def point_id(document_id: str, version: str, child_index: int) -> str:
    """Deterministic UUID v5 from document_id, version and child_index.

    The version token makes a re-ingest insert new points before the old ones
    are deleted (plan Section 6.3, issue P12).
    """
    return str(uuid.uuid5(POINT_ID_NAMESPACE, f"{document_id}:{version}:{child_index}"))


def patient_filter(
    patient_id: str,
    doc_type: str | None = None,
    date_from: str | None = None,
) -> models.Filter:
    """Mandatory patient filter. Raises (400) unless patient_id is non-empty.

    ``doc_type`` is a hard keyword filter; ``date_from`` (ISO date) becomes a
    datetime range filter on the indexed doc_date field.
    """
    if not isinstance(patient_id, str) or not patient_id.strip():
        raise invalid_request("patient_id is required for every Qdrant operation")
    must: list[Any] = [
        models.FieldCondition(key="patient_id", match=models.MatchValue(value=patient_id))
    ]
    if doc_type:
        must.append(
            models.FieldCondition(key="doc_type", match=models.MatchValue(value=doc_type))
        )
    flt = models.Filter(must=must)
    if date_from:
        flt.must.append(
            models.FieldCondition(
                key="doc_date", range=models.DatetimeRange(gte=date_from)
            )
        )
    return flt


@functools.lru_cache(maxsize=1)
def _cached_client() -> QdrantClient:
    """One client per process so the HTTP connection pool is reused.

    Before Phase 9 every call built a new client, so a single ask (hybrid search
    plus the dense pass, per query variant) paid 2-4 fresh TCP/TLS handshakes to
    the cloud instance. The client is thread-safe; ``reset_client`` is the only
    supported way to drop it.
    """
    settings = get_settings()
    try:
        return QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key.get_secret_value() or None,
            timeout=settings.qdrant_timeout_seconds,
        )
    except Exception as exc:  # construction failures are also dependency failures
        raise DependencyUnavailable("qdrant", detail=type(exc).__name__) from exc


def _client() -> QdrantClient:
    return _cached_client()


def reset_client() -> None:
    """Close and forget the shared client (shutdown and tests)."""
    try:
        _cached_client().close()
    except Exception:  # noqa: BLE001 - already closed / never created
        pass
    _cached_client.cache_clear()


def get_client() -> QdrantClient:
    """Public client factory for scripts/tools (still the only qdrant importer)."""
    return _client()


def collection_dim(
    collection_name: str | None = None, client: QdrantClient | None = None
) -> int | None:
    """Dense vector size stored in the collection, or None if unknown."""
    c = client or _client()
    info = _call(c.get_collection, _collection_name(collection_name))
    vectors = info.config.params.vectors
    dense = vectors.get("dense") if isinstance(vectors, dict) else vectors
    size = getattr(dense, "size", None)
    return int(size) if size is not None else None


def _call(fn: Any, /, *args: Any, **kwargs: Any) -> Any:
    """Run a qdrant call with transient retry; any final failure -> 503.

    Network/timeout failures are retried with exponential backoff (indexing is
    safe to retry because point ids are deterministic). ApiError instances
    raised by our own validation pass through untouched. Exception messages are
    never logged (they can embed the instance URL).
    """
    try:
        return _retrying()(fn, *args, **kwargs)
    except ApiError:
        raise
    except Exception as exc:
        logger.warning("qdrant_call_failed class=%s", type(exc).__name__)
        raise DependencyUnavailable("qdrant", detail=type(exc).__name__) from exc


def _collection_name(collection_name: str | None) -> str:
    return collection_name or get_settings().collection_name


def ensure_collection(
    collection_name: str | None = None, client: QdrantClient | None = None
) -> dict[str, str]:
    """Create the collection and payload indexes if missing. Idempotent.

    Collection config (plan Section 6.1): named vector ``dense`` (cosine, size
    from DENSE_DIM config) and sparse ``bm25`` with the IDF modifier. Payload
    indexes (Section 6.2): patient_id/document_id/parent_id/doc_type keyword,
    doc_date datetime.

    Returns {"collection": name, "date_index": "datetime" | "integer"}.
    The integer fallback (doc_date_int) is created ONLY if the server rejects
    the datetime index, and the choice is reported by the caller.
    """
    settings = get_settings()
    name = _collection_name(collection_name)
    c = client or _client()

    if not _call(c.collection_exists, name):
        _call(
            c.create_collection,
            collection_name=name,
            vectors_config={
                "dense": models.VectorParams(
                    size=settings.dense_dim, distance=models.Distance.COSINE
                )
            },
            sparse_vectors_config={
                "bm25": models.SparseVectorParams(modifier=models.Modifier.IDF)
            },
        )

    # patient_id/document_id/parent_id/doc_type per plan 6.2; "version" is the
    # Section 6.3 payload-key allowance - Qdrant refuses to filter on it
    # (versioned delete) without an index.
    for field in ("patient_id", "document_id", "parent_id", "doc_type", "version"):
        _call(
            c.create_payload_index,
            collection_name=name,
            field_name=field,
            field_schema=models.PayloadSchemaType.KEYWORD,
        )

    try:
        # Raw call so a schema rejection (old server) can be told apart from a
        # connectivity failure, which _call would wrap as DependencyUnavailable.
        c.create_payload_index(
            collection_name=name,
            field_name="doc_date",
            field_schema=models.PayloadSchemaType.DATETIME,
        )
        date_index = "datetime"
    except ApiError:
        raise
    except Exception as exc:
        logger.warning("datetime index rejected (class=%s); using integer fallback", type(exc).__name__)
        _call(
            c.create_payload_index,
            collection_name=name,
            field_name="doc_date_int",
            field_schema=models.PayloadSchemaType.INTEGER,
        )
        date_index = "integer"

    return {"collection": name, "date_index": date_index}


def make_sparse_vector(indices: list[int], values: list[float]) -> models.SparseVector:
    """Build a sparse vector without callers needing qdrant_client types."""
    return models.SparseVector(indices=list(indices), values=list(values))


def build_point(
    point_id: str,
    dense_vector: list[float],
    sparse_indices: list[int],
    sparse_values: list[float],
    payload: dict,
) -> models.PointStruct:
    """Build a point with the two named vectors (dense + bm25)."""
    return models.PointStruct(
        id=point_id,
        vector={
            "dense": list(dense_vector),
            "bm25": models.SparseVector(
                indices=list(sparse_indices), values=list(sparse_values)
            ),
        },
        payload=payload,
    )


def upsert_points(
    points: list[models.PointStruct],
    collection_name: str | None = None,
    client: QdrantClient | None = None,
) -> None:
    """Upsert prepared points (wait=True). Callers set patient_id in payload."""
    c = client or _client()
    _call(
        c.upsert,
        collection_name=_collection_name(collection_name),
        points=points,
        wait=True,
    )


def delete_document(
    document_id: str,
    keep_version: str | None = None,
    collection_name: str | None = None,
    client: QdrantClient | None = None,
) -> None:
    """Delete every point of one document; with keep_version, all EXCEPT that
    version (versioned replacement: new version first, then delete the old).
    Idempotent - deleting a missing document changes nothing."""
    c = client or _client()
    flt = models.Filter(
        must=[
            models.FieldCondition(
                key="document_id", match=models.MatchValue(value=document_id)
            )
        ]
    )
    if keep_version is not None:
        flt.must_not = [
            models.FieldCondition(
                key="version", match=models.MatchValue(value=keep_version)
            )
        ]
    _call(
        c.delete,
        collection_name=_collection_name(collection_name),
        points_selector=models.FilterSelector(filter=flt),
        wait=True,
    )


def delete_patient(
    patient_id: str, collection_name: str | None = None, client: QdrantClient | None = None
) -> None:
    """Delete every point of one patient. Raises unless patient_id is non-empty."""
    c = client or _client()
    _call(
        c.delete,
        collection_name=_collection_name(collection_name),
        points_selector=models.FilterSelector(filter=patient_filter(patient_id)),
        wait=True,
    )


def scroll_document(
    document_id: str,
    patient_id: str,
    collection_name: str | None = None,
    client: QdrantClient | None = None,
    limit: int = 1000,
) -> list[models.Record]:
    """All points of one document for one patient (both filters applied)."""
    c = client or _client()
    flt = patient_filter(patient_id)
    flt.must.append(
        models.FieldCondition(key="document_id", match=models.MatchValue(value=document_id))
    )
    points, _next = _call(
        c.scroll,
        collection_name=_collection_name(collection_name),
        scroll_filter=flt,
        limit=limit,
        with_payload=True,
        with_vectors=False,
    )
    return list(points)


def count_for_patient(
    patient_id: str, collection_name: str | None = None, client: QdrantClient | None = None
) -> int:
    c = client or _client()
    result = _call(
        c.count,
        collection_name=_collection_name(collection_name),
        count_filter=patient_filter(patient_id),
        exact=True,
    )
    return int(result.count)


def search_dense(
    patient_id: str,
    dense_vector: list[float],
    doc_type: str | None = None,
    date_from: str | None = None,
    limit: int | None = None,
    collection_name: str | None = None,
    client: QdrantClient | None = None,
) -> list[models.ScoredPoint]:
    """Single-branch dense search (used for the relevance signal in Phase 5)."""
    c = client or _client()
    flt = patient_filter(patient_id, doc_type, date_from)
    result = _call(
        c.query_points,
        collection_name=_collection_name(collection_name),
        query=dense_vector,
        using="dense",
        limit=limit or get_settings().wide_k,
        query_filter=flt,
        with_payload=True,
    )
    return list(result.points)


def search_sparse(
    patient_id: str,
    sparse_vector: models.SparseVector,
    doc_type: str | None = None,
    date_from: str | None = None,
    limit: int | None = None,
    collection_name: str | None = None,
    client: QdrantClient | None = None,
) -> list[models.ScoredPoint]:
    """Single-branch BM25 search (exact terms, doses, lab values)."""
    c = client or _client()
    flt = patient_filter(patient_id, doc_type, date_from)
    result = _call(
        c.query_points,
        collection_name=_collection_name(collection_name),
        query=sparse_vector,
        using="bm25",
        limit=limit or get_settings().wide_k,
        query_filter=flt,
        with_payload=True,
    )
    return list(result.points)


def hybrid_search(
    patient_id: str,
    dense_vector: list[float],
    sparse_vector: models.SparseVector,
    doc_type: str | None = None,
    date_from: str | None = None,
    limit: int | None = None,
    collection_name: str | None = None,
    client: QdrantClient | None = None,
) -> list[models.ScoredPoint]:
    """Fused dense+BM25 search via the Query API (RRF).

    The patient filter is passed to EVERY prefetch branch and to the outer
    query (plan issue A6) so no other patient's point can enter the fusion.
    """
    c = client or _client()
    flt = patient_filter(patient_id, doc_type, date_from)
    k = limit or get_settings().wide_k
    result = _call(
        c.query_points,
        collection_name=_collection_name(collection_name),
        prefetch=[
            models.Prefetch(query=dense_vector, using="dense", limit=k, filter=flt),
            models.Prefetch(query=sparse_vector, using="bm25", limit=k, filter=flt),
        ],
        query=models.FusionQuery(fusion=models.Fusion.RRF),
        query_filter=flt,
        limit=k,
        with_payload=True,
    )
    return list(result.points)


def search_by_date(
    patient_id: str,
    doc_type: str | None = None,
    date_from: str | None = None,
    limit: int = 50,
    ascending: bool = False,
    collection_name: str | None = None,
    client: QdrantClient | None = None,
) -> list[models.Record]:
    """Scroll ordered by the real medical date doc_date (newest first by
    default). order_by belongs to scroll, not to vector search - the "latest"
    logic in Phase 5 searches first, then orders the candidates."""
    c = client or _client()
    flt = patient_filter(patient_id, doc_type, date_from)
    points, _next = _call(
        c.scroll,
        collection_name=_collection_name(collection_name),
        scroll_filter=flt,
        limit=limit,
        with_payload=True,
        with_vectors=False,
        order_by=models.OrderBy(
            key="doc_date",
            direction=models.Direction.ASC if ascending else models.Direction.DESC,
        ),
    )
    return list(points)
