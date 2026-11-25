"""OpenRouter provider (primary generation provider)."""

from __future__ import annotations

from app.config import get_settings
from app.services.llm.base import OpenAICompatibleProvider


class OpenRouterProvider(OpenAICompatibleProvider):
    """OpenRouter via its OpenAI-compatible API. Model id comes from config."""

    def __init__(self, **kwargs) -> None:
        settings = get_settings()
        kwargs.setdefault("name", "openrouter")
        kwargs.setdefault("model", settings.openrouter_model)
        kwargs.setdefault("base_url", settings.openrouter_base_url)
        kwargs.setdefault("api_key", settings.openrouter_api_key.get_secret_value())
        super().__init__(**kwargs)
