"""Minimal, configurable de-identifier (plan Phase 6, P3).

Removes the identifiers a regex can remove reliably: Egyptian national ID
numbers, phone numbers and e-mail addresses. Applied to context text before any
external LLM call when ``DEIDENTIFY_ENABLED`` is true.

**Known limitation (must not be over-claimed):** this is NOT anonymization.
Patient names, addresses and other free-text identifiers survive, and no regex
can fix that. Real de-identification needs a clinical NLP model or a self-hosted
LLM. This is recorded in PROGRESS.md and must be part of the O1 privacy
decision with the owner and legal advisor.
"""

from __future__ import annotations

import re

from app.config import get_settings

_ID = re.compile(r"(?<!\d)[23]\d{13}(?!\d)")
# Mobile (01[0125]xxxxxxxx), optional +20/0020 country prefix, and long digit runs.
_PHONE = re.compile(r"(?<![\d+])(?:\+?20|0020|0)?1[0125]\d{8}(?!\d)")
_LONG_NUMBER = re.compile(r"(?<![\d+])\+?\d{12,15}(?!\d)")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")

_ID_TOKEN = "[REDACTED_ID]"
_PHONE_TOKEN = "[REDACTED_PHONE]"
_EMAIL_TOKEN = "[REDACTED_EMAIL]"


def scrub(text: str, *, enabled: bool | None = None) -> str:
    """Return ``text`` with removable identifiers replaced by placeholders."""
    if not text:
        return text
    active = get_settings().deidentify_enabled if enabled is None else enabled
    if not active:
        return text
    cleaned = _EMAIL.sub(_EMAIL_TOKEN, text)
    cleaned = _ID.sub(_ID_TOKEN, cleaned)
    cleaned = _PHONE.sub(_PHONE_TOKEN, cleaned)
    cleaned = _LONG_NUMBER.sub(_PHONE_TOKEN, cleaned)
    return cleaned


def redaction_count(original: str, cleaned: str) -> int:
    """How many placeholders were inserted (verification aid, no text logged)."""
    return sum(
        cleaned.count(token) - original.count(token)
        for token in (_ID_TOKEN, _PHONE_TOKEN, _EMAIL_TOKEN)
    )
