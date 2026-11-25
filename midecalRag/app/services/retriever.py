"""Phase 5 retrieval pipeline: hybrid search, over-fetch, recency, parent dedupe.

Pipeline (plan Phase 5, section B):

1. Analyze the doctor question (normalized text, ``latest``/``trend`` intent,
   inferred time window, soft ``doc_type`` hint) - :mod:`query_analyzer`.
2. Expand/translate it into up to ``QUERY_EXPANSION_MAX_VARIANTS`` variants
   (OpenRouter primary, Gemini fallback, graceful degradation to the original
   query) - :mod:`query_expander`.
3. Hybrid RRF search per variant with **over-fetch** (``WIDE_K``, default 40).
   The strict ``patient_id`` filter is applied to every prefetch branch and to
   the outer query inside :func:`vectorstore.hybrid_search`; explicit
   ``optional_filters`` always win over inferred hints.
4. Dense-only pass for an *absolute* relevance signal: RRF scores are relative,
   so a fused-score gate cannot detect "nothing relevant".
5. Group children by ``parent_id``, keep the best child of each parent (its
   ``raw_snippet`` becomes the citation), keep the full ``parent_text``.
6. Order per mode and slice to ``FINAL_PARENTS``:
   ``normal``  -> rel_norm + RECENCY_WEIGHT * exp(-age_days / RECENCY_DECAY_DAYS),
                  top N by that score, **presented in that same score order**
                  (owner decision 2026-11-25: a date re-sort here hid the
                  exact-dose match behind a newer prescription);
   ``latest``  -> gate, then ``doc_date`` descending (soft hint first, retried
                  without the hint when the hint hides all evidence);
   ``trend``   -> gate + time window, top N by relevance, presented oldest first.
7. Empty candidates or nothing above the gate -> ``[]`` (the caller answers
   "not enough information" without calling the LLM).

Invariants: never returns another patient's parent, never sorts or scores by
upload time, and every time calculation comes from the injected ``clock``.
"""

from __future__ import annotations

import logging
import math
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from app.config import get_settings
from app.schemas.errors import invalid_request
from app.services.query_analyzer import QueryAnalysis, analyze_query, normalize_query
from app.services.query_expander import QueryExpander, get_expander

logger = logging.getLogger(__name__)

#: (patient_id, dense, (sparse_indices, sparse_values), doc_type, date_from, limit)
HybridSearch = Callable[
    [str, list[float], tuple[list[int], list[float]], str | None, str | None, int],
    list[Any],
]
DenseSearch = Callable[
    [str, list[float], str | None, str | None, int], list[Any]
]

_REQUIRED_PAYLOAD = ("parent_id", "document_id", "doc_type", "doc_date", "parent_text")


@dataclass(frozen=True)
class RetrievedParent:
    """One parent returned to the caller (and later to the LLM context)."""

    parent_id: str
    document_id: str
    doc_type: str
    doc_date: str
    parent_text: str
    best_child_raw_snippet: str
    parent_score: float  # fused RRF score normalized by the best candidate
    relevance: float  # best dense cosine of its children (absolute signal)
    final_score: float  # mode-specific score used for ordering
    mode: str


@dataclass(frozen=True)
class RetrievalDebug:
    """Diagnostics for the verify script and logs (never patient text)."""

    parents: list[RetrievedParent]
    mode: str
    analysis: QueryAnalysis
    variants: list[str]
    expansion_source: str
    candidate_children: int
    candidate_parents: int
    gated_parents: int
    hint_used: str | None
    hint_retry: bool
    effective_date_from: str | None
    timings_ms: dict[str, float] = field(default_factory=dict)


@dataclass
class _Child:
    point_id: str
    parent_id: str
    document_id: str
    doc_type: str
    doc_date: str
    child_text: str
    raw_snippet: str
    parent_text: str
    score: float
    relevance: float = 0.0


@dataclass
class _ParentAgg:
    """Children of one parent collapsed into a single candidate."""

    parent_id: str
    document_id: str
    doc_type: str
    doc_date: str
    parent_text: str
    best_child_raw_snippet: str = ""
    best_child_score: float = -math.inf
    relevance: float = 0.0
    child_count: int = 0
    parent_score: float = 0.0
    final_score: float = 0.0

    def add(self, child: _Child) -> None:
        self.child_count += 1
        if child.score > self.best_child_score:
            self.best_child_score = child.score
            self.best_child_raw_snippet = child.raw_snippet
            self.parent_text = child.parent_text or self.parent_text
            self.doc_type = child.doc_type or self.doc_type
            self.doc_date = child.doc_date or self.doc_date
        if child.relevance > self.relevance:
            self.relevance = child.relevance


# --------------------------------------------------------------------------- #
# default Qdrant-backed search callables (imported lazily so this module stays
# free of the vector-DB client at import time and offline tests need no network)
# --------------------------------------------------------------------------- #
def _default_hybrid(
    patient_id: str,
    dense: list[float],
    sparse: tuple[list[int], list[float]],
    doc_type: str | None,
    date_from: str | None,
    limit: int,
    collection_name: str | None = None,
) -> list[Any]:
    from app.services.vectorstore import hybrid_search, make_sparse_vector

    return hybrid_search(
        patient_id,
        dense,
        make_sparse_vector(sparse[0], sparse[1]),
        doc_type=doc_type,
        date_from=date_from,
        limit=limit,
        collection_name=collection_name,
    )


def _default_dense(
    patient_id: str,
    dense: list[float],
    doc_type: str | None,
    date_from: str | None,
    limit: int,
    collection_name: str | None = None,
) -> list[Any]:
    from app.services.vectorstore import search_dense

    return search_dense(
        patient_id,
        dense,
        doc_type=doc_type,
        date_from=date_from,
        limit=limit,
        collection_name=collection_name,
    )


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _filter_value(filters: Any, name: str) -> Any:
    """Read a filter from an OptionalFilters model or a plain mapping."""
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


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def _age_days(doc_date: str | None, reference: date) -> int | None:
    """Whole days between ``doc_date`` and the injected clock (never upload time)."""
    parsed = _parse_date(doc_date)
    if parsed is None:
        return None
    return max(0, (reference - parsed).days)


def _recency_bonus(doc_date: str | None, reference: date, weight: float, decay: int) -> float:
    if weight <= 0:
        return 0.0
    days = _age_days(doc_date, reference)
    if days is None:
        return 0.0
    return weight * math.exp(-days / max(1, decay))


def _payload(point: Any) -> dict[str, Any]:
    payload = getattr(point, "payload", None)
    return payload if isinstance(payload, dict) else {}


def _to_child(point: Any, patient_id: str) -> _Child | None:
    payload = _payload(point)
    if any(not payload.get(key) for key in _REQUIRED_PAYLOAD):
        logger.warning("retrieval_point_skipped reason=incomplete_payload")
        return None
    if payload.get("patient_id") not in (None, patient_id):
        # Defence in depth: the Qdrant filter should make this impossible.
        logger.warning("retrieval_point_skipped reason=foreign_patient")
        return None
    return _Child(
        point_id=str(getattr(point, "id", "")),
        parent_id=str(payload["parent_id"]),
        document_id=str(payload["document_id"]),
        doc_type=str(payload.get("doc_type") or ""),
        doc_date=str(payload.get("doc_date") or ""),
        child_text=str(payload.get("child_text") or ""),
        raw_snippet=str(payload.get("raw_snippet") or ""),
        parent_text=str(payload.get("parent_text") or ""),
        score=float(getattr(point, "score", 0.0) or 0.0),
    )


def _group(children: list[_Child]) -> list[_ParentAgg]:
    """Group children by ``parent_id`` keeping the best child per parent."""
    groups: dict[str, _ParentAgg] = {}
    mismatches = 0
    for child in children:
        agg = groups.get(child.parent_id)
        if agg is None:
            agg = _ParentAgg(
                parent_id=child.parent_id,
                document_id=child.document_id,
                doc_type=child.doc_type,
                doc_date=child.doc_date,
                parent_text=child.parent_text,
                relevance=child.relevance,
            )
            groups[child.parent_id] = agg
        elif child.document_id and child.document_id != agg.document_id:
            mismatches += 1
        agg.add(child)
    if mismatches:
        logger.warning("parent_document_mismatch count=%d", mismatches)
    return list(groups.values())


def _finalize(agg: _ParentAgg, mode: str) -> RetrievedParent:
    return RetrievedParent(
        parent_id=agg.parent_id,
        document_id=agg.document_id,
        doc_type=agg.doc_type,
        doc_date=agg.doc_date,
        parent_text=agg.parent_text,
        best_child_raw_snippet=agg.best_child_raw_snippet,
        parent_score=agg.parent_score,
        relevance=agg.relevance,
        final_score=agg.final_score,
        mode=mode,
    )


# --------------------------------------------------------------------------- #
# public API
# --------------------------------------------------------------------------- #
def retrieve(
    patient_id: str,
    query: str,
    filters: Any = None,
    clock: date | None = None,
    *,
    collection_name: str | None = None,
    expander: QueryExpander | None = None,
    embedder: Any = None,
    hybrid: HybridSearch | None = None,
    dense: DenseSearch | None = None,
    final_parents: int | None = None,
) -> list[RetrievedParent]:
    """Return up to ``FINAL_PARENTS`` parents, or ``[]`` when nothing qualifies."""
    return retrieve_debug(
        patient_id,
        query,
        filters,
        clock,
        collection_name=collection_name,
        expander=expander,
        embedder=embedder,
        hybrid=hybrid,
        dense=dense,
        final_parents=final_parents,
    ).parents


def retrieve_debug(
    patient_id: str,
    query: str,
    filters: Any = None,
    clock: date | None = None,
    *,
    collection_name: str | None = None,
    expander: QueryExpander | None = None,
    embedder: Any = None,
    hybrid: HybridSearch | None = None,
    dense: DenseSearch | None = None,
    final_parents: int | None = None,
) -> RetrievalDebug:
    """Same as :func:`retrieve` but also returns mode, counts and timings."""
    settings = get_settings()
    timings: dict[str, float] = {}
    started = time.perf_counter()

    if not isinstance(patient_id, str) or not patient_id.strip():
        raise invalid_request("patient_id is required for retrieval")

    # 1. analysis ------------------------------------------------------------
    t = time.perf_counter()
    reference = clock or date.today()
    analysis = analyze_query(query or "", reference)
    timings["analysis_ms"] = round((time.perf_counter() - t) * 1000, 2)

    limit = int(final_parents if final_parents is not None else settings.final_parents)
    wide_k = max(int(settings.wide_k), limit)
    floor = float(settings.relevance_floor)
    mode = analysis.mode

    empty = RetrievalDebug(
        parents=[],
        mode=mode,
        analysis=analysis,
        variants=[],
        expansion_source="empty",
        candidate_children=0,
        candidate_parents=0,
        gated_parents=0,
        hint_used=None,
        hint_retry=False,
        effective_date_from=None,
        timings_ms=timings,
    )
    if not (query or "").strip():
        timings["total_ms"] = round((time.perf_counter() - started) * 1000, 2)
        return empty

    # 2. multilingual expansion / translation --------------------------------
    t = time.perf_counter()
    active_expander = expander or get_expander()
    expansion = active_expander.expand(query)
    variants = [v for v in expansion.variants if (v or "").strip()] or [query]
    timings["expansion_ms"] = round((time.perf_counter() - t) * 1000, 2)

    # 3. embed every variant (same normalizer as ingest) ---------------------
    t = time.perf_counter()
    active_embedder = embedder or _default_embedder()
    prepared: list[tuple[list[float], tuple[list[int], list[float]]]] = []
    seen_text: set[str] = set()
    for variant in variants:
        text = normalize_query(variant)
        if not text or text in seen_text:
            continue
        seen_text.add(text)
        dense_vector, sparse_vector = active_embedder.embed_query(text)
        prepared.append((dense_vector, sparse_vector))
    timings["embed_ms"] = round((time.perf_counter() - t) * 1000, 2)

    if not prepared:
        timings["total_ms"] = round((time.perf_counter() - started) * 1000, 2)
        return RetrievalDebug(
            parents=[],
            mode=mode,
            analysis=analysis,
            variants=variants,
            expansion_source=expansion.source,
            candidate_children=0,
            candidate_parents=0,
            gated_parents=0,
            hint_used=None,
            hint_retry=False,
            effective_date_from=None,
            timings_ms=timings,
        )

    # 4. filters: explicit wins; the inferred window only narrows trend mode --
    raw_doc_type = _filter_value(filters, "doc_type")
    explicit_doc_type = str(raw_doc_type) if raw_doc_type else None
    explicit_date_from = _as_iso_date(_filter_value(filters, "date_from"))
    inferred_from = analysis.date_from if analysis.trend else None
    effective_date_from = explicit_date_from or inferred_from

    hybrid_fn = hybrid or _default_hybrid
    dense_fn = dense or _default_dense

    # 5. candidate collection (memoized per doc_type so the hint retry reuses
    #    the search only when the hint actually changes the filter) ----------
    t = time.perf_counter()
    cache: dict[str | None, list[_ParentAgg]] = {}

    def collect(doc_type: str | None) -> list[_ParentAgg]:
        if doc_type in cache:
            return cache[doc_type]
        best: dict[str, _Child] = {}
        dense_scores: dict[str, float] = {}
        for dense_vector, sparse_vector in prepared:
            hits = hybrid_fn(
                patient_id, dense_vector, sparse_vector, doc_type, effective_date_from, wide_k
            )
            for point in hits:
                child = _to_child(point, patient_id)
                if child is None:
                    continue
                previous = best.get(child.point_id)
                if previous is None or child.score > previous.score:
                    best[child.point_id] = child
            for point in dense_fn(
                patient_id, dense_vector, doc_type, effective_date_from, wide_k
            ):
                point_id = str(getattr(point, "id", ""))
                score = float(getattr(point, "score", 0.0) or 0.0)
                if point_id and score > dense_scores.get(point_id, -math.inf):
                    dense_scores[point_id] = score
        for point_id, child in best.items():
            child.relevance = dense_scores.get(point_id, 0.0)
        aggs = _group(list(best.values()))
        best_score = max((agg.best_child_score for agg in aggs), default=0.0)
        for agg in aggs:
            agg.parent_score = (
                agg.best_child_score / best_score if best_score > 0 else 0.0
            )
        cache[doc_type] = aggs
        return aggs

    hint: str | None = None
    if mode == "latest" and analysis.soft_doc_type and not explicit_doc_type:
        hint = analysis.soft_doc_type

    candidates = collect(explicit_doc_type or hint)
    timings["search_ms"] = round((time.perf_counter() - t) * 1000, 2)

    def gated(aggs: list[_ParentAgg]) -> list[_ParentAgg]:
        if floor <= 0:
            return list(aggs)
        return [agg for agg in aggs if agg.relevance >= floor]

    hint_retry = False
    kept = gated(candidates)

    # 6. mode-specific ordering ---------------------------------------------
    if mode == "trend":
        window = effective_date_from
        in_window = [
            agg
            for agg in kept
            if window is None or (agg.doc_date or "") >= window
        ]
        in_window.sort(key=lambda a: (a.parent_score, a.relevance), reverse=True)
        selected = in_window[:limit]
        for agg in selected:
            agg.final_score = agg.parent_score
        selected.sort(key=lambda a: (a.doc_date or ""))
    elif mode == "latest":
        if not kept and hint is not None:
            # The soft hint hid every relevant parent: retry without it (D24).
            hint_retry = True
            candidates = collect(explicit_doc_type)
            kept = gated(candidates)
        kept.sort(key=lambda a: (a.doc_date or "", a.relevance), reverse=True)
        selected = kept[:limit]
        for agg in selected:
            agg.final_score = agg.relevance
    else:
        for agg in kept:
            agg.final_score = agg.parent_score + _recency_bonus(
                agg.doc_date, reference, float(settings.recency_weight),
                int(settings.recency_decay_days),
            )
        kept.sort(key=lambda a: (a.final_score, a.doc_date or ""), reverse=True)
        selected = kept[:limit]
        # Score order is preserved for presentation (owner decision 2026-11-25,
        # from the Phase 8 evaluation): re-sorting the selected parents by date
        # made the newest prescription outrank the exact-dose match. Recency is
        # already expressed inside ``final_score``, and date-first ordering
        # belongs to ``latest`` mode only.

    parents = [_finalize(agg, mode) for agg in selected]
    timings["total_ms"] = round((time.perf_counter() - started) * 1000, 2)

    logger.info(
        "retrieval mode=%s variants=%d source=%s children=%d parents=%d gated=%d "
        "hint=%s retry=%s returned=%d total_ms=%.1f",
        mode,
        len(prepared),
        expansion.source,
        sum(agg.child_count for agg in candidates),
        len(candidates),
        len(kept),
        hint or "-",
        hint_retry,
        len(parents),
        timings["total_ms"],
    )

    return RetrievalDebug(
        parents=parents,
        mode=mode,
        analysis=analysis,
        variants=variants,
        expansion_source=expansion.source,
        candidate_children=sum(agg.child_count for agg in candidates),
        candidate_parents=len(candidates),
        gated_parents=len(kept),
        hint_used=hint,
        hint_retry=hint_retry,
        effective_date_from=effective_date_from,
        timings_ms=timings,
    )


def _default_embedder() -> Any:
    from app.services.embedder import get_embedder

    return get_embedder()
