"""Shared parent/child structures and text helpers (plan Phase 3).

A chunker is a pure function that turns one document into ``Parent`` objects,
each holding its ``Child`` children. ``flatten`` converts the tree into the
flat ``list[Child]`` the ingestion pipeline consumes (document order,
sequential ``child_index``).

Context injection (plan D16/D29):
- normal:  ``[<doc_type> | <doc_date>] <normalized text>``
- session: ``[session_report | <doc_date> | Section: <Label>] <normalized text>``
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from app.config import get_settings
from app.services.normalizer import normalize

logger = logging.getLogger(__name__)

# Section labels used by the heading heuristics (English + Arabic).
KNOWN_HEADINGS = frozenset(
    {
        "renal function",
        "liver function",
        "complete blood count",
        "cbc",
        "lipid profile",
        "diagnosis",
        "medications",
        "medication",
        "findings",
        "impression",
        "assessment",
        "plan",
        "history",
        "chief complaint",
        "history of present illness",
        "treatment plan",
        "allergies",
        "general",
        "التشخيص",
        "الأدوية",
        "الانطباع",
        "وظائف الكلى",
        "وظائف الكبد",
        "صورة دم كاملة",
        "الدهون",
        "الخطة العلاجية",
        "الشكوى الرئيسية",
    }
)

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?؛;])\s+|\n+")
_INLINE_HEADING = re.compile(
    r"^(?P<label>[A-Za-z\u0600-\u06FF][A-Za-z0-9 \u0600-\u06FF/&'’\-]{0,60}):\s*(?P<content>.*)$"
)


@dataclass
class Child:
    """One embedded unit. Field order is part of the pipeline contract."""

    child_text: str
    raw_snippet: str
    parent_text: str
    parent_id: str
    child_index: int


@dataclass
class Parent:
    parent_id: str
    parent_text: str
    children: list[Child] = field(default_factory=list)


def make_parent_id(document_id: str, index: int) -> str:
    return f"{document_id}#p{index}"


def inject_context(
    doc_type: str,
    doc_date: str,
    text: str,
    section_label: str | None = None,
) -> str:
    """Prepend the exact plan prefix to a normalized child text."""
    normalized = normalize(text)
    if doc_type == "session_report":
        label = (section_label or "General").strip() or "General"
        return f"[session_report | {doc_date} | Section: {label}] {normalized}"
    return f"[{doc_type} | {doc_date}] {normalized}"


def _split_by_words(text: str, max_chars: int) -> list[str]:
    words = text.split()
    out: list[str] = []
    current = ""
    for word in words:
        if len(word) > max_chars:
            if current:
                out.append(current)
                current = ""
            for start in range(0, len(word), max_chars):
                out.append(word[start : start + max_chars])
            continue
        if not current:
            current = word
        elif len(current) + 1 + len(word) <= max_chars:
            current = f"{current} {word}"
        else:
            out.append(current)
            current = word
    if current:
        out.append(current)
    return out


def split_long_text(text: str, max_chars: int, overlap: int = 0) -> list[str]:
    """Split text at sentence/newline/word boundaries without empty pieces."""
    text = (text or "").strip()
    if not text:
        return []
    max_chars = max(1, max_chars)
    if len(text) <= max_chars:
        return [text]

    parts = [part.strip() for part in _SENTENCE_SPLIT.split(text) if part.strip()]
    chunks: list[str] = []
    current = ""
    for part in parts:
        if not current:
            current = part
        elif len(current) + 1 + len(part) <= max_chars:
            current = f"{current} {part}"
        else:
            chunks.extend(_split_by_words(current, max_chars))
            current = part
    if current:
        chunks.extend(_split_by_words(current, max_chars))

    chunks = [chunk for chunk in chunks if chunk.strip()]
    if overlap > 0 and len(chunks) > 1:
        merged = [chunks[0]]
        for piece in chunks[1:]:
            tail = merged[-1][-overlap:].lstrip()
            if " " in tail:
                tail = tail.split(" ", 1)[1].strip()
            candidate = f"{tail} {piece}".strip() if tail else piece
            merged.append(candidate if len(candidate) <= max_chars else piece)
        chunks = merged
    return chunks


def split_parent_lines(lines: list[str], max_chars: int) -> list[list[str]]:
    """Group lines into parent-sized buckets, cutting only at line boundaries."""
    groups: list[list[str]] = []
    current: list[str] = []
    current_len = 0
    for line in lines:
        if not line.strip():
            continue
        if len(line) > max_chars:
            if current:
                groups.append(current)
                current = []
                current_len = 0
            groups.append([line])
            continue
        extra = len(line) + (1 if current else 0)
        if current and current_len + extra > max_chars:
            groups.append(current)
            current = [line]
            current_len = len(line)
        else:
            current.append(line)
            current_len += extra
    if current:
        groups.append(current)
    return groups or [[]]


def is_heading(line: str) -> bool:
    """Line-ending colon with no digits, markdown heading, or a known label."""
    stripped = (line or "").strip()
    if not stripped:
        return False
    if stripped.startswith("#"):
        return True
    if stripped.endswith(":") and len(stripped) <= 80 and not re.search(r"\d", stripped):
        return True
    return stripped.lower().rstrip(":").strip() in KNOWN_HEADINGS


def heading_text(line: str, known_only: bool = True) -> tuple[str, str, str] | None:
    """Return ``(label, inline_content, original_heading)`` for a heading line."""
    stripped = (line or "").strip()
    if not stripped:
        return None
    if stripped.startswith("#"):
        label = stripped.lstrip("#").strip()
        return (label, "", stripped) if label else None
    if stripped.endswith(":") and len(stripped) <= 80 and not re.search(r"\d", stripped):
        return (stripped[:-1].strip(), "", stripped)
    lowered = stripped.lower().rstrip(":").strip()
    if lowered in KNOWN_HEADINGS:
        return (stripped.rstrip(":").strip(), "", stripped)
    match = _INLINE_HEADING.match(stripped)
    if match:
        label = match.group("label").strip()
        content = match.group("content").strip()
        if known_only and label.lower() not in KNOWN_HEADINGS:
            return None
        if not known_only and len(label) > 60:
            return None
        return (label, content, f"{label}:")
    return None


def split_sections(
    lines: list[str], known_only: bool = True
) -> list[tuple[str, list[str], str]]:
    """Split lines into ``(label, content_lines, original_heading)`` sections."""
    sections: list[tuple[str, list[str], str]] = []
    current_label: str | None = None
    current_heading = ""
    current_lines: list[str] = []
    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            continue
        parsed = heading_text(line, known_only=known_only)
        if parsed is not None:
            if current_label is not None or current_lines:
                sections.append(
                    (current_label or "", current_lines, current_heading)
                )
            current_label, inline, current_heading = parsed
            current_lines = [inline] if inline.strip() else []
        else:
            current_lines.append(line)
    if current_label is not None or current_lines:
        sections.append((current_label or "", current_lines, current_heading))
    return sections


def build_parent(
    document_id: str,
    index: int,
    parent_text: str,
    raw_pieces: list[str],
    doc_type: str,
    doc_date: str,
    section_label: str | None = None,
) -> Parent:
    """Create a parent and its children, enforcing the child length guard."""
    settings = get_settings()
    parent_id = make_parent_id(document_id, index)
    prefix = inject_context(doc_type, doc_date, "", section_label)
    available = max(1, settings.child_max_chars - len(prefix))
    children: list[Child] = []
    for raw in raw_pieces:
        if raw is None or not str(raw).strip():
            continue
        for piece in split_long_text(str(raw), available):
            children.append(
                Child(
                    child_text=inject_context(doc_type, doc_date, piece, section_label),
                    raw_snippet=piece,
                    parent_text=parent_text,
                    parent_id=parent_id,
                    child_index=-1,
                )
            )
    return Parent(parent_id=parent_id, parent_text=parent_text, children=children)


def flatten(parents: list[Parent]) -> list[Child]:
    """Flatten parents into pipeline children with sequential ``child_index``."""
    out: list[Child] = []
    index = 0
    for parent in parents:
        for child in parent.children:
            if not child.child_text.strip() or not child.raw_snippet.strip():
                continue
            child.child_index = index
            index += 1
            out.append(child)
    return out
