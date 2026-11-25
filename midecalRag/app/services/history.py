"""Follow-up rewriting (plan Phase 6, P15).

A follow-up such as "and at what dose?" retrieves nothing on its own, so the
last ``HISTORY_MAX_MESSAGES`` messages (each truncated to ``HISTORY_MAX_CHARS``)
are used to rewrite the question into a standalone one at temperature 0.

Rules:
- no history -> no LLM call at all;
- a failed or empty rewrite silently falls back to the original question, so a
  provider problem never blocks the ask path;
- only the fact that a rewrite happened is logged, never the text.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass

from app.config import get_settings
from app.services.llm.base import LlmMessage
from app.services.llm.factory import get_llm_chain

logger = logging.getLogger(__name__)

REWRITE_SYSTEM = (
    "You rewrite a doctor's follow-up question into ONE standalone question. Use the "
    "conversation only to resolve pronouns and missing subjects (for example what "
    "\"it\" refers to). Keep drug names, lab test names, numbers, units and the "
    "original language unchanged. Return ONLY the rewritten question: no explanation, "
    "no quotes, no markdown."
)

_MAX_REWRITE_CHARS = 500


@dataclass(frozen=True)
class RewriteResult:
    query: str
    rewritten: bool
    error: str | None = None


def _field(message: object, name: str) -> str:
    value = getattr(message, name, None)
    if value is None and isinstance(message, dict):
        value = message.get(name)
    return str(value or "")


def clamp_history(
    history: Sequence[object] | None,
    *,
    max_messages: int | None = None,
    max_chars: int | None = None,
) -> list[LlmMessage]:
    """Last N messages, each truncated; unknown roles are skipped."""
    settings = get_settings()
    limit = int(max_messages or settings.history_max_messages)
    cap = int(max_chars or settings.history_max_chars)
    messages: list[LlmMessage] = []
    for message in list(history or [])[-limit:]:
        role = _field(message, "role")
        content = _field(message, "content").strip()
        if role not in ("user", "assistant") or not content:
            continue
        messages.append(LlmMessage(role=role, content=content[:cap]))
    return messages


def _transcript(messages: list[LlmMessage]) -> str:
    lines = [
        f"{'Doctor' if message.role == 'user' else 'Assistant'}: {message.content}"
        for message in messages
    ]
    return "\n".join(lines)


def _clean_rewrite(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        return ""
    # Models sometimes wrap the answer in quotes or a "Standalone question:" label.
    first_line = text.splitlines()[0].strip()
    for prefix in ("Standalone question:", "Question:", "Rewritten question:"):
        if first_line.lower().startswith(prefix.lower()):
            first_line = first_line[len(prefix) :].strip()
    return first_line.strip().strip("\"'`*").strip()[:_MAX_REWRITE_CHARS]


def rewrite_query(
    doctor_query: str,
    history: Sequence[object] | None,
    *,
    chain=None,
) -> RewriteResult:
    """Rewrite ``doctor_query`` into a standalone question, or return it as-is."""
    messages = clamp_history(history)
    if not messages:
        return RewriteResult(query=doctor_query, rewritten=False)

    prompt = (
        f"Conversation:\n{_transcript(messages)}\n\n"
        f"Follow-up question: {doctor_query}\n\n"
        "Standalone question:"
    )
    try:
        active_chain = chain or get_llm_chain()
        result = active_chain.generate(
            [
                LlmMessage(role="system", content=REWRITE_SYSTEM),
                LlmMessage(role="user", content=prompt),
            ],
            temperature=0.0,
            max_tokens=200,
        )
    except Exception as exc:  # noqa: BLE001 - degrade, never block the ask
        logger.warning("history_rewrite_failed class=%s", type(exc).__name__)
        return RewriteResult(query=doctor_query, rewritten=False, error=type(exc).__name__)

    cleaned = _clean_rewrite(result.text)
    if not cleaned:
        logger.warning("history_rewrite_empty provider=%s", result.provider)
        return RewriteResult(query=doctor_query, rewritten=False, error="empty")

    logger.info("history_rewrite applied=True provider=%s", result.provider)
    return RewriteResult(query=cleaned, rewritten=True)
