"""Provider factory: one cached chain (OpenRouter primary, Gemini fallback)."""

from __future__ import annotations

from app.services.llm.base import LlmChain
from app.services.llm.gemini import GeminiProvider
from app.services.llm.openrouter import OpenRouterProvider

_chain: LlmChain | None = None


def build_llm_chain() -> LlmChain:
    """Fresh chain from the current configuration (used at startup and in tests)."""
    return LlmChain([OpenRouterProvider(), GeminiProvider()])


def get_llm_chain() -> LlmChain:
    global _chain
    if _chain is None:
        _chain = build_llm_chain()
    return _chain


def reset_llm_chain() -> None:
    global _chain
    _chain = None
