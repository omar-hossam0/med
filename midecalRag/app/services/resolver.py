"""Document type and date resolution (plan Section 5.1, D22, D30, issue P4).

Date priority for OCR documents:
    user_selected_date -> ocr_output.extracted_date -> date parsed from the
    text (sample/examination dates preferred; dd/mm/yyyy is day-first, and
    when both numbers are <= 12 the source is marked text_ambiguous) ->
    the clinic-timezone date of uploaded_at (source "upload", unreliable).

Session reports (D30) never parse dates from report text:
    user_selected_date -> consultation_date -> clinic-timezone date of
    approved_at (source "approval") -> clinic-timezone date of uploaded_at
    (source "approval_time", because upload happens at approval).

Dates in the future or before 1900 are ignored (plan Section 5.1 rules);
this range check is applied to user-provided dates too.
"""

from __future__ import annotations

import logging
import re
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from app.config import get_settings

logger = logging.getLogger(__name__)

VALID_DOC_TYPES = frozenset(
    {"lab_result", "prescription", "radiology", "medical_report", "session_report"}
)

# Context keywords that mark a sample/examination date (preferred over
# report/print dates). English plus a minimal Arabic set.
_DATE_KEYWORDS = ("sample", "collected", "collection", "examination", "عينة")

_ISO_RE = re.compile(r"(?P<y>\d{4})-(?P<m>\d{1,2})-(?P<d>\d{1,2})")
_SLASH_RE = re.compile(r"(?P<d>\d{1,2})/(?P<m>\d{1,2})/(?P<y>\d{4})")
_DASH_RE = re.compile(r"(?P<d>\d{1,2})-(?P<m>\d{1,2})-(?P<y>\d{4})")


def resolve_doc_type(
    user_selected_type: str, detected_doc_type: str | None, document_id: str = ""
) -> tuple[str, bool]:
    """The user's choice always wins; a valid OCR detection that disagrees is
    logged (document id only, never text) to measure OCR quality."""
    mismatch = bool(
        detected_doc_type
        and detected_doc_type in VALID_DOC_TYPES
        and detected_doc_type != user_selected_type
    )
    if mismatch:
        logger.info("doc_type_mismatch document_id=%s", document_id)
    return user_selected_type, mismatch


def _mk_date(y: str, m: str, d: str) -> date | None:
    try:
        return date(int(y), int(m), int(d))
    except ValueError:
        return None


def _in_valid_range(value: date | None, today: date) -> bool:
    return value is not None and date(1900, 1, 1) <= value <= today


def parse_date_string(value: str) -> tuple[date, bool] | None:
    """Parse ISO YYYY-MM-DD or dd/mm/yyyy or dd-mm-yyyy (day-first for Egypt,
    plan O8 default). Returns (date, ambiguous); ambiguous only when a
    day-first slash/dash date has both numbers <= 12."""
    s = (value or "").strip()
    m = _ISO_RE.fullmatch(s)
    if m:
        parsed = _mk_date(m["y"], m["m"], m["d"])
        return (parsed, False) if parsed else None
    m = _SLASH_RE.fullmatch(s) or _DASH_RE.fullmatch(s)
    if m:
        day, month = int(m["d"]), int(m["m"])
        parsed = _mk_date(m["y"], str(month), str(day))
        if parsed is None:
            return None
        return parsed, (day <= 12 and month <= 12)
    return None


def _dates_in_text(text: str, today: date) -> tuple[date, bool] | None:
    """All valid dates found in the text; prefer one near a sample/examination
    keyword, otherwise the first in reading order."""
    matches: list[tuple[date, bool, bool, int]] = []
    for rx, day_first in ((_ISO_RE, False), (_SLASH_RE, True), (_DASH_RE, True)):
        for m in rx.finditer(text):
            if day_first:
                day, month = int(m["d"]), int(m["m"])
                parsed = _mk_date(m["y"], str(month), str(day))
                ambiguous = day <= 12 and month <= 12
            else:
                parsed = _mk_date(m["y"], m["m"], m["d"])
                ambiguous = False
            if not _in_valid_range(parsed, today):
                continue
            assert parsed is not None
            # The label precedes its date in medical reports ("Sample
            # collected: 2026-09-01"), so only look BACKWARD; a symmetric
            # window would let the next line's keyword claim this date.
            window = text[max(0, m.start() - 60) : m.start()].lower()
            near_keyword = any(k in window for k in _DATE_KEYWORDS)
            matches.append((parsed, ambiguous, near_keyword, m.start()))
    if not matches:
        return None
    preferred = [x for x in matches if x[2]] or matches
    preferred.sort(key=lambda x: x[3])
    chosen = preferred[0]
    return chosen[0], chosen[1]


def _clinic_date(value: datetime, tz: ZoneInfo) -> date:
    """Convert a timestamp to the clinic time zone before taking the date
    (plan D30/A19: a late-evening visit must not get the next day's date).
    Naive timestamps are assumed UTC."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(tz).date()


def resolve_doc_date(
    *,
    user_selected_date: date | None,
    extracted_date: str | None,
    raw_text: str,
    uploaded_at: datetime,
    is_session_report: bool,
    consultation_date: str | None = None,
    approved_at: datetime | None = None,
    today: date | None = None,
) -> tuple[str, str]:
    """Returns (doc_date ISO string, date_source). uploaded_at always provides
    a last-resort date, so doc_date is never None for a valid request."""
    settings = get_settings()
    today = today or date.today()
    tz = ZoneInfo(settings.clinic_timezone)

    if is_session_report:
        if _in_valid_range(user_selected_date, today):
            assert user_selected_date is not None
            return user_selected_date.isoformat(), "user"
        if consultation_date:
            parsed = parse_date_string(consultation_date)
            if parsed and _in_valid_range(parsed[0], today):
                return parsed[0].isoformat(), "consultation"
        if approved_at is not None:
            d = _clinic_date(approved_at, tz)
            if _in_valid_range(d, today):
                return d.isoformat(), "approval"
        return _clinic_date(uploaded_at, tz).isoformat(), "approval_time"

    if _in_valid_range(user_selected_date, today):
        assert user_selected_date is not None
        return user_selected_date.isoformat(), "user"
    if extracted_date:
        parsed = parse_date_string(extracted_date)
        if parsed and _in_valid_range(parsed[0], today):
            return parsed[0].isoformat(), "ocr"
    parsed = _dates_in_text(raw_text or "", today)
    if parsed and _in_valid_range(parsed[0], today):
        return parsed[0].isoformat(), ("text_ambiguous" if parsed[1] else "text")
    return _clinic_date(uploaded_at, tz).isoformat(), "upload"
