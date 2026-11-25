"""Session-report chunker (plan Phase 3 / Section 5.4).

- Exactly one parent per document (``<document_id>#p0``). The parent text is
  ``full_report_text`` when present, otherwise the labeled sections.
- Structured ``session_report_data`` wins: one child per section, with the
  canonical section label in the injected prefix.
- When only ``full_report_text`` exists, the known labels / markdown headings
  are parsed from the text; if none are found every paragraph is a ``General``
  child.
- A section longer than ``parent_max_chars`` keeps the same label on every
  split child (the plan requires this for question routing).
"""

from __future__ import annotations

import logging

from app.config import get_settings
from app.schemas.contract import SessionReportData
from app.services.chunking.base import (
    Parent,
    build_parent,
    make_parent_id,
    split_parent_lines,
    split_sections,
)
from app.services.normalizer import normalize

logger = logging.getLogger(__name__)

_KNOWN_LABELS: tuple[tuple[str, str], ...] = (
    ("chief_complaint", "Chief Complaint"),
    ("history_of_present_illness", "History of Present Illness"),
    ("assessment_and_diagnosis", "Diagnosis"),
    ("treatment_plan", "Treatment Plan"),
)

_NON_SECTION_FIELDS = frozenset(
    {"full_report_text", "consultation_date", "approved_at"}
)


def _structured_sections(data: SessionReportData) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    for field_name, label in _KNOWN_LABELS:
        value = getattr(data, field_name)
        if value is not None and value.strip():
            sections.append((label, value))
    for field_name, value in (data.model_extra or {}).items():
        if field_name in _NON_SECTION_FIELDS:
            continue
        if isinstance(value, str) and value.strip():
            sections.append((field_name.replace("_", " ").title(), value))
    return sections


def _parent_text(data: SessionReportData, lines: list[str]) -> str:
    full = (data.full_report_text or "").strip()
    if full:
        return full
    sections = _structured_sections(data)
    if sections:
        return "\n".join(f"{label}: {value.strip()}" for label, value in sections)
    return "\n".join(line for line in lines if line.strip())


def _add_section_children(
    parent: Parent,
    document_id: str,
    parent_text: str,
    doc_date: str,
    label: str,
    value_lines: list[str],
) -> None:
    settings = get_settings()
    groups = split_parent_lines(value_lines, settings.parent_max_chars)
    for group in groups:
        if not group:
            continue
        built = build_parent(
            document_id,
            0,
            parent_text,
            group,
            "session_report",
            doc_date,
            section_label=label,
        )
        parent.children.extend(built.children)


def chunk_session(
    lines: list[str],
    doc_date: str,
    document_id: str,
    data: SessionReportData | None = None,
) -> list[Parent]:
    settings = get_settings()
    clean = [line for line in lines if line.strip()]
    if not clean and data is None:
        return []

    parent_id = make_parent_id(document_id, 0)
    parent_text = _parent_text(data, clean) if data is not None else "\n".join(clean)
    if not parent_text.strip():
        return []
    parent = Parent(parent_id=parent_id, parent_text=parent_text, children=[])

    structured = _structured_sections(data) if data is not None else []
    if structured:
        for label, value in structured:
            value_lines = [line for line in value.split("\n") if line.strip()]
            _add_section_children(
                parent, document_id, parent_text, doc_date, label, value_lines
            )
        full = (data.full_report_text or "").strip() if data is not None else ""
        if full:
            section_blob = normalize(
                " ".join(value for _, value in structured)
            ).lower()
            full_blob = normalize(full).lower()
            if (
                section_blob
                and full_blob
                and section_blob not in full_blob
                and full_blob not in section_blob
            ):
                logger.warning(
                    "session_sections_mismatch document_id=%s", document_id
                )
    else:
        sections = split_sections(clean, known_only=True)
        if any(label for label, _, _ in sections):
            for label, content, _original_heading in sections:
                label = label.strip() or "General"
                value_lines = content if content else [label]
                _add_section_children(
                    parent, document_id, parent_text, doc_date, label, value_lines
                )
        else:
            _add_section_children(
                parent, document_id, parent_text, doc_date, "General", clean
            )

    if not parent.children:
        return []

    if len(parent_text) > settings.parent_max_chars:
        logger.warning(
            "session_parent_too_long parent_chars=%d document_id=%s",
            len(parent_text),
            document_id,
        )
    return [parent]
