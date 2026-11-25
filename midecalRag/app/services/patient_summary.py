"""Patient summary / doctor brief (owner addition, 2026-11-23).

The plan has no patient-summary phase; this module implements the owner's
Phase 7 request on top of the Phase 5/6 building blocks.

Flow:
1. collect the most recent records of the patient across every document type
   (prescription, lab_result, medical_report, radiology, session_report),
   strictly filtered by ``patient_id`` - no semantic query is needed because a
   brief covers the whole file, not a question;
2. de-identify the context before any external LLM call;
3. one LLM call that must emit the four fixed headings (MEDICATIONS, LABS,
   REPORTS, VISITS);
4. parse the headings into sections, strip ``[n]`` markers and map every marker
   to a **retrieved record** (a hallucinated index is dropped and counted);
5. verify every number-with-unit / decimal / drug-like token against the same
   context (one stricter retry, then a withheld safe message);
6. no records -> localized message, empty sections and sources, no LLM call.
"""

from __future__ import annotations

import logging
import re
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from app.config import get_settings
from app.schemas.errors import invalid_request
from app.schemas.summary import PatientSummaryResponse, SummarySection, SummaryStatus
from app.services.deidentify import scrub
from app.services.generator import extract_citations
from app.services.llm.base import is_truncated
from app.services.llm.factory import get_llm_chain
from app.services.prompt import (
    SECTION_DOC_TYPES,
    SUMMARY_SECTIONS,
    build_context,
    build_summary_messages,
    no_records_message,
    resolve_language,
    section_title,
    strict_instruction,
    summary_ok_message,
    summary_unverified_message,
)
from app.services.verifier import VerificationResult, verify_answer

logger = logging.getLogger(__name__)

DOC_TYPES = ("prescription", "lab_result", "medical_report", "radiology", "session_report")
_TYPE_ORDER = {doc_type: index for index, doc_type in enumerate(DOC_TYPES)}
_MAX_FALLBACK_SOURCES = 3

_HEADING = re.compile(
    r"^[ \t>*#]*(MEDICATIONS|LABS|REPORTS|VISITS)[ \t]*:?[ \t]*\**[ \t]*$",
    re.IGNORECASE | re.MULTILINE,
)
_BULLET = re.compile(r"^[ \t]*(?:[-*\u2022]+[ \t]*)?", re.MULTILINE)
_NONE_LINES = re.compile(
    r"^[ \t]*(?:none documented\.?|none\.?|no data\.?|لا يوجد\.?|لا توجد معلومات\.?)[ \t]*$",
    re.IGNORECASE | re.MULTILINE,
)


@dataclass(frozen=True)
class SummaryRecord:
    """One parent selected for the brief (the unit the LLM cites)."""

    parent_id: str
    document_id: str
    doc_type: str
    doc_date: str
    parent_text: str
    snippet: str


@dataclass(frozen=True)
class PatientSummary:
    """Service-level outcome (the route maps it to ``PatientSummaryResponse``)."""

    status: SummaryStatus
    message: str
    sections: list[SummarySection]
    sources: list
    language: str
    provider: str | None = None
    document_count: int = 0
    record_count: int = 0
    hallucinated_citations: int = 0
    regenerated: bool = False
    timings_ms: dict[str, float] = field(default_factory=dict)
    tokens: dict[str, int | None] = field(default_factory=dict)

    def to_response(self) -> PatientSummaryResponse:
        return PatientSummaryResponse(
            status=self.status,
            message=self.message,
            sections=self.sections,
            sources=self.sources,
        )


# --------------------------------------------------------------------------- #
# record collection
# --------------------------------------------------------------------------- #
def _filter_value(filters: Any, name: str) -> Any:
    if filters is None:
        return None
    value = getattr(filters, name, None)
    if value is None and isinstance(filters, dict):
        value = filters.get(name)
    return value


def _as_iso_date(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    return text[:10] if text else None


def collect_recent_records(
    patient_id: str,
    filters: Any = None,
    *,
    max_documents: int | None = None,
    per_type: int | None = None,
    client: Any = None,
) -> list[SummaryRecord]:
    """Most recent documents of every type, newest first, capped by document."""
    from app.services import vectorstore as vs

    settings = get_settings()
    per_type = int(per_type or settings.summary_docs_per_type)
    cap = int(max_documents or settings.summary_max_documents)
    date_from = _as_iso_date(_filter_value(filters, "date_from"))
    hard_doc_type = _filter_value(filters, "doc_type")
    types = (str(hard_doc_type),) if hard_doc_type else DOC_TYPES

    records: list[SummaryRecord] = []
    for doc_type in types:
        points = vs.search_by_date(
            patient_id,
            doc_type=doc_type,
            date_from=date_from,
            limit=max(per_type * 10, 30),
            client=client,
        )
        documents: dict[str, list[dict]] = {}
        order: list[str] = []
        for point in points:
            payload = getattr(point, "payload", None) or {}
            document_id = payload.get("document_id")
            if not document_id:
                continue
            if payload.get("patient_id") not in (None, patient_id):
                logger.warning("summary_point_skipped reason=foreign_patient")
                continue
            if document_id not in documents:
                if len(order) >= per_type:
                    continue
                documents[document_id] = []
                order.append(document_id)
            documents[document_id].append(payload)
        for document_id in order:
            parents: dict[str, dict] = {}
            for payload in documents[document_id]:
                parent_id = payload.get("parent_id")
                if not parent_id:
                    continue
                current = parents.get(parent_id)
                if current is None or len(str(payload.get("parent_text") or "")) > len(
                    str(current.get("parent_text") or "")
                ):
                    parents[parent_id] = payload
            for payload in parents.values():
                records.append(
                    SummaryRecord(
                        parent_id=str(payload["parent_id"]),
                        document_id=str(document_id),
                        doc_type=str(payload.get("doc_type") or doc_type),
                        doc_date=str(payload.get("doc_date") or ""),
                        parent_text=str(payload.get("parent_text") or ""),
                        snippet=str(payload.get("raw_snippet") or ""),
                    )
                )

    records.sort(
        key=lambda record: (record.doc_date, -_TYPE_ORDER.get(record.doc_type, 9)),
        reverse=True,
    )
    kept: list[str] = []
    selected: list[SummaryRecord] = []
    for record in records:
        if record.document_id not in kept:
            if len(kept) >= cap:
                continue
            kept.append(record.document_id)
        selected.append(record)
    return selected


# --------------------------------------------------------------------------- #
# parsing
# --------------------------------------------------------------------------- #
def _clean_body(body: str) -> str:
    text = _NONE_LINES.sub("", body or "")
    text = _BULLET.sub("", text)
    lines = [line.rstrip() for line in text.splitlines()]
    text = "\n".join(line for line in lines if line.strip())
    return re.sub(r"\n{2,}", "\n", text).strip()


def parse_sections(text: str) -> dict[str, str]:
    """Split the model output on the four fixed headings (tolerant of markdown)."""
    raw = text or ""
    matches = list(_HEADING.finditer(raw))
    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        key = match.group(1).lower()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(raw)
        body = _clean_body(raw[match.end() : end])
        if not body:
            continue
        sections[key] = f"{sections[key]}\n{body}".strip() if key in sections else body
    return sections


# --------------------------------------------------------------------------- #
# assembly
# --------------------------------------------------------------------------- #
def _source(record: SummaryRecord) -> Any:
    from app.schemas.contract import Source

    return Source(
        document_id=record.document_id,
        doc_type=record.doc_type,
        doc_date=record.doc_date,
        reference_snippet=(record.snippet or record.parent_text or "").strip()[:400],
    )


def _dedupe_sources(sources: Sequence[Any]) -> list[Any]:
    seen: set[str] = set()
    unique: list[Any] = []
    for source in sources:
        if source.document_id in seen:
            continue
        seen.add(source.document_id)
        unique.append(source)
    return unique


def _fallback_sources(records: Sequence[SummaryRecord], key: str) -> list[Any]:
    allowed = SECTION_DOC_TYPES.get(key, ())
    picked = [record for record in records if record.doc_type in allowed]
    return _dedupe_sources([_source(record) for record in picked])[:_MAX_FALLBACK_SOURCES]


def _assemble(
    text: str, records: Sequence[SummaryRecord], context_texts: Sequence[str], language: str
) -> tuple[list[SummarySection], VerificationResult, int]:
    parsed = parse_sections(text)
    sections: list[SummarySection] = []
    hallucinated_total = 0
    for key in SUMMARY_SECTIONS:
        body = parsed.get(key)
        if not body:
            continue
        cleaned, order, hallucinated = extract_citations(body, len(records))
        hallucinated_total += hallucinated
        sources = (
            _dedupe_sources([_source(records[index - 1]) for index in order])
            if order
            else _fallback_sources(records, key)
        )
        sections.append(
            SummarySection(
                key=key,  # type: ignore[arg-type]
                title=section_title(key, language),
                content=cleaned,
                sources=sources,
            )
        )
    joined = "\n".join(section.content for section in sections)
    verification = (
        verify_answer(joined, context_texts)
        if joined
        else VerificationResult(ok=False, missing_numbers=("no_sections",))
    )
    return sections, verification, hallucinated_total


def build_patient_summary(
    patient_id: str,
    filters: Any = None,
    language: str | None = None,
    max_documents: int | None = None,
    *,
    chain: Any = None,
    collector: Callable[..., list[SummaryRecord]] | None = None,
) -> PatientSummary:
    """Build one doctor brief for ``patient_id`` (never returns another patient's data)."""
    settings = get_settings()
    if not isinstance(patient_id, str) or not patient_id.strip():
        raise invalid_request("patient_id is required for a patient summary")

    resolved_language = resolve_language(language)
    started = time.perf_counter()
    timings: dict[str, float] = {}

    # 1. records ------------------------------------------------------------
    t = time.perf_counter()
    collect = collector or collect_recent_records
    records = list(collect(patient_id, filters, max_documents=max_documents))
    timings["collect_ms"] = round((time.perf_counter() - t) * 1000, 2)

    if not records:
        timings["total_ms"] = round((time.perf_counter() - started) * 1000, 2)
        logger.info(
            "patient_summary_result status=no_records records=0 language=%s total_ms=%.1f",
            resolved_language,
            timings["total_ms"],
        )
        return PatientSummary(
            status="no_records",
            message=no_records_message(resolved_language),
            sections=[],
            sources=[],
            language=resolved_language,
            timings_ms=timings,
        )

    # 2. de-identified, budgeted context -----------------------------------
    t = time.perf_counter()
    context_texts = [scrub(record.parent_text or "") for record in records]
    per_parent_cap = min(
        settings.parent_max_chars,
        max(400, settings.summary_max_chars // max(1, len(records))),
    )
    context = build_context(list(records), texts=context_texts, max_chars=per_parent_cap)
    timings["context_ms"] = round((time.perf_counter() - t) * 1000, 2)

    # 3. generation ---------------------------------------------------------
    active_chain = chain or get_llm_chain()
    t = time.perf_counter()
    result = active_chain.generate(
        build_summary_messages(context, resolved_language),
        temperature=settings.llm_temperature,
        max_tokens=settings.llm_max_tokens,
    )
    timings["generation_ms"] = round((time.perf_counter() - t) * 1000, 2)
    tokens = {
        "prompt_tokens": result.prompt_tokens,
        "completion_tokens": result.completion_tokens,
    }

    sections, verification, hallucinated = _assemble(
        result.text, records, context_texts, resolved_language
    )
    if is_truncated(result):
        # A truncated brief looks plausible but ends mid-sentence: reject it so
        # the retry (with the larger budget already configured) can fix it.
        logger.warning("summary_truncated provider=%s", getattr(result, "provider", None))
        verification = VerificationResult(ok=False, missing_numbers=("truncated",))
    regenerated = False

    # 4. one stricter retry ------------------------------------------------
    if not verification.ok:
        logger.warning(
            "summary_verification_failed attempt=1 missing=%d sections=%d",
            len(verification.missing),
            len(sections),
        )
        try:
            retry = active_chain.generate(
                build_summary_messages(
                    context,
                    resolved_language,
                    extra_instruction=strict_instruction(verification.missing),
                ),
                temperature=0.0,
                max_tokens=settings.llm_max_tokens,
            )
            regenerated = True
            retry_sections, retry_verification, retry_hallucinated = _assemble(
                retry.text, records, context_texts, resolved_language
            )
            if is_truncated(retry):
                retry_verification = VerificationResult(
                    ok=False, missing_numbers=("truncated",)
                )
            if retry_verification.ok:
                sections, verification = retry_sections, retry_verification
                hallucinated = retry_hallucinated
                result = retry
            else:
                logger.warning(
                    "summary_verification_failed attempt=2 missing=%d",
                    len(retry_verification.missing),
                )
        except Exception as exc:  # noqa: BLE001 - a failed retry is not fatal
            logger.warning("summary_regeneration_failed class=%s", type(exc).__name__)

    document_count = len({record.document_id for record in records})
    timings["total_ms"] = round((time.perf_counter() - started) * 1000, 2)

    if not verification.ok:
        sources = _dedupe_sources([_source(record) for record in records])
        logger.info(
            "patient_summary_result status=verification_failed records=%d documents=%d "
            "regenerated=%s total_ms=%.1f",
            len(records),
            document_count,
            regenerated,
            timings["total_ms"],
        )
        return PatientSummary(
            status="verification_failed",
            message=summary_unverified_message(resolved_language),
            sections=[],
            sources=sources,
            language=resolved_language,
            provider=getattr(result, "provider", None),
            document_count=document_count,
            record_count=len(records),
            hallucinated_citations=hallucinated,
            regenerated=regenerated,
            timings_ms=timings,
            tokens=tokens,
        )

    sources = _dedupe_sources(
        [source for section in sections for source in section.sources]
    )
    logger.info(
        "patient_summary_result status=ok records=%d documents=%d sections=%d sources=%d "
        "provider=%s regenerated=%s hallucinated_citations=%d total_ms=%.1f",
        len(records),
        document_count,
        len(sections),
        len(sources),
        getattr(result, "provider", None),
        regenerated,
        hallucinated,
        timings["total_ms"],
    )
    return PatientSummary(
        status="ok",
        message=summary_ok_message(document_count, resolved_language),
        sections=sections,
        sources=sources,
        language=resolved_language,
        provider=getattr(result, "provider", None),
        document_count=document_count,
        record_count=len(records),
        hallucinated_citations=hallucinated,
        regenerated=regenerated,
        timings_ms=timings,
        tokens=tokens,
    )
