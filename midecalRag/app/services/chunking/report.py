"""Report chunker for ``medical_report`` and ``radiology`` (plan Phase 3).

Sections are detected from headings (line-ending colon, markdown ``#`` or a
known clinical label). The parent is the section (heading + its paragraphs);
children are paragraphs or sentence groups. Text without headings falls back
to size-bounded parents and children.
"""

from __future__ import annotations

from app.config import get_settings
from app.services.chunking.base import (
    Parent,
    build_parent,
    split_long_text,
    split_parent_lines,
    split_sections,
)
from app.services.chunking.generic import chunk_generic


def chunk_report(
    lines: list[str], doc_type: str, doc_date: str, document_id: str
) -> list[Parent]:
    settings = get_settings()
    clean = [line for line in lines if line.strip()]
    if not clean:
        return []

    sections = split_sections(clean, known_only=True)
    if not any(label for label, _, _ in sections):
        return chunk_generic(clean, doc_type, doc_date, document_id)
    parents: list[Parent] = []
    index = 0

    for heading, content_lines, original_heading in sections:
        content = [line for line in content_lines if line.strip()]
        if not original_heading and not content:
            continue

        if not content:
            parent_text = original_heading or heading
            parents.append(
                build_parent(
                    document_id, index, parent_text, [parent_text], doc_type, doc_date
                )
            )
            index += 1
            continue

        # A single huge paragraph cannot be grouped by lines; split it directly.
        if len(content) == 1 and len(content[0]) > settings.parent_max_chars:
            for piece in split_long_text(content[0], settings.parent_max_chars):
                parent_text = (
                    f"{original_heading}\n{piece}" if original_heading else piece
                )
                parents.append(
                    build_parent(
                        document_id, index, parent_text, [piece], doc_type, doc_date
                    )
                )
                index += 1
            continue

        for group in split_parent_lines(content, settings.parent_max_chars):
            parent_text = "\n".join(
                ([original_heading] if original_heading else []) + group
            )
            parents.append(
                build_parent(
                    document_id, index, parent_text, group, doc_type, doc_date
                )
            )
            index += 1

    return [parent for parent in parents if parent.children]
