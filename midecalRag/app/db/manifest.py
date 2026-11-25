"""Manifest operations (plan Phase 2). The manifest is the source of truth
for document status. Only ids, dates, counts and short codes are stored."""

from __future__ import annotations

import logging
import threading
from contextlib import contextmanager
from datetime import timedelta
from typing import Any

from sqlalchemy import select, update

from app.db import open_session
from app.db.models import Document, utcnow_naive

logger = logging.getLogger(__name__)

# SQLite writes are serialized in-process (background tasks + API thread).
_write_lock = threading.Lock()


@contextmanager
def _session(engine=None):
    session = open_session(engine)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def create_processing(
    *,
    document_id: str,
    patient_id: str,
    version: str,
    doc_type: str,
    doc_date: str,
    date_source: str,
    upload_date: str,
    source: str,
    engine: Any = None,
) -> None:
    """Insert or reset the manifest row to status=processing."""
    with _write_lock, _session(engine) as session:
        row = session.get(Document, document_id)
        if row is None:
            row = Document(document_id=document_id)
            session.add(row)
        row.patient_id = patient_id
        row.status = "processing"
        row.version = version
        row.child_count = 0
        row.doc_type = doc_type
        row.doc_date = doc_date
        row.date_source = date_source
        row.upload_date = upload_date
        row.source = source
        row.error_code = None
        row.updated_at = utcnow_naive()


def claim_processing(
    *,
    document_id: str,
    patient_id: str,
    version: str,
    doc_type: str,
    doc_date: str,
    date_source: str,
    upload_date: str,
    source: str,
    engine: Any = None,
) -> None:
    """Re-assert this version inside the per-document lock (upsert: creates
    the row when the pipeline is invoked directly). Guarantees the manifest
    version always matches the job that ran LAST when two ingests of one id
    race: points and manifest end on the same version."""
    create_processing(
        document_id=document_id,
        patient_id=patient_id,
        version=version,
        doc_type=doc_type,
        doc_date=doc_date,
        date_source=date_source,
        upload_date=upload_date,
        source=source,
        engine=engine,
    )


def mark_indexed(
    document_id: str,
    version: str,
    child_count: int,
    doc_type: str,
    doc_date: str,
    date_source: str,
    dense_model: str,
    sparse_model: str,
    dense_dim: int | None = None,
    engine: Any = None,
) -> None:
    with _write_lock, _session(engine) as session:
        row = session.get(Document, document_id)
        if row is None:
            return
        row.status = "indexed"
        row.version = version
        row.child_count = child_count
        row.doc_type = doc_type
        row.doc_date = doc_date
        row.date_source = date_source
        row.dense_model = dense_model
        row.sparse_model = sparse_model
        row.dense_dim = dense_dim
        row.error_code = None
        row.updated_at = utcnow_naive()


def update_models(
    document_id: str,
    dense_model: str,
    sparse_model: str,
    dense_dim: int,
    engine: Any = None,
) -> None:
    """Record the model signature after a re-index (Phase 4 reindex tool)."""
    with _write_lock, _session(engine) as session:
        row = session.get(Document, document_id)
        if row is None:
            return
        row.dense_model = dense_model
        row.sparse_model = sparse_model
        row.dense_dim = dense_dim
        row.updated_at = utcnow_naive()


def indexed_model_rows(engine: Any = None) -> list[dict[str, Any]]:
    """Model signatures of every indexed document (ids/models/dim only)."""
    with _session(engine) as session:
        rows = session.execute(
            select(
                Document.document_id,
                Document.dense_model,
                Document.sparse_model,
                Document.dense_dim,
            ).where(Document.status == "indexed")
        ).all()
    return [
        {
            "document_id": row[0],
            "dense_model": row[1],
            "sparse_model": row[2],
            "dense_dim": row[3],
        }
        for row in rows
    ]


def mark_failed(document_id: str, error_code: str, engine: Any = None) -> None:
    with _write_lock, _session(engine) as session:
        row = session.get(Document, document_id)
        if row is None:
            return
        row.status = "failed"
        row.error_code = error_code
        row.updated_at = utcnow_naive()


def get_document(document_id: str, engine: Any = None) -> Document | None:
    with _session(engine) as session:
        return session.get(Document, document_id)


def recover_stuck(max_age_seconds: int, engine: Any = None) -> int:
    """Startup recovery (plan P13): rows stuck in processing longer than the
    threshold are marked failed with a short code. Returns the count."""
    cutoff = utcnow_naive() - timedelta(seconds=max_age_seconds)
    with _write_lock, _session(engine) as session:
        result = session.execute(
            update(Document)
            .where(Document.status == "processing", Document.updated_at < cutoff)
            .values(status="failed", error_code="stale_processing", updated_at=utcnow_naive())
        )
        return int(result.rowcount or 0)
