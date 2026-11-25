"""Post-generation grounding check (plan Phase 6, P6).

A confident wrong number or drug name is the most dangerous failure in a
clinical product, so every answer is checked against the exact context that was
sent to the model:

- numbers that carry a unit, and decimal values, must exist in the context
  (formatting differences are tolerated: ``1,8`` == ``1.8`` == ``1.80``);
- drug-like tokens (capitalized words with a common pharmacological suffix)
  must exist in the context.

Deliberate limits: bare integers without a unit are NOT checked (they are
usually list numbering), and the drug heuristic is a suffix/stoplist rule, not a
pharmacopoeia. Numbers are the primary defense; the citation list is the second.

**Bilingual terms:** a curated Arabic/English alias map lets a correct English
answer derived from an Arabic document pass (``Creatinine`` vs ``كرياتينين``).
It is a curated list, not a translator: an unlisted synonym still fails, so the
check errs on the safe side.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass

from app.services.normalizer import light_arabic_normalize, normalize

#: canonical English term -> accepted Arabic (and spelling) variants.
#: Extend this map when a new specialty joins; keep it small and reviewed.
CLINICAL_TERM_ALIASES: dict[str, tuple[str, ...]] = {
    "creatinine": ("كرياتينين", "الكرياتينين", "كرياتين"),
    "urea": ("يوريا", "البولينا", "بولينا"),
    "hba1c": ("سكر تراكمي", "السكر التراكمي", "الهيموغلوبين السكري", "هيموغلوبين سكري"),
    "glucose": ("سكر", "جلوكوز", "الجلوكوز"),
    "hemoglobin": ("هيموجلوبين", "الهيموجلوبين"),
    "sodium": ("صوديوم", "الصوديوم"),
    "potassium": ("بوتاسيوم", "البوتاسيوم"),
    "amlodipine": ("أملوديبين", "املوديبين"),
    "atenolol": ("أتينولول", "اتينولول"),
    "losartan": ("لوسارتان", "لوسارتان"),
    "hydrochlorothiazide": ("هيدروكلوروثيازيد", "هيدروكلوروثيازايد"),
    "paracetamol": ("باراسيتامول", "باراسيتامول", "بنادول"),
    "blood pressure": ("ضغط الدم", "الضغط"),
    "hypertension": ("ارتفاع ضغط الدم", "ضغط مرتفع"),
    "renal function": ("وظائف الكلى", "وظايف الكلي"),
    "ultrasound": ("سونار", "أشعة تلفزيونية"),
    "x-ray": ("أشعة", "اشعه"),
    "follow-up": ("متابعة", "زيارة متابعة"),
}


def _alias_key(term: str) -> str:
    return light_arabic_normalize(term).casefold()


#: every spelling (English or Arabic) -> its whole alias group
_ALIAS_INDEX: dict[str, tuple[str, ...]] = {}
for _canonical, _variants in CLINICAL_TERM_ALIASES.items():
    _group = (_canonical, *_variants)
    for _term in _group:
        _ALIAS_INDEX[_alias_key(_term)] = _group


def _alias_in_context(term: str, folded_context: str) -> bool:
    """True when any spelling of ``term`` (either language) is in the context."""
    group = _ALIAS_INDEX.get(_alias_key(term))
    if not group:
        return False
    for variant in group:
        key = _alias_key(variant)
        if key and re.search(rf"(?<!\w){re.escape(key)}(?!\w)", folded_context):
            return True
    return False

_UNIT = (
    r"(?:mg/dl|g/dl|ng/ml|pg/ml|meq/l|miu/l|iu/l|mmol/l|umol/l|µmol/l|"
    r"mg|mcg|µg|ug|kg|ml|dl|mmol|umol|µmol|iu|units?|%|mmhg|bpm|mmol|g|l)"
)
_NUMBER_WITH_UNIT = re.compile(rf"(?<![\w.])(\d+(?:[.,]\d+)?)\s*{_UNIT}\b", re.IGNORECASE)
_DECIMAL = re.compile(r"(?<![\w.])(\d+[.,]\d+)(?![\w.])")
_ANY_NUMBER = re.compile(r"\d+(?:[.,]\d+)?")

_DRUG_SUFFIX = re.compile(
    r"\b([A-Z][A-Za-z]{3,}?"
    r"(?:ine|ol|am|ide|cin|mycin|pam|zep|stat|pril|sartan|dipine|olol|azole|"
    r"cycline|formin|tidine|prazole|mab|tinib|azole|azine|cillin|cef))\b"
)

# Capitalized words that match a suffix but are ordinary English, not drugs.
_NOT_A_DRUG = frozenset(
    {
        "baseline",
        "medicine",
        "medicines",
        "routine",
        "guideline",
        "guidelines",
        "deadline",
        "online",
        "outline",
        "decline",
        "combine",
        "examine",
        "machine",
        "discipline",
        "vaccine",
        "also",
        "value",
        "values",
        "range",
        "result",
        "results",
        "report",
        "reports",
        "date",
        "tablet",
        "tablets",
        "capsule",
        "capsules",
    }
)


@dataclass(frozen=True)
class VerificationResult:
    ok: bool
    missing_numbers: tuple[str, ...] = ()
    missing_terms: tuple[str, ...] = ()

    @property
    def missing(self) -> list[str]:
        return [*self.missing_numbers, *self.missing_terms]


def _haystack(contexts: Sequence[str]) -> tuple[set[float], str]:
    text = normalize("\n".join(contexts or []))
    folded = light_arabic_normalize(text).replace(",", ".").casefold()
    values: set[float] = set()
    for token in _ANY_NUMBER.findall(folded):
        try:
            values.add(round(float(token), 4))
        except ValueError:
            continue
    return values, folded


def _as_float(token: str) -> float | None:
    try:
        return round(float(token.replace(",", ".")), 4)
    except ValueError:
        return None


def verify_answer(answer: str, contexts: Sequence[str]) -> VerificationResult:
    """Check numbers-with-units, decimals and drug-like tokens against context."""
    values, folded = _haystack(contexts)
    body = answer or ""

    missing_numbers: list[str] = []
    seen_numbers: set[str] = set()
    for pattern in (_NUMBER_WITH_UNIT, _DECIMAL):
        for match in pattern.finditer(body):
            raw = match.group(1)
            number = _as_float(raw)
            if number is None or number in values:
                continue
            key = f"{number:g}"
            if key in seen_numbers:
                continue
            seen_numbers.add(key)
            missing_numbers.append(raw)

    missing_terms: list[str] = []
    for term in _DRUG_SUFFIX.findall(body):
        folded_term = term.casefold()
        if folded_term in _NOT_A_DRUG:
            continue
        if re.search(rf"(?<!\w){re.escape(folded_term)}(?!\w)", folded):
            continue
        # Bilingual bridge: "Creatinine" is grounded by "كرياتينين".
        if _alias_in_context(term, folded):
            continue
        if term in missing_terms:
            continue
        missing_terms.append(term)

    ok = not missing_numbers and not missing_terms
    return VerificationResult(
        ok=ok,
        missing_numbers=tuple(missing_numbers),
        missing_terms=tuple(missing_terms),
    )
