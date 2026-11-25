"""Prescription chunker (plan Phase 3, problem P7).

One child per drug entry (line by line). A line that contains only a dose
("5 mg") is joined to the previous drug line so the drug name never loses its
dose. The parent is the whole prescription.
"""

from __future__ import annotations

import re

from app.config import get_settings
from app.services.chunking.base import Parent, build_parent, split_parent_lines

# A line that is *only* a dose, e.g. "5 mg", "1 tablet", "10مل".
_DOSE_ONLY = re.compile(
    r"^\s*\d+(?:[.,]\d+)?\s*"
    r"(?:mg|mcg|µg|ug|g|kg|ml|dl|l|iu|units?|tablets?|tabs?|capsules?|caps?|"
    r"قرص|أقراص|كبسولة|كبسولات|مل)\s*$",
    re.IGNORECASE,
)

_HAS_LETTER = re.compile(r"[A-Za-z\u0600-\u06FF]")
_HAS_DIGIT = re.compile(r"\d")
_DOSING_WORDS = re.compile(
    r"\b(?:tablet|capsule|cap|tab|daily|every|hours?|hrs?|once|twice|thrice|"
    r"times?|needed|before|after|with|without|food|meal|morning|evening|"
    r"night|weekly|as)\b",
    re.IGNORECASE,
)


def _looks_like_drug_name(line: str) -> bool:
    """Conservative guard: only a bare drug name may absorb a dose-only line."""
    stripped = line.strip()
    return (
        bool(_HAS_LETTER.search(stripped))
        and not _HAS_DIGIT.search(stripped)
        and not _DOSING_WORDS.search(stripped)
        and len(stripped) <= 60
    )


def _join_dose_only(lines: list[str]) -> list[str]:
    pieces: list[str] = []
    for line in lines:
        if not line.strip():
            continue
        if (
            pieces
            and _DOSE_ONLY.fullmatch(line.strip())
            and _looks_like_drug_name(pieces[-1])
        ):
            pieces[-1] = f"{pieces[-1].rstrip()} {line.strip()}"
        else:
            pieces.append(line)
    return pieces


def chunk_prescription(
    lines: list[str], doc_date: str, document_id: str
) -> list[Parent]:
    settings = get_settings()
    clean = [line for line in lines if line.strip()]
    if not clean:
        return []
    pieces = _join_dose_only(clean)
    parents: list[Parent] = []
    for index, group in enumerate(
        split_parent_lines(pieces, settings.parent_max_chars)
    ):
        parent_text = "\n".join(group)
        parents.append(
            build_parent(
                document_id, index, parent_text, group, "prescription", doc_date
            )
        )
    return [parent for parent in parents if parent.children]
