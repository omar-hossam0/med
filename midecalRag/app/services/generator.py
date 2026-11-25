"""Grounded answer generation (plan Phase 6).

Orchestrates: history rewrite -> Phase 5 retrieval -> empty short circuit ->
de-identified numbered context -> LLM (OpenRouter primary, Gemini fallback) ->
citation extraction -> grounding verification (one stricter retry) -> response.

Guarantees:
- no LLM call when retrieval is empty (the fixed "not enough information"
  message is returned in the question's language with ``sources: []``);
- every returned ``Source`` is built from a *retrieved parent* only, so a
  hallucinated ``[7]`` marker can never become a citation;
- ``[n]`` markers are stripped from the answer (the contract has no ``n``);
- sources follow first-citation order, falling back to all context parents when
  a grounded answer cites nothing;
- no patient text, question or answer ever reaches the logs.
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
from app.schemas.contract import Source
from app.services.deidentify import scrub
from app.services.history import rewrite_query
from app.services.llm.base import is_truncated
from app.services.llm.factory import get_llm_chain
from app.services.prompt import (
    build_context,
    build_messages,
    insufficient_message,
    strict_instruction,
    unverified_message,
)
from app.services.verifier import VerificationResult, verify_answer

logger = logging.getLogger(__name__)

_CITATION = re.compile(r"\[(\d{1,2})\]")
_SPACE_BEFORE_PUNCT = re.compile(r"\s+([.,;:!?])")
_MULTI_SPACE = re.compile(r"[ \t]{2,}")

ResultType = str  # "answered" | "not_found" | "verification_failed"


@dataclass(frozen=True)
class GeneratedAnswer:
    """Everything the API layer needs, plus diagnostics for verification."""

    answer: str
    sources: list[Source]
    mode: str
    result_type: ResultType
    rewritten: bool
    provider: str | None = None
    parent_count: int = 0
    hallucinated_citations: int = 0
    regenerated: bool = False
    timings_ms: dict[str, float] = field(default_factory=dict)
    tokens: dict[str, int | None] = field(default_factory=dict)


def extract_citations(
    answer: str, parent_count: int
) -> tuple[str, list[int], int]:
    """Strip ``[n]`` markers; return (clean text, ordered indices, hallucinated).

    An index outside ``1..parent_count`` is a hallucinated citation: the marker
    is removed and counted, and it can never reach ``sources``.
    """
    order: list[int] = []
    hallucinated = 0

    def _replace(match: re.Match[str]) -> str:
        nonlocal hallucinated
        index = int(match.group(1))
        if 1 <= index <= parent_count:
            if index not in order:
                order.append(index)
        else:
            hallucinated += 1
        return " "

    cleaned = _CITATION.sub(_replace, answer or "")
    cleaned = _MULTI_SPACE.sub(" ", cleaned)
    cleaned = _SPACE_BEFORE_PUNCT.sub(r"\1", cleaned)
    return cleaned.strip(), order, hallucinated


def _to_source(parent: Any) -> Source | None:
    """Build a contract ``Source`` from a retrieved parent (never from the LLM)."""
    snippet = (getattr(parent, "best_child_raw_snippet", "") or "").strip()
    if not snippet:
        snippet = (getattr(parent, "parent_text", "") or "").strip()[:200]
    try:
        return Source(
            document_id=str(parent.document_id),
            doc_type=parent.doc_type,
            doc_date=str(parent.doc_date),
            reference_snippet=snippet,
        )
    except Exception as exc:  # noqa: BLE001 - an invalid parent is skipped
        logger.warning("source_skipped class=%s", type(exc).__name__)
        return None


def _sources_for(parents: Sequence[Any], order: Sequence[int]) -> list[Source]:
    sources: list[Source] = []
    for index in order:
        source = _to_source(parents[index - 1])
        if source is not None:
            sources.append(source)
    return sources


def _default_retrieval(
    patient_id: str, query: str, filters: Any, clock: date | None
) -> Any:
    from app.services.retriever import retrieve_debug

    return retrieve_debug(patient_id, query, filters, clock)


def answer_question(
    patient_id: str,
    doctor_query: str,
    chat_history: Sequence[object] | None = None,
    filters: Any = None,
    clock: date | None = None,
    *,
    chain: Any = None,
    retrieval: Callable[..., Any] | None = None,
) -> GeneratedAnswer:
    """Run the full grounded-answer pipeline for one doctor question."""
    settings = get_settings()
    started = time.perf_counter()
    timings: dict[str, float] = {}

    # 1. follow-up rewrite (no history -> no extra LLM call) ----------------
    t = time.perf_counter()
    rewrite = rewrite_query(doctor_query, chat_history, chain=chain)
    timings["rewrite_ms"] = round((time.perf_counter() - t) * 1000, 2)

    # 2. retrieval ----------------------------------------------------------
    t = time.perf_counter()
    retrieval_fn = retrieval or _default_retrieval
    debug = retrieval_fn(patient_id, rewrite.query, filters, clock)
    timings["retrieval_ms"] = round((time.perf_counter() - t) * 1000, 2)
    parents = list(getattr(debug, "parents", []) or [])
    mode = str(getattr(debug, "mode", "normal"))

    # 3. empty retrieval: never call the LLM (P18) --------------------------
    if not parents:
        timings["total_ms"] = round((time.perf_counter() - started) * 1000, 2)
        logger.info(
            "ask_result result=not_found mode=%s parents=0 rewritten=%s total_ms=%.1f",
            mode,
            rewrite.rewritten,
            timings["total_ms"],
        )
        return GeneratedAnswer(
            answer=insufficient_message(doctor_query),
            sources=[],
            mode=mode,
            result_type="not_found",
            rewritten=rewrite.rewritten,
            parent_count=0,
            timings_ms=timings,
        )

    # 4. de-identified numbered context ------------------------------------
    t = time.perf_counter()
    context_texts = [scrub(parent.parent_text or "") for parent in parents]
    context = build_context(parents, texts=context_texts)
    timings["context_ms"] = round((time.perf_counter() - t) * 1000, 2)

    # 5. generation --------------------------------------------------------
    active_chain = chain or get_llm_chain()
    t = time.perf_counter()
    result = active_chain.generate(
        build_messages(rewrite.query, context),
        temperature=settings.llm_temperature,
        max_tokens=settings.llm_max_tokens,
    )
    timings["generation_ms"] = round((time.perf_counter() - t) * 1000, 2)
    tokens = {
        "prompt_tokens": result.prompt_tokens,
        "completion_tokens": result.completion_tokens,
    }

    cleaned, order, hallucinated = extract_citations(result.text, len(parents))
    verification = verify_answer(cleaned, context_texts)
    if is_truncated(result):
        # A cut-off answer can still pass the number check (the value may be
        # complete while the sentence is not), so truncation is a hard failure.
        logger.warning("answer_truncated provider=%s", getattr(result, "provider", None))
        verification = VerificationResult(ok=False, missing_numbers=("truncated",))
    regenerated = False

    # 6. one stricter retry when the grounding check fails ------------------
    if not verification.ok:
        logger.warning(
            "answer_verification_failed attempt=1 missing=%d",
            len(verification.missing),
        )
        try:
            retry = active_chain.generate(
                build_messages(
                    rewrite.query,
                    context,
                    extra_instruction=strict_instruction(verification.missing),
                ),
                temperature=0.0,
                max_tokens=settings.llm_max_tokens,
            )
            regenerated = True
            retry_cleaned, retry_order, retry_hallucinated = extract_citations(
                retry.text, len(parents)
            )
            retry_verification = verify_answer(retry_cleaned, context_texts)
            if is_truncated(retry):
                retry_verification = VerificationResult(
                    ok=False, missing_numbers=("truncated",)
                )
            if retry_verification.ok:
                cleaned, order, hallucinated = retry_cleaned, retry_order, retry_hallucinated
                verification = retry_verification
                result = retry
            else:
                logger.warning(
                    "answer_verification_failed attempt=2 missing=%d",
                    len(retry_verification.missing),
                )
        except Exception as exc:  # noqa: BLE001 - a failed retry is not fatal
            logger.warning("answer_regeneration_failed class=%s", type(exc).__name__)

    if not verification.ok:
        # Second failure: withhold the answer, keep the doctor able to check.
        fallback_order = order or list(range(1, len(parents) + 1))
        timings["total_ms"] = round((time.perf_counter() - started) * 1000, 2)
        logger.info(
            "ask_result result=verification_failed mode=%s parents=%d sources=%d "
            "regenerated=%s total_ms=%.1f",
            mode,
            len(parents),
            len(fallback_order),
            regenerated,
            timings["total_ms"],
        )
        return GeneratedAnswer(
            answer=unverified_message(doctor_query),
            sources=_sources_for(parents, fallback_order),
            mode=mode,
            result_type="verification_failed",
            rewritten=rewrite.rewritten,
            provider=getattr(result, "provider", None),
            parent_count=len(parents),
            hallucinated_citations=hallucinated,
            regenerated=regenerated,
            timings_ms=timings,
            tokens=tokens,
        )

    # 7. citations: first-citation order, else every context parent --------
    if not order:
        order = list(range(1, len(parents) + 1))
    sources = _sources_for(parents, order)

    timings["total_ms"] = round((time.perf_counter() - started) * 1000, 2)
    logger.info(
        "ask_result result=answered mode=%s parents=%d sources=%d rewritten=%s "
        "provider=%s regenerated=%s hallucinated_citations=%d total_ms=%.1f",
        mode,
        len(parents),
        len(sources),
        rewrite.rewritten,
        getattr(result, "provider", None),
        regenerated,
        hallucinated,
        timings["total_ms"],
    )
    return GeneratedAnswer(
        answer=cleaned,
        sources=sources,
        mode=mode,
        result_type="answered",
        rewritten=rewrite.rewritten,
        provider=getattr(result, "provider", None),
        parent_count=len(parents),
        hallucinated_citations=hallucinated,
        regenerated=regenerated,
        timings_ms=timings,
        tokens=tokens,
    )
