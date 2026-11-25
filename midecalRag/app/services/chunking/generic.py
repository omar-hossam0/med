"""Generic fallback chunker (plan Phase 3, D29).

Used when the document type is unknown, the text is random/garbage, or a
specialized chunker raises. Groups lines into size-bounded parents and splits
children at sentence/word boundaries with a small overlap.
"""

from __future__ import annotations

from app.config import get_settings
from app.services.chunking.base import (
    Parent,
    build_parent,
    inject_context,
    split_long_text,
    split_parent_lines,
)

_OVERLAP = 40


def chunk_generic(
    lines: list[str], doc_type: str, doc_date: str, document_id: str
) -> list[Parent]:
    settings = get_settings()
    clean = [line for line in lines if line.strip()]
    if not clean:
        return []

    prefix = inject_context(doc_type, doc_date, "")
    available = max(1, settings.child_max_chars - len(prefix))
    overlap = min(_OVERLAP, max(0, available // 4))

    parents: list[Parent] = []
    index = 0
    for group in split_parent_lines(clean, settings.parent_max_chars):
        parent_text = "\n".join(group)
        pieces = split_long_text(parent_text, available, overlap=overlap)
        if not pieces:
            continue
        parents.append(
            build_parent(
                document_id, index, parent_text, pieces, doc_type, doc_date
            )
        )
        index += 1
    return [parent for parent in parents if parent.children]
