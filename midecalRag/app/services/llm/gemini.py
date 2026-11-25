"""Gemini provider (generation fallback).

Uses Google's OpenAI-compatible endpoint so the same SDK and the same request
shape are reused; the model id comes from configuration only.
"""

from __future__ import annotations

from app.config import get_settings
from app.services.llm.base import OpenAICompatibleProvider


class GeminiProvider(OpenAICompatibleProvider):
    """Gemini through the OpenAI-compatible ``v1beta/openai`` endpoint."""

    def __init__(self, **kwargs) -> None:
        settings = get_settings()
        kwargs.setdefault("name", "gemini")
        kwargs.setdefault("model", settings.gemini_model)
        kwargs.setdefault("base_url", settings.gemini_base_url)
        kwargs.setdefault("api_key", settings.gemini_api_key.get_secret_value())
        super().__init__(**kwargs)
