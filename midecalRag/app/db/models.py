"""Manifest table (plan Phase 2 task B1). Stores ids, dates, counts and short
error codes ONLY - never document text (plan rule 5 / D-requirements)."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utcnow_naive() -> datetime:
    # Naive UTC everywhere: SQLite comparisons must stay consistent.
    return datetime.now(UTC).replace(tzinfo=None)


class Document(Base):
    __tablename__ = "documents"

    document_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    patient_id: Mapped[str] = mapped_column(String(128), index=True)
    # processing | indexed | failed
    status: Mapped[str] = mapped_column(String(16), index=True)
    version: Mapped[str] = mapped_column(String(64))
    child_count: Mapped[int] = mapped_column(Integer, default=0)
    doc_type: Mapped[str] = mapped_column(String(32))
    # ISO YYYY-MM-DD or NULL when no date could be resolved (not expected:
    # upload fallback always yields one)
    doc_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # user | ocr | text | text_ambiguous | upload | consultation | approval | approval_time
    date_source: Mapped[str] = mapped_column(String(24))
    upload_date: Mapped[str] = mapped_column(String(40))
    # ocr | session_agent
    source: Mapped[str] = mapped_column(String(16))
    dense_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    sparse_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    dense_dim: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow_naive, onupdate=utcnow_naive
    )
