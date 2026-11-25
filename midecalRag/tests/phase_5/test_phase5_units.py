"""Offline unit tests for Phase 5 (analyzer, expander, retriever).

No network and no Qdrant: the expander gets injected fake providers and the
retriever gets an in-memory fake index. The real cloud behaviour is covered by
``scripts/verify_phase_5.py``.
"""

from __future__ import annotations

import json
import random
from datetime import date
from types import SimpleNamespace

import pytest

from app.config import get_settings
from app.schemas.errors import ApiError
from app.services import retriever as retriever_module
from app.services.query_analyzer import analyze_query, normalize_query
from app.services.query_expander import QueryExpander
from app.services.retriever import retrieve, retrieve_debug

CLOCK = date(2026, 11, 23)


# --------------------------------------------------------------------------- #
# fakes
# --------------------------------------------------------------------------- #
class FakeEmbedder:
    """Deterministic dense vectors; sparse indices are irrelevant to the fakes."""

    def __init__(self, dim: int = 8) -> None:
        self.dim = dim
        self.calls: list[str] = []

    def embed_query(self, text: str):
        self.calls.append(text)
        rng = random.Random(abs(hash(text)) % (2**31))
        dense = [rng.uniform(-1.0, 1.0) for _ in range(self.dim)]
        return dense, ([1, 2], [0.5, 0.5])


def make_point(
    patient_id: str,
    parent_id: str,
    *,
    doc_type: str = "lab_result",
    doc_date: str = "2026-11-01",
    fused: float = 1.0,
    cos: float = 0.5,
    child_index: int = 0,
    document_id: str | None = None,
    child_text: str = "Creatinine: 1.2 mg/dL",
    raw_snippet: str | None = None,
    parent_text: str | None = None,
):
    payload = {
        "patient_id": patient_id,
        "parent_id": parent_id,
        "document_id": document_id or f"doc-{parent_id}",
        "doc_type": doc_type,
        "doc_date": doc_date,
        "child_text": child_text,
        "raw_snippet": raw_snippet if raw_snippet is not None else child_text,
        "parent_text": parent_text or f"parent text of {parent_id}",
        "_fused": fused,
        "_cos": cos,
        "child_index": child_index,
    }
    return SimpleNamespace(id=f"{parent_id}-{child_index}", payload=payload)


class FakeIndex:
    """In-memory stand-in for Qdrant: honours patient/doc_type/date filters."""

    def __init__(self, points: list) -> None:
        self.points = points
        self.hybrid_calls: list[dict] = []
        self.dense_calls: list[dict] = []

    @staticmethod
    def _match(point, patient_id: str, doc_type: str | None, date_from: str | None) -> bool:
        payload = point.payload
        if payload.get("patient_id") != patient_id:
            return False
        if doc_type and payload.get("doc_type") != doc_type:
            return False
        if date_from and str(payload.get("doc_date") or "") < date_from:
            return False
        return True

    def hybrid(self, patient_id, dense, sparse, doc_type, date_from, limit):
        self.hybrid_calls.append(
            {"doc_type": doc_type, "date_from": date_from, "limit": limit}
        )
        rows = [p for p in self.points if self._match(p, patient_id, doc_type, date_from)]
        rows.sort(key=lambda p: p.payload["_fused"], reverse=True)
        return [
            SimpleNamespace(id=p.id, payload=p.payload, score=p.payload["_fused"])
            for p in rows[:limit]
        ]

    def dense(self, patient_id, dense, doc_type, date_from, limit):
        self.dense_calls.append({"doc_type": doc_type, "date_from": date_from})
        rows = [p for p in self.points if self._match(p, patient_id, doc_type, date_from)]
        rows.sort(key=lambda p: p.payload["_cos"], reverse=True)
        return [
            SimpleNamespace(id=p.id, payload=p.payload, score=p.payload["_cos"])
            for p in rows[:limit]
        ]


def patch_settings(monkeypatch, **overrides):
    patched = get_settings().model_copy(update=overrides)
    monkeypatch.setattr(retriever_module, "get_settings", lambda: patched)
    return patched


def no_expansion() -> QueryExpander:
    return QueryExpander(enabled=False)


def run(index: FakeIndex, query: str, filters=None, *, clock=CLOCK, **kwargs):
    return retrieve_debug(
        "p1",
        query,
        filters,
        clock,
        expander=no_expansion(),
        embedder=FakeEmbedder(),
        hybrid=index.hybrid,
        dense=index.dense,
        **kwargs,
    )


# --------------------------------------------------------------------------- #
# analyzer
# --------------------------------------------------------------------------- #
def test_analyzer_normal_mode_has_no_intent():
    analysis = analyze_query("Creatinine value in October", CLOCK)
    assert analysis.mode == "normal"
    assert analysis.latest is False and analysis.trend is False
    assert analysis.date_from is None


def test_analyzer_latest_keywords_english_and_arabic():
    assert analyze_query("what is the latest creatinine", CLOCK).latest is True
    assert analyze_query("اخر تحليل كرياتينين", CLOCK).latest is True
    assert analyze_query("احدث اشعة", CLOCK).latest is True


def test_analyzer_trend_keywords_win_over_latest():
    analysis = analyze_query("latest change in creatinine over time", CLOCK)
    assert analysis.trend is True and analysis.latest is True
    assert analysis.mode == "trend"


def test_analyzer_numbered_window_uses_injected_clock():
    analysis = analyze_query("how did creatinine change over the last 3 months", CLOCK)
    assert analysis.trend is True
    assert analysis.date_from == "2026-08-25"


def test_analyzer_arabic_window():
    analysis = analyze_query("تغير الكرياتينين في اخر 3 شهور", CLOCK)
    assert analysis.trend is True
    assert analysis.date_from == "2026-08-25"


def test_analyzer_soft_doc_type_hint():
    assert analyze_query("latest blood pressure medication", CLOCK).soft_doc_type == "prescription"
    assert analyze_query("اخر تحليل سكر", CLOCK).soft_doc_type == "lab_result"
    assert analyze_query("Creatinine", CLOCK).soft_doc_type == "lab_result"
    assert analyze_query("hello there", CLOCK).soft_doc_type is None


def test_normalize_query_unifies_arabic_and_units():
    assert normalize_query("أملوديبين 5mg") == normalize_query("املوديبين 5 mg")


# --------------------------------------------------------------------------- #
# expander
# --------------------------------------------------------------------------- #
def _payload_json(english: str, arabic: str) -> str:
    return json.dumps({"english": english, "arabic": arabic}, ensure_ascii=False)


def test_expander_disabled_returns_original_only():
    result = QueryExpander(enabled=False).expand("Creatinine")
    assert result.source == "disabled"
    assert result.variants == ["Creatinine"]


def test_expander_openrouter_primary():
    expander = QueryExpander(
        enabled=True,
        providers={"openrouter": lambda prompt: _payload_json("creatinine level", "مستوى الكرياتينين")},
    )
    result = expander.expand("مستوى الكرياتينين")
    assert result.source == "openrouter"
    assert result.variants[0] == "مستوى الكرياتينين"
    assert "creatinine level" in result.variants


def test_expander_gemini_fallback_when_openrouter_fails():
    def boom(_prompt: str) -> str:
        raise TimeoutError("upstream timeout")

    expander = QueryExpander(
        enabled=True,
        providers={"openrouter": boom, "gemini": lambda prompt: _payload_json("creatinine", "كرياتينين")},
    )
    result = expander.expand("كرياتينين")
    assert result.source == "gemini"
    assert "creatinine" in result.variants


def test_expander_degrades_to_original_when_all_providers_fail():
    def boom(_prompt: str) -> str:
        raise RuntimeError("provider down")

    expander = QueryExpander(enabled=True, providers={"openrouter": boom, "gemini": boom})
    result = expander.expand("Creatinine 5mg")
    assert result.source == "none"
    assert result.variants == ["Creatinine 5mg"]
    assert result.error == "RuntimeError"


def test_expander_ignores_non_json_and_caps_variants():
    # Both providers are injected so the test never reaches a real API even
    # when GEMINI_API_KEY happens to exist in the environment.
    expander = QueryExpander(
        enabled=True,
        providers={
            "openrouter": lambda prompt: "sorry, no json",
            "gemini": lambda prompt: "still no json",
        },
    )
    assert expander.expand("Creatinine").variants == ["Creatinine"]

    expander = QueryExpander(
        enabled=True,
        providers={
            "openrouter": lambda prompt: json.dumps(
                {"english": "a", "arabic": "b", "terms": ["c", "d"]}
            )
        },
    )
    result = expander.expand("x")
    assert len(result.variants) == min(3, get_settings().query_expansion_max_variants)


def test_expander_empty_query_is_safe():
    result = QueryExpander(enabled=True).expand("   ")
    assert result.source == "empty"


# --------------------------------------------------------------------------- #
# retriever
# --------------------------------------------------------------------------- #
def test_retriever_empty_patient_returns_empty_list():
    index = FakeIndex([])
    debug = run(index, "latest creatinine")
    assert debug.parents == []
    assert debug.candidate_parents == 0


def test_retriever_blank_query_returns_empty_list():
    index = FakeIndex([make_point("p1", "p#p0")])
    assert run(index, "   ").parents == []


def test_retriever_requires_patient_id():
    with pytest.raises(ApiError):
        retrieve("  ", "creatinine", None, CLOCK, expander=no_expansion())


def test_retriever_dedupes_children_by_parent():
    index = FakeIndex(
        [
            make_point("p1", "p#p0", fused=1.0, child_index=0, raw_snippet="first line"),
            make_point("p1", "p#p0", fused=2.0, child_index=1, raw_snippet="best line"),
            make_point("p1", "p#p0", fused=0.5, child_index=2, raw_snippet="weak line"),
        ]
    )
    debug = run(index, "creatinine")
    assert len(debug.parents) == 1
    parent = debug.parents[0]
    assert parent.parent_id == "p#p0"
    assert parent.best_child_raw_snippet == "best line"
    assert parent.parent_text == "parent text of p#p0"
    assert debug.candidate_children == 3


def test_retriever_caps_at_final_parents():
    points = [
        make_point("p1", f"p#p{i}", fused=1.0 - i / 100, doc_date="2026-11-01")
        for i in range(8)
    ]
    debug = run(FakeIndex(points), "creatinine")
    assert len(debug.parents) == get_settings().final_parents


def test_retriever_normal_mode_boosts_recency():
    index = FakeIndex(
        [
            make_point("p1", "old", fused=1.0, doc_date="2025-01-01"),
            make_point("p1", "new", fused=1.0, doc_date="2026-11-20"),
        ]
    )
    debug = run(index, "creatinine", final_parents=1)
    assert [p.parent_id for p in debug.parents] == ["new"]
    assert debug.parents[0].final_score > 0


def test_retriever_normal_mode_keeps_score_order():
    """Owner decision 2026-11-25 (from the Phase 8 evaluation).

    ``normal`` mode used to re-sort the selected parents by date, which put a
    newer prescription ahead of a stronger exact-dose match. Score order is now
    preserved; date-first ordering is ``latest`` mode's job.
    """
    index = FakeIndex(
        [
            make_point("p1", "old", fused=1.0, doc_date="2025-01-01"),
            make_point("p1", "new", fused=0.9, doc_date="2026-11-20"),
        ]
    )
    debug = run(index, "creatinine")
    assert [p.parent_id for p in debug.parents] == ["old", "new"]


def test_retriever_latest_orders_by_doc_date_not_by_score():
    index = FakeIndex(
        [
            make_point("p1", "strong-old", fused=3.0, doc_date="2024-01-01"),
            make_point("p1", "weak-new", fused=1.0, doc_date="2026-11-20"),
        ]
    )
    debug = run(index, "latest creatinine", final_parents=1)
    assert debug.mode == "latest"
    assert [p.parent_id for p in debug.parents] == ["weak-new"]


def test_retriever_latest_retries_without_soft_hint(monkeypatch):
    patch_settings(monkeypatch, relevance_floor=0.3)
    index = FakeIndex(
        [
            make_point("p1", "lab-irrelevant", doc_type="lab_result", fused=1.0, cos=0.1),
            make_point(
                "p1",
                "report-relevant",
                doc_type="medical_report",
                doc_date="2026-11-20",
                fused=0.5,
                cos=0.9,
            ),
        ]
    )
    debug = run(index, "latest creatinine")
    assert debug.analysis.soft_doc_type == "lab_result"
    assert debug.hint_used == "lab_result"
    assert debug.hint_retry is True
    assert [p.parent_id for p in debug.parents] == ["report-relevant"]
    assert index.hybrid_calls[0]["doc_type"] == "lab_result"
    assert index.hybrid_calls[-1]["doc_type"] is None


def test_retriever_explicit_doc_type_is_hard_and_never_retried():
    index = FakeIndex(
        [
            make_point("p1", "lab", doc_type="lab_result", fused=1.0),
            make_point("p1", "rx", doc_type="prescription", doc_date="2026-11-20", fused=2.0),
        ]
    )
    debug = run(index, "latest creatinine", filters={"doc_type": "lab_result"})
    assert [p.parent_id for p in debug.parents] == ["lab"]
    assert debug.hint_used is None
    assert {call["doc_type"] for call in index.hybrid_calls} == {"lab_result"}


def test_retriever_explicit_date_from_wins_over_inferred_window():
    index = FakeIndex(
        [
            make_point("p1", "in-window", doc_date="2026-09-01"),
            make_point("p1", "excluded", doc_date="2026-01-01"),
        ]
    )
    debug = run(index, "change over the last 3 months", filters={"date_from": "2026-08-01"})
    assert debug.effective_date_from == "2026-08-01"
    assert [p.parent_id for p in debug.parents] == ["in-window"]


def test_retriever_trend_applies_window_and_presents_oldest_first():
    index = FakeIndex(
        [
            make_point("p1", "too-old", doc_date="2025-01-01", fused=1.0, cos=0.9),
            make_point("p1", "mid", doc_date="2026-09-01", fused=0.5, cos=0.6),
            make_point("p1", "recent", doc_date="2026-11-01", fused=0.9, cos=0.8),
        ]
    )
    debug = run(index, "how did creatinine change over the last 3 months")
    assert debug.mode == "trend"
    assert debug.effective_date_from == "2026-08-25"
    assert [p.parent_id for p in debug.parents] == ["mid", "recent"]


def test_retriever_relevance_gate_can_return_empty(monkeypatch):
    patch_settings(monkeypatch, relevance_floor=0.8)
    index = FakeIndex([make_point("p1", "weak", fused=1.0, cos=0.2)])
    debug = run(index, "latest hba1c")
    assert debug.parents == []
    assert debug.gated_parents == 0


def test_retriever_gate_off_returns_irrelevant_parents(monkeypatch):
    patch_settings(monkeypatch, relevance_floor=0.0)
    index = FakeIndex([make_point("p1", "weak", fused=1.0, cos=0.2)])
    assert len(run(index, "latest hba1c").parents) == 1


def test_retriever_drops_foreign_patient_points_from_an_unfiltered_source():
    def rogue_hybrid(patient_id, dense, sparse, doc_type, date_from, limit):
        return [
            SimpleNamespace(
                id="leak",
                score=9.0,
                payload={
                    "patient_id": "p2",
                    "parent_id": "leak#p0",
                    "document_id": "leak-doc",
                    "doc_type": "lab_result",
                    "doc_date": "2026-11-01",
                    "child_text": "Creatinine",
                    "raw_snippet": "Creatinine",
                    "parent_text": "other patient",
                },
            )
        ]

    def empty_dense(patient_id, dense, doc_type, date_from, limit):
        return []

    debug = retrieve_debug(
        "p1",
        "creatinine",
        None,
        CLOCK,
        expander=no_expansion(),
        embedder=FakeEmbedder(),
        hybrid=rogue_hybrid,
        dense=empty_dense,
    )
    assert debug.parents == []


def test_retriever_merges_variants_and_keeps_best_score():
    calls = {"n": 0}

    def two_variant_hybrid(patient_id, dense, sparse, doc_type, date_from, limit):
        calls["n"] += 1
        if calls["n"] == 1:
            return [SimpleNamespace(id="a", score=1.0, payload=make_point("p1", "a").payload)]
        return [
            SimpleNamespace(id="b", score=0.9, payload=make_point("p1", "b").payload),
            SimpleNamespace(id="a", score=0.1, payload=make_point("p1", "a").payload),
        ]

    expander = QueryExpander(
        enabled=True,
        providers={"openrouter": lambda prompt: json.dumps({"english": "creatinine level"})},
    )
    debug = retrieve_debug(
        "p1",
        "كرياتينين",
        None,
        CLOCK,
        expander=expander,
        embedder=FakeEmbedder(),
        hybrid=two_variant_hybrid,
        dense=lambda patient_id, dense, doc_type, date_from, limit: [],
    )
    assert len(debug.variants) == 2
    assert {p.parent_id for p in debug.parents} == {"a", "b"}
    by_id = {p.parent_id: p for p in debug.parents}
    assert by_id["a"].parent_score == 1.0
    assert by_id["b"].parent_score == 0.9
