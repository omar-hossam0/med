"""Shared text normalizer (plan Phase 3).

The SAME function must be used for document children (this phase) and for
queries (Phase 5), otherwise exact matches such as ``5mg`` vs ``5 mg`` break.

Rules:
- Arabic-Indic and Persian digits become Western digits.
- A unit attached to a number gets a space (``5mg`` -> ``5 mg``).
- Whitespace is collapsed to single spaces and trimmed.

The original text is always kept separately as ``raw_snippet``; normalization
only affects the text that is embedded.
"""

from __future__ import annotations

import re

# ٠..٩ (Arabic-Indic) and ۰..۹ (Persian/Urdu) -> 0..9
_DIGIT_TRANSLATION = str.maketrans(
    "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹",
    "01234567890123456789",
)

# Units that must be separated from a preceding number. Longest alternatives
# come first so "mmol" wins over "mol"; the trailing word boundary prevents
# splitting identifiers such as "A1c" or "T2DM".
_UNIT_AFTER_NUMBER = re.compile(
    r"(?<=\d)(?=(?:mmhg|mmol|µmol|umol|mcg|µg|miu|meq|mg|kg|ng|pg|ml|dl|iu|cm|mm|g|l|u|%)\b)",
    re.IGNORECASE,
)

_WHITESPACE = re.compile(r"\s+")

# Matching-only Arabic normalization (used by the query analyzer and by the
# bilingual term check in the verifier). It must NOT be applied to text that is
# embedded or shown to the doctor - only to strings being compared.
_ARABIC_DIACRITICS = re.compile(r"[\u064B-\u0652\u0670\u0640]")
_ALEF_FORMS = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا"})
_TAA_MARBOOTA = str.maketrans({"ة": "ه", "ى": "ي"})


def normalize(text: str) -> str:
    """Return the canonical text used for embedding and query matching."""
    if not text:
        return ""
    value = text.translate(_DIGIT_TRANSLATION)
    value = _UNIT_AFTER_NUMBER.sub(" ", value)
    return _WHITESPACE.sub(" ", value).strip()


def light_arabic_normalize(text: str) -> str:
    """Matching-only Arabic normalization: unify alef/taa forms, drop diacritics.

    ``أملوديبين``, ``املوديبين`` and ``أملوديبين`` must compare equal, and the
    same for ``الكلى`` / ``الكلي``.
    """
    if not text:
        return ""
    return _ARABIC_DIACRITICS.sub("", text.translate(_ALEF_FORMS).translate(_TAA_MARBOOTA))
