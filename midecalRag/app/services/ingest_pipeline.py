"""Ingestion pipeline (plan Phase 2).

The pipeline is injectable: chunker and embedder are fakes in this phase
(deterministic, no network, no ML); real chunking arrives in Phase 3 and
FastEmbed in Phase 4. The store step is the real Phase 1 vectorstore.

Replacement semantics (issue P12): insert the NEW version first, then delete
every point of the same document with a different version. On any failure the
previous version stays searchable and the manifest row becomes ``failed``
with a short code.

A per-document lock serializes concurrent ingests of the same id, and each
job re-claims its version inside the lock so the manifest version always
matches the job that ran last.
"""

from __future__ import annotations

import hashlib
import logging
import random
import re
import threading
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.config import get_settings
from app.db import manifest
from app.schemas.contract import IngestRequest
from app.schemas.errors import ApiError
from app.services import vectorstore as vs
from app.services.chunking import chunk_document
from app.services.chunking.base import Child
from app.services.embedder import get_embedder

logger = logging.getLogger(__name__)

_doc_locks_guard = threading.Lock()
_doc_locks: dict[str, threading.Lock] = {}


def _doc_lock(document_id: str) -> threading.Lock:
    with _doc_locks_guard:
        lock = _doc_locks.get(document_id)
        if lock is None:
            lock = threading.Lock()
            _doc_locks[document_id] = lock
        return lock


@dataclass
class IngestPipeline:
    """chunk -> list[Child]; embed -> (dense vectors, (indices, values) tuples)."""

    chunk: Callable[[IngestRequest, str, str], list[Child]]
    embed: Callable[[list[str]], tuple[list[list[float]], list[tuple[list[int], list[float]]]]]


# ---------------------------------------------------------------------------
# Phase 2 deterministic fakes (replaced by Phase 3 chunker / Phase 4 embedder)
# ---------------------------------------------------------------------------

_MAX_FAKE_CHILDREN = 200


def fake_chunk(request: IngestRequest, doc_type: str, doc_date: str) -> list[Child]:
    """One child per non-empty OCR line, or per non-empty session section.
    One parent per document (the whole text). Purely deterministic."""
    parent_text = ""
    pieces: list[tuple[str, str]] = []  # (child text, raw snippet)

    if request.session_report_data is not None:
        data = request.session_report_data
        if data.full_report_text:
            parent_text = data.full_report_text
        for name in (
            "chief_complaint",
            "history_of_present_illness",
            "assessment_and_diagnosis",
            "treatment_plan",
        ):
            value = getattr(data, name)
            if value and value.strip():
                label = name.replace("_", " ").title()
                pieces.append((f"{label}: {value.strip()}", value.strip()))
        for key, value in (data.model_extra or {}).items():
            if isinstance(value, str) and value.strip():
                label = key.replace("_", " ").title()
                pieces.append((f"{label}: {value.strip()}", value.strip()))
        if not parent_text:
            parent_text = "\n".join(text for text, _ in pieces)
    else:
        assert request.ocr_output is not None
        ocr = request.ocr_output
        lines = ocr.lines or ocr.raw_text.split("\n")
        for line in lines:
            if line.strip():
                pieces.append((line.strip(), line))
        parent_text = ocr.raw_text

    parent_id = f"{request.document_id}#p0"
    children = [
        Child(
            child_text=text,
            raw_snippet=snippet,
            parent_text=parent_text,
            parent_id=parent_id,
            child_index=index,
        )
        for index, (text, snippet) in enumerate(pieces[:_MAX_FAKE_CHILDREN])
    ]
    return children


def _dense_for(text: str) -> list[float]:
    seed = int(hashlib.md5(text.encode("utf-8")).hexdigest()[:8], 16)
    rng = random.Random(seed)
    dim = get_settings().dense_dim
    vec = [rng.uniform(-1.0, 1.0) for _ in range(dim)]
    norm = sum(v * v for v in vec) ** 0.5 or 1.0
    return [v / norm for v in vec]


def _sparse_for(text: str) -> tuple[list[int], list[float]]:
    tokens = re.findall(r"\w+", text.lower())
    indices = sorted(
        {int(hashlib.md5(token.encode("utf-8")).hexdigest()[:6], 16) % 100000 for token in tokens}
    )
    if not indices:
        indices = [0]
    return indices, [1.0] * len(indices)


def fake_embed(texts: list[str]) -> tuple[list[list[float]], list[tuple[list[int], list[float]]]]:
    return [_dense_for(t) for t in texts], [_sparse_for(t) for t in texts]


default_pipeline = IngestPipeline(
    chunk=chunk_document, embed=get_embedder().embed_children
)


# ---------------------------------------------------------------------------
# Background job
# ---------------------------------------------------------------------------


def process_document(
    request: IngestRequest,
    doc_type: str,
    doc_date: str,
    date_source: str,
    *,
    version: str,
    pipeline: IngestPipeline | None = None,
    engine: Any = None,
    collection_name: str | None = None,
    client: Any = None,
    upsert_fn: Callable | None = None,
    delete_fn: Callable | None = None,
) -> None:
    """Run one ingest attempt: manifest processing -> upsert new version ->
    delete other versions -> manifest indexed. Never raises (the manifest is
    the source of truth; failures become status=failed with a short code)."""
    pipe = pipeline or default_pipeline
    ups = upsert_fn or vs.upsert_points
    dele = delete_fn or vs.delete_document

    with _doc_lock(request.document_id):
        # Re-claim inside the lock (upsert) so the manifest version always
        # matches the job that ran last when two ingests of one id race.
        manifest.claim_processing(
            document_id=request.document_id,
            patient_id=request.patient_id,
            version=version,
            doc_type=doc_type,
            doc_date=doc_date,
            date_source=date_source,
            upload_date=request.uploaded_at.isoformat(),
            source="session_agent" if request.session_report_data is not None else "ocr",
            engine=engine,
        )
        try:
            children = pipe.chunk(request, doc_type, doc_date)
            if not children:
                raise ValueError("chunker produced no children")
            dense_vectors, sparse_vectors = pipe.embed([c.child_text for c in children])
            points = []
            for child, dense_vec, (sparse_idx, sparse_vals) in zip(
                children, dense_vectors, sparse_vectors, strict=True
            ):
                payload = {
                    "patient_id": request.patient_id,
                    "document_id": request.document_id,
                    "parent_id": child.parent_id,
                    "doc_type": doc_type,
                    "doc_date": doc_date,
                    "child_text": child.child_text,
                    "raw_snippet": child.raw_snippet,
                    "parent_text": child.parent_text,
                    "version": version,
                    "child_index": child.child_index,
                }
                points.append(
                    vs.build_point(
                        vs.point_id(request.document_id, version, child.child_index),
                        dense_vec,
                        sparse_idx,
                        sparse_vals,
                        payload,
                    )
                )
            # New version in FIRST, then remove the old ones (P12).
            ups(points, collection_name=collection_name, client=client)
            dele(
                request.document_id,
                keep_version=version,
                collection_name=collection_name,
                client=client,
            )
            settings = get_settings()
            manifest.mark_indexed(
                document_id=request.document_id,
                version=version,
                child_count=len(children),
                doc_type=doc_type,
                doc_date=doc_date,
                date_source=date_source,
                dense_model=settings.dense_model,
                sparse_model=settings.sparse_model,
                dense_dim=len(dense_vectors[0]) if dense_vectors else settings.dense_dim,
                engine=engine,
            )
        except Exception as exc:
            if isinstance(exc, ApiError):
                code = exc.code
            else:
                code = "ingest_failed"
            manifest.mark_failed(request.document_id, code, engine=engine)
            # ids and class names only - never document text
            logger.warning(
                "ingest_failed document_id=%s version=%s class=%s",
                request.document_id,
                version,
                type(exc).__name__,
            )
