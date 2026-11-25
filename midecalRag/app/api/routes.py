"""Protected RAG endpoints.

Phase 2: POST /rag/ingest is real (validate -> resolve -> manifest ->
background job -> 202).
Phase 6: POST /rag/ask runs the full grounded pipeline (history rewrite ->
retrieval -> generation -> verification -> citations) off the event loop and
returns ``{"answer", "sources"}`` only. Audit logging and rate limiting are
Phase 7.
"""

import asyncio
import logging
import time
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.responses import JSONResponse

from app.api.deps import require_api_key, require_model_ready
from app.api.ratelimit import require_rate_limit
from app.config import get_settings
from app.db import manifest
from app.schemas.contract import (
    AskRequest,
    AskResponse,
    IngestAccepted,
    IngestRequest,
)
from app.schemas.errors import ApiError, text_too_large
from app.schemas.summary import PatientSummaryRequest, PatientSummaryResponse
from app.services.audit import get_audit_logger
from app.services.generator import answer_question
from app.services.ingest_pipeline import process_document
from app.services.patient_summary import build_patient_summary
from app.services.resolver import resolve_doc_date, resolve_doc_type

logger = logging.getLogger(__name__)

router = APIRouter(
    dependencies=[Depends(require_api_key), Depends(require_rate_limit)]
)


def _request_id(http_request: Request) -> str:
    return str(getattr(http_request.state, "request_id", "") or "")


def _error_response(error: ApiError) -> JSONResponse:
    return JSONResponse(status_code=error.status_code, content=error.to_body())


def _primary_text(request: IngestRequest) -> str:
    """The text the size limit applies to (plan O4)."""
    if request.session_report_data is not None:
        data = request.session_report_data
        parts = [data.full_report_text or ""]
        for name in (
            "chief_complaint",
            "history_of_present_illness",
            "assessment_and_diagnosis",
            "treatment_plan",
        ):
            value = getattr(data, name)
            if value:
                parts.append(value)
        for value in (data.model_extra or {}).values():
            if isinstance(value, str) and value.strip():
                parts.append(value)
        return "\n".join(p for p in parts if p.strip())
    assert request.ocr_output is not None
    return request.ocr_output.raw_text


@router.post("/rag/ingest", dependencies=[Depends(require_model_ready)])
async def ingest(
    request: IngestRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
) -> JSONResponse:
    settings = get_settings()

    text = _primary_text(request)
    if len(text) > settings.max_text_chars:
        raise text_too_large()

    doc_type, _mismatch = resolve_doc_type(
        request.user_selected_type,
        request.ocr_output.detected_doc_type if request.ocr_output else None,
        document_id=request.document_id,
    )
    report = request.session_report_data
    doc_date, date_source = resolve_doc_date(
        user_selected_date=request.user_selected_date,
        extracted_date=request.ocr_output.extracted_date if request.ocr_output else None,
        raw_text=text,
        uploaded_at=request.uploaded_at,
        is_session_report=doc_type == "session_report",
        consultation_date=report.consultation_date if report else None,
        approved_at=report.approved_at if report else None,
    )

    version = uuid.uuid4().hex
    manifest.create_processing(
        document_id=request.document_id,
        patient_id=request.patient_id,
        version=version,
        doc_type=doc_type,
        doc_date=doc_date,
        date_source=date_source,
        upload_date=request.uploaded_at.isoformat(),
        source="session_agent" if request.session_report_data is not None else "ocr",
    )
    # The endpoint never waits for embedding or Qdrant: the manifest write
    # above is the last synchronous step before 202.
    background_tasks.add_task(
        process_document,
        request,
        doc_type,
        doc_date,
        date_source,
        version=version,
    )
    accepted = IngestAccepted(document_id=request.document_id, status="processing")
    get_audit_logger().record(
        request_id=_request_id(http_request),
        endpoint="/rag/ingest",
        patient_id=request.patient_id,
        status=202,
        latency_ms=0.0,
        source_count=0,
        result_type="accepted",
    )
    return JSONResponse(status_code=202, content=accepted.model_dump())


@router.post("/rag/ask", dependencies=[Depends(require_model_ready)])
async def ask(request: AskRequest, http_request: Request) -> JSONResponse:
    """Answer one doctor question from this patient's documents only."""
    started = time.perf_counter()
    # Retrieval, embedding and the LLM call are all blocking: run them in a
    # worker thread so the event loop keeps serving /health and other requests.
    outcome = await asyncio.to_thread(
        answer_question,
        request.patient_id,
        request.doctor_query,
        request.chat_history,
        request.optional_filters,
    )
    latency_ms = round((time.perf_counter() - started) * 1000, 2)
    # Safe keys only: no question, no answer, no patient text, no patient id.
    logger.info(
        "ask_response",
        extra={
            "mode": outcome.mode,
            "result_type": outcome.result_type,
            "parent_count": outcome.parent_count,
            "source_count": len(outcome.sources),
            "rewritten": outcome.rewritten,
            "provider": outcome.provider,
            "latency_ms": latency_ms,
        },
    )
    body = AskResponse(answer=outcome.answer, sources=outcome.sources)
    get_audit_logger().record(
        request_id=_request_id(http_request),
        endpoint="/rag/ask",
        patient_id=request.patient_id,
        status=200,
        latency_ms=latency_ms,
        source_count=len(outcome.sources),
        mode=outcome.mode,
        result_type=outcome.result_type,
    )
    return JSONResponse(status_code=200, content=body.model_dump())


@router.post("/rag/patient-summary", dependencies=[Depends(require_model_ready)])
async def patient_summary(
    request: PatientSummaryRequest, http_request: Request
) -> JSONResponse:
    """Return a grounded doctor brief built from this patient's own documents."""
    started = time.perf_counter()
    outcome = await asyncio.to_thread(
        build_patient_summary,
        request.patient_id,
        request.optional_filters,
        request.language,
        request.max_documents,
    )
    latency_ms = round((time.perf_counter() - started) * 1000, 2)
    # Safe keys only: no patient text, no document text, no patient id.
    logger.info(
        "patient_summary_response",
        extra={
            "status": outcome.status,
            "language": outcome.language,
            "document_count": outcome.document_count,
            "section_count": len(outcome.sections),
            "source_count": len(outcome.sources),
            "provider": outcome.provider,
            "latency_ms": latency_ms,
        },
    )
    body = PatientSummaryResponse(
        status=outcome.status,
        message=outcome.message,
        sections=outcome.sections,
        sources=outcome.sources,
    )
    get_audit_logger().record(
        request_id=_request_id(http_request),
        endpoint="/rag/patient-summary",
        patient_id=request.patient_id,
        status=200,
        latency_ms=latency_ms,
        source_count=len(outcome.sources),
        result_type=outcome.status,
    )
    return JSONResponse(status_code=200, content=body.model_dump())
