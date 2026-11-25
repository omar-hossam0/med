"""Multilingual query expansion / translation for Phase 5 retrieval.

Owner instruction (wins over the Phase 5 plan text "no LLM calls yet"):
build the query preprocessing + expansion step now, with **OpenRouter as the
primary provider and Gemini as a fallback**. This module is the only place
that talks to those providers for expansion; generation stays OpenRouter-only
in later phases.

Design rules:
- Never send patient documents; only the doctor's question.
- Never log the question or provider response bodies. Only provider names and
  exception class names are logged.
- Failure is non-fatal: any exception/timeout/invalid payload degrades to the
  original query so retrieval still works ("graceful degradation").
- The output is a de-duplicated list of short query variants (original first),
  capped by ``QUERY_EXPANSION_MAX_VARIANTS``.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

_PROMPT_TEMPLATE = """You help a medical record search engine.
Given the doctor's question, return ONLY a JSON object with these keys:
{{"english": "the question in English", "arabic": "the question in Arabic"}}
Keep drug names, lab test names, numbers and units unchanged.
Return no explanation and no markdown.
Doctor question: {query}
"""

_MAX_VARIANT_CHARS = 400


@dataclass(frozen=True)
class QueryExpansion:
    """Result of the expansion step (always includes the original query)."""

    original: str
    variants: list[str]
    source: str
    error: str | None = None


def _available_key(value: Any) -> bool:
    getter = getattr(value, "get_secret_value", None)
    secret = getter() if callable(getter) else value
    return isinstance(secret, str) and bool(secret.strip())


class QueryExpander:
    """OpenRouter-primary / Gemini-fallback query expander.

    ``providers`` exists for tests: a mapping of provider name to a callable
    that receives the prompt and returns raw model text. Injected providers
    bypass API-key checks.
    """

    def __init__(
        self,
        *,
        enabled: bool | None = None,
        providers: dict[str, Callable[[str], str]] | None = None,
    ) -> None:
        self._enabled_override = enabled
        self._providers = providers or {}

    @property
    def settings(self) -> Any:
        return get_settings()

    def enabled(self) -> bool:
        if self._enabled_override is not None:
            return self._enabled_override
        return bool(self.settings.query_expansion_enabled)

    def available(self, provider: str) -> bool:
        if provider in self._providers:
            return True
        if provider == "openrouter":
            return _available_key(self.settings.openrouter_api_key)
        if provider == "gemini":
            return _available_key(self.settings.gemini_api_key)
        return False

    def expand(self, query: str) -> QueryExpansion:
        """Expand ``query``; never raises. On failure returns the original."""
        cleaned = (query or "").strip()
        if not cleaned:
            return QueryExpansion(original="", variants=[""], source="empty")

        if not self.enabled():
            return QueryExpansion(original=cleaned, variants=[cleaned], source="disabled")

        prompt = _PROMPT_TEMPLATE.format(query=cleaned)
        last_error: str | None = None
        for provider in ("openrouter", "gemini"):
            if not self.available(provider):
                continue
            try:
                raw = self._call(provider, prompt)
                variants = self._variants_from_response(raw, cleaned)
            except Exception as exc:  # noqa: BLE001 - any failure must degrade
                last_error = type(exc).__name__
                logger.warning(
                    "query_expansion_failed provider=%s class=%s", provider, last_error
                )
                continue
            if variants:
                view = QueryExpansion(
                    original=cleaned, variants=variants, source=provider
                )
                logger.info(
                    "query_expansion_ok provider=%s variants=%d",
                    provider,
                    len(variants),
                )
                return view

        return QueryExpansion(
            original=cleaned, variants=[cleaned], source="none", error=last_error
        )

    def _call(self, provider: str, prompt: str) -> str:
        injected = self._providers.get(provider)
        if injected is not None:
            return injected(prompt)
        if provider == "openrouter":
            return self._chat(
                api_key=self.settings.openrouter_api_key.get_secret_value(),
                base_url=self.settings.openrouter_base_url,
                model=self.settings.openrouter_model,
                prompt=prompt,
            )
        if provider == "gemini":
            return self._chat(
                api_key=self.settings.gemini_api_key.get_secret_value(),
                base_url=self.settings.gemini_base_url,
                model=self.settings.gemini_model,
                prompt=prompt,
            )
        raise ValueError(f"unknown provider: {provider}")

    def _chat(self, *, api_key: str, base_url: str, model: str, prompt: str) -> str:
        from openai import OpenAI

        client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=float(self.settings.query_expansion_timeout_seconds),
        )
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=300,
        )
        content = response.choices[0].message.content if response.choices else ""
        return content or ""

    def _variants_from_response(self, raw: str, original: str) -> list[str]:
        payload = _parse_json_object(raw)
        if not payload:
            return []
        max_variants = max(1, int(self.settings.query_expansion_max_variants))
        candidates: list[str] = []
        for key in ("english", "arabic"):
            value = payload.get(key)
            if isinstance(value, str):
                candidates.append(value)
        terms = payload.get("terms")
        if isinstance(terms, list):
            candidates.append(" ".join(str(term) for term in terms))

        variants = [original]
        seen = {_dedupe_key(original)}
        for candidate in candidates:
            text = " ".join(candidate.split())
            if not text or len(text) > _MAX_VARIANT_CHARS:
                continue
            key = _dedupe_key(text)
            if key in seen:
                continue
            seen.add(key)
            variants.append(text)
            if len(variants) >= max_variants:
                break
        return variants


def _dedupe_key(text: str) -> str:
    return " ".join(text.casefold().split())


def _parse_json_object(raw: str) -> dict[str, Any] | None:
    if not raw:
        return None
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        payload = json.loads(raw[start : end + 1])
    except (TypeError, ValueError):
        return None
    return payload if isinstance(payload, dict) else None


_default_expander: QueryExpander | None = None


def get_expander() -> QueryExpander:
    global _default_expander
    if _default_expander is None:
        _default_expander = QueryExpander()
    return _default_expander


def reset_expander() -> None:
    global _default_expander
    _default_expander = None
