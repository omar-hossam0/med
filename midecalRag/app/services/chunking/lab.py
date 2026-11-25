"""Lab-result chunker (plan Phase 3, problem P7).

- Preamble (lines before the first heading) becomes its own parent; every line
  is a child (e.g. lab name and report date).
- Each heading (``Renal Function:``) starts a parent whose text is the heading
  plus all of its lines; the heading itself is not a child.
- One child per test line so name, value, unit and range stay together.
- A value-only line (e.g. a wrapped range) is joined to the previous line.
"""

from __future__ import annotations

import logging
import re

from app.config import get_settings
from app.services.chunking.base import (
    Parent,
    build_parent,
    is_heading,
    split_parent_lines,
)

logger = logging.getLogger(__name__)

_UNIT_TOKEN = (
    r"(?:mg/dl|g/dl|mmol/l|µmol/l|umol/l|miu/l|u/l|mg|mcg|µg|ug|kg|ml|dl|mmol|"
    r"µmol|umol|mol|meq|miu|iu|mmhg|bpm|ng|pg|cm|mm|g|l|u|%)"
)
_VALUE_LINE = re.compile(
    rf"^\s*(?:[<>]=?\s*)?\d+(?:[.,]\d+)?\s*{_UNIT_TOKEN}?"
    rf"(?:\s*/\s*{_UNIT_TOKEN})?\s*(?:\([^)]*\))?\s*$",
    re.IGNORECASE,
)
_RANGE_ONLY = re.compile(r"^\s*[\d.,]+\s*[-–—]\s*[\d.,]+\s*$")
_NUMERIC_ONLY = re.compile(r"^[\d\s.,%()/+\-–—]+$")
_HAS_LETTER = re.compile(r"[A-Za-z\u0600-\u06FF]")
_HAS_DIGIT = re.compile(r"\d")


def _is_value_only(line: str) -> bool:
    stripped = (line or "").strip()
    if not stripped:
        return False
    if not _HAS_LETTER.search(stripped):
        return True
    return bool(_VALUE_LINE.fullmatch(stripped) or _RANGE_ONLY.fullmatch(stripped))


def _is_name_only(line: str) -> bool:
    stripped = (line or "").strip()
    return bool(_HAS_LETTER.search(stripped)) and not _HAS_DIGIT.search(stripped)


def _warn_if_column_ocr(lines: list[str], document_id: str) -> None:
    """Column-by-column OCR produces many value-only and name-only lines.

    Log counts only (never text) so the OCR team can be alerted.
    """
    numeric_only = sum(1 for line in lines if _NUMERIC_ONLY.fullmatch(line.strip()))
    name_only = sum(1 for line in lines if _is_name_only(line))
    if numeric_only >= 2 and name_only >= 2:
        logger.warning(
            "column_ocr_symptom numeric_only=%d name_only=%d document_id=%s",
            numeric_only,
            name_only,
            document_id,
        )


def _child_pieces(lines: list[str]) -> list[str]:
    """Join wrapped value-only lines onto the previous line."""
    pieces: list[str] = []
    for line in lines:
        if not line.strip():
            continue
        if pieces and _is_value_only(line):
            pieces[-1] = f"{pieces[-1].rstrip()}\n{line.strip()}"
        else:
            pieces.append(line)
    return pieces


def chunk_lab(lines: list[str], doc_date: str, document_id: str) -> list[Parent]:
    settings = get_settings()
    clean = [line for line in lines if line.strip()]
    if not clean:
        return []

    _warn_if_column_ocr(clean, document_id)

    preamble: list[str] = []
    sections: list[tuple[str, list[str]]] = []
    current_heading: str | None = None
    current_lines: list[str] = []

    for line in clean:
        if is_heading(line):
            if current_heading is not None:
                sections.append((current_heading, current_lines))
            current_heading = line.strip()
            current_lines = []
        elif current_heading is None:
            preamble.append(line)
        else:
            current_lines.append(line)
    if current_heading is not None:
        sections.append((current_heading, current_lines))

    parents: list[Parent] = []
    index = 0

    if preamble:
        for group in split_parent_lines(preamble, settings.parent_max_chars):
            parent_text = "\n".join(group)
            parents.append(
                build_parent(
                    document_id, index, parent_text, _child_pieces(group),
                    "lab_result", doc_date,
                )
            )
            index += 1

    for heading, section_lines in sections:
        if not section_lines:
            parents.append(
                build_parent(
                    document_id, index, heading, [heading], "lab_result", doc_date
                )
            )
            index += 1
            continue
        for group in split_parent_lines(section_lines, settings.parent_max_chars):
            parent_text = "\n".join([heading, *group])
            parents.append(
                build_parent(
                    document_id, index, parent_text, _child_pieces(group),
                    "lab_result", doc_date,
                )
            )
            index += 1

    return [parent for parent in parents if parent.children]
