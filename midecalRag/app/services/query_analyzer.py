"""Query analysis for Phase 5 retrieval.

The analyzer is deterministic and side-effect free (except reading cached
settings). It:
- normalizes the doctor question with the SAME normalizer used at ingest,
  then applies light Arabic normalization (unify alef forms, strip
  diacritics/tatweel) for matching only;
- detects "latest" and "trend" intent;
- extracts an inferred time window ("last 3 months" / "اخر 3 شهور") relative
  to an injected clock (never ``datetime.now`` here);
- derives a SOFT doc_type hint. The hint is advisory; the retriever decides
  whether it is safe to apply.

An explicit ``filters.date_from`` always wins over the inferred window; the
retriever enforces that precedence, the analyzer only reports what it saw.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta

from app.config import DOC_TYPE_HINT_KEYWORDS, get_settings
from app.services.normalizer import light_arabic_normalize, normalize

_TIME_UNIT_DAYS = {
    "day": 1,
    "days": 1,
    "week": 7,
    "weeks": 7,
    "month": 30,
    "months": 30,
    "year": 365,
    "years": 365,
    "يوم": 1,
    "ايام": 1,
    "اسبوع": 7,
    "اسابيع": 7,
    "شهر": 30,
    "شهور": 30,
    "اشهر": 30,
    "سنه": 365,
    "سنوات": 365,
}

_NUMBERED_WINDOW = re.compile(
    r"(?:last|past|اخر|خلال|في\s+اخر|في\s+خلال)\s+(\d+)\s+"
    r"(days?|weeks?|months?|years?|يوم|ايام|اسبوع|اسابيع|شهر|شهور|اشهر|سنه|سنوات)\b"
)

_SIMPLE_WINDOW_DAYS = {
    "last week": 7,
    "past week": 7,
    "last month": 30,
    "past month": 30,
    "last year": 365,
    "past year": 365,
    "اخر اسبوع": 7,
    "الاسبوع الماضي": 7,
    "اخر شهر": 30,
    "الشهر الماضي": 30,
    "اخر سنه": 365,
    "السنه الماضيه": 365,
}


@dataclass(frozen=True)
class QueryAnalysis:
    """Result of analyzing one doctor question."""

    normalized_query: str
    latest: bool
    trend: bool
    date_from: str | None
    soft_doc_type: str | None

    @property
    def mode(self) -> str:
        """Retrieval ordering mode: trend wins when both intents are present."""
        if self.trend:
            return "trend"
        if self.latest:
            return "latest"
        return "normal"


def normalize_query(text: str) -> str:
    """Apply the shared ingest normalizer, then light Arabic normalization."""
    return light_arabic_normalize(normalize(text))


def _has_phrase(text: str, phrase: str) -> bool:
    """Unicode-aware whole-word/phrase match (works for Arabic letters).

    Matching is case-insensitive because doctors capitalize ("Creatinine",
    "Latest") and the keyword lists are lowercase. Arabic has no case, so
    IGNORECASE is a no-op there.
    """
    if not phrase:
        return False
    return (
        re.search(rf"(?<!\w){re.escape(phrase)}(?!\w)", text, re.IGNORECASE) is not None
    )


def _any_phrase(text: str, phrases: list[str]) -> bool:
    return any(_has_phrase(text, phrase) for phrase in phrases)


def _detect_window_days(text: str) -> int | None:
    match = _NUMBERED_WINDOW.search(text)
    if match:
        amount = int(match.group(1))
        unit_days = _TIME_UNIT_DAYS.get(match.group(2))
        if unit_days is not None and amount > 0:
            return amount * unit_days
    for phrase, days in _SIMPLE_WINDOW_DAYS.items():
        if _has_phrase(text, phrase):
            return days
    return None


def _detect_soft_doc_type(text: str) -> str | None:
    for doc_type, keywords in DOC_TYPE_HINT_KEYWORDS.items():
        if any(_has_phrase(text, keyword) for keyword in keywords):
            return doc_type
    return None


def analyze_query(query: str, clock: date | None = None) -> QueryAnalysis:
    """Analyze a doctor question. ``clock`` makes time windows deterministic."""
    settings = get_settings()
    normalized = normalize_query(query)
    window_days = _detect_window_days(normalized)
    reference = clock or date.today()
    inferred_from = (
        (reference - timedelta(days=window_days)).isoformat()
        if window_days is not None
        else None
    )

    latest = _any_phrase(normalized, settings.latest_keywords_en) or _any_phrase(
        normalized, settings.latest_keywords_ar
    )
    trend = _any_phrase(normalized, settings.trend_keywords_en) or _any_phrase(
        normalized, settings.trend_keywords_ar
    )

    return QueryAnalysis(
        normalized_query=normalized,
        latest=latest,
        trend=trend,
        date_from=inferred_from,
        soft_doc_type=_detect_soft_doc_type(normalized),
    )
