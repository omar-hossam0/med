"""Chunker dispatcher (plan Phase 3).

``chunk_document`` is the single entry point used by the ingestion pipeline.
It never raises: an unexpected error is logged (class name + ids only, never
text) and the document falls back to the generic chunker.
"""

from __future__ import annotations

import logging

from app.schemas.contract import IngestRequest
from app.services.chunking.base import Child, flatten
from app.services.chunking.generic import chunk_generic
from app.services.chunking.lab import chunk_lab
from app.services.chunking.prescription import chunk_prescription
from app.services.chunking.report import chunk_report
from app.services.chunking.session import chunk_session
from app.services.normalizer import normalize

logger = logging.getLogger(__name__)


def _source_lines(request: IngestRequest, doc_type: str) -> list[str]:
    if doc_type == "session_report" and request.session_report_data is not None:
        full = (request.session_report_data.full_report_text or "").strip()
        return full.split("\n") if full else []
    ocr = request.ocr_output
    if ocr is None:
        return []
    if ocr.lines:
        return list(ocr.lines)
    return ocr.raw_text.split("\n")


def _warn_if_sources_disagree(request: IngestRequest, lines: list[str]) -> None:
    ocr = request.ocr_output
    if ocr is None or not ocr.lines:
        return
    lines_blob = normalize(" ".join(lines)).lower()
    raw_blob = normalize(ocr.raw_text).lower()
    if not lines_blob or not raw_blob:
        return
    if lines_blob in raw_blob or raw_blob in lines_blob:
        return
    logger.warning("ocr_lines_mismatch document_id=%s", request.document_id)


def chunk_document(
    request: IngestRequest, doc_type: str, doc_date: str
) -> list[Child]:
    lines = _source_lines(request, doc_type)
    _warn_if_sources_disagree(request, lines)
    document_id = request.document_id

    try:
        if doc_type == "lab_result":
            parents = chunk_lab(lines, doc_date, document_id)
        elif doc_type == "prescription":
            parents = chunk_prescription(lines, doc_date, document_id)
        elif doc_type in {"medical_report", "radiology"}:
            parents = chunk_report(lines, doc_type, doc_date, document_id)
        elif doc_type == "session_report":
            parents = chunk_session(
                lines,
                doc_date,
                document_id,
                data=request.session_report_data,
            )
        else:
            parents = chunk_generic(lines, doc_type, doc_date, document_id)
    except Exception as exc:  # noqa: BLE001 - the pipeline must never crash here
        logger.warning(
            "chunk_fallback doc_type=%s document_id=%s error=%s",
            doc_type,
            document_id,
            type(exc).__name__,
        )
        try:
            parents = chunk_generic(lines, doc_type, doc_date, document_id)
        except Exception as fallback_exc:  # noqa: BLE001
            logger.warning(
                "chunk_failed doc_type=%s document_id=%s error=%s",
                doc_type,
                document_id,
                type(fallback_exc).__name__,
            )
            return []

    return flatten(parents)
