"""LLM provider interface, retries and the primary/fallback chain (Phase 6).

Owner instruction (2026-11-23): OpenRouter is the primary provider and Gemini
is the fallback for generation, exactly like the Phase 5 query-expansion step.
This supersedes the plan's "single provider, no fallback" wording.

Rules kept from the plan:
- model ids and endpoints come from configuration only;
- rate limits and timeouts are retried with exponential backoff;
- a persistent failure becomes ``503 dependency_unavailable``;
- only provider names, exception CLASSES, latencies and token counts are
  logged - never prompts, patient text or answers.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Literal, Protocol

from app.config import get_settings
from app.schemas.errors import DependencyUnavailable

logger = logging.getLogger(__name__)

Role = Literal["system", "user", "assistant"]

# HTTP statuses worth retrying: rate limits, timeouts and server-side faults.
_RETRYABLE_STATUS = frozenset({408, 409, 425, 429, 500, 502, 503, 504})
_RETRYABLE_NAMES = frozenset(
    {
        "RateLimitError",
        "APITimeoutError",
        "APIConnectionError",
        "InternalServerError",
        "TimeoutError",
        "Timeout",
        "ConnectionError",
    }
)


@dataclass(frozen=True)
class LlmMessage:
    """One chat message. ``content`` may contain patient text: never log it."""

    role: Role
    content: str


@dataclass(frozen=True)
class LlmResult:
    text: str
    provider: str
    model: str
    latency_ms: float
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    #: "stop" normally; "length" means the output hit max_tokens (truncated).
    finish_reason: str | None = None


def is_truncated(result: Any) -> bool:
    """True when the provider stopped because it ran out of output tokens.

    Reasoning-capable models (Gemini 2.5) count thinking tokens against
    ``max_tokens``, so a budget that looks generous can still cut the visible
    answer mid-sentence. Callers must not treat such an answer as complete.
    """
    return str(getattr(result, "finish_reason", "") or "").strip().lower() == "length"


class LlmProvider(Protocol):
    """Minimal provider contract (swappable through configuration)."""

    name: str
    model: str

    def available(self) -> bool: ...

    def generate(
        self,
        messages: Sequence[LlmMessage],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> LlmResult: ...


def _is_retryable(exc: BaseException) -> bool:
    status = getattr(exc, "status_code", None)
    if isinstance(status, int):
        return status in _RETRYABLE_STATUS
    return type(exc).__name__ in _RETRYABLE_NAMES


def _retry_after_seconds(exc: BaseException) -> float | None:
    """Honour a server-provided ``Retry-After`` header when present.

    Free tiers answer 429 with a pacing hint; ignoring it makes every retry
    fail the same way. Capped by the caller so a hostile value cannot stall a
    request.
    """
    response = getattr(exc, "response", None)
    headers = getattr(response, "headers", None)
    if headers is None:
        return None
    try:
        value = headers.get("retry-after") or headers.get("Retry-After")
    except Exception:  # noqa: BLE001 - header access must never raise
        return None
    if value is None:
        return None
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        return None


class OpenAICompatibleProvider:
    """Base for any OpenAI-compatible chat endpoint, with bounded retries.

    Both configured providers (OpenRouter, Gemini) expose an OpenAI-compatible
    ``/chat/completions`` route, so one implementation serves both and the
    ``openai`` SDK stays the only LLM client.
    """

    name = "openai_compatible"

    def __init__(
        self,
        *,
        name: str,
        model: str,
        base_url: str,
        api_key: str,
        timeout: float | None = None,
        retry_attempts: int | None = None,
        retry_wait_seconds: float | None = None,
        client: Any = None,
    ) -> None:
        self.name = name
        self.model = model
        self._base_url = base_url
        self._api_key = api_key or ""
        self._timeout = timeout
        self._retry_attempts = retry_attempts
        self._retry_wait = retry_wait_seconds
        self._client = client

    def available(self) -> bool:
        return bool(self._api_key.strip())

    @property
    def client(self) -> Any:
        if self._client is None:
            from openai import OpenAI

            settings = get_settings()
            self._client = OpenAI(
                api_key=self._api_key,
                base_url=self._base_url,
                timeout=float(self._timeout or settings.llm_timeout_seconds),
            )
        return self._client

    def generate(
        self,
        messages: Sequence[LlmMessage],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> LlmResult:
        settings = get_settings()
        if not self.available():
            raise DependencyUnavailable("llm", detail=f"{self.name}_no_key")

        attempts = max(1, int(self._retry_attempts or settings.llm_retry_attempts))
        base_wait = (
            self._retry_wait
            if self._retry_wait is not None
            else float(settings.llm_retry_wait_seconds)
        )
        payload = [
            {"role": message.role, "content": message.content} for message in messages
        ]
        started = time.perf_counter()
        last_exc: BaseException | None = None

        for attempt in range(1, attempts + 1):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=payload,
                    temperature=(
                        float(settings.llm_temperature)
                        if temperature is None
                        else float(temperature)
                    ),
                    max_tokens=int(max_tokens or settings.llm_max_tokens),
                    timeout=float(timeout or self._timeout or settings.llm_timeout_seconds),
                )
                text = ""
                finish_reason = None
                if getattr(response, "choices", None):
                    choice = response.choices[0]
                    text = choice.message.content or ""
                    finish_reason = getattr(choice, "finish_reason", None)
                usage = getattr(response, "usage", None)
                latency_ms = round((time.perf_counter() - started) * 1000, 2)
                if str(finish_reason or "").lower() == "length":
                    # Visible output was cut by max_tokens (thinking tokens count
                    # against the same budget on reasoning models).
                    logger.warning(
                        "llm_output_truncated provider=%s completion_tokens=%s",
                        self.name,
                        getattr(usage, "completion_tokens", None),
                    )
                logger.info(
                    "llm_ok provider=%s attempt=%d latency_ms=%.1f prompt_tokens=%s "
                    "completion_tokens=%s finish_reason=%s",
                    self.name,
                    attempt,
                    latency_ms,
                    getattr(usage, "prompt_tokens", None),
                    getattr(usage, "completion_tokens", None),
                    finish_reason,
                )
                return LlmResult(
                    text=text,
                    provider=self.name,
                    model=self.model,
                    latency_ms=latency_ms,
                    prompt_tokens=getattr(usage, "prompt_tokens", None),
                    completion_tokens=getattr(usage, "completion_tokens", None),
                    finish_reason=finish_reason,
                )
            except Exception as exc:  # noqa: BLE001 - classified below
                last_exc = exc
                retryable = _is_retryable(exc)
                logger.warning(
                    "llm_call_failed provider=%s attempt=%d class=%s retryable=%s",
                    self.name,
                    attempt,
                    type(exc).__name__,
                    retryable,
                )
                if not retryable or attempt >= attempts:
                    break
                delay = min(base_wait * (2 ** (attempt - 1)), 8.0)
                hinted = _retry_after_seconds(exc)
                if hinted is not None:
                    delay = max(delay, min(hinted, 30.0))
                logger.info(
                    "llm_retry_wait provider=%s attempt=%d delay_seconds=%.2f",
                    self.name,
                    attempt,
                    delay,
                )
                time.sleep(delay)

        logger.warning(
            "llm_unavailable provider=%s class=%s",
            self.name,
            type(last_exc).__name__ if last_exc else "unknown",
        )
        raise DependencyUnavailable(
            "llm",
            detail=f"{self.name}:{type(last_exc).__name__ if last_exc else 'unknown'}",
        ) from last_exc


class LlmChain:
    """Ordered providers: first available success wins, last error surfaces.

    Providers without a usable API key are skipped at construction time, so a
    deployment with only ``GEMINI_API_KEY`` still serves answers.
    """

    def __init__(self, providers: Sequence[LlmProvider]) -> None:
        self._all = list(providers)
        self.providers = [provider for provider in providers if provider.available()]

    @property
    def available(self) -> bool:
        return bool(self.providers)

    @property
    def name(self) -> str:
        return "->".join(provider.name for provider in self.providers) or "none"

    def generate(
        self,
        messages: Sequence[LlmMessage],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> LlmResult:
        if not self.providers:
            raise DependencyUnavailable("llm", detail="no_provider")
        last: DependencyUnavailable | None = None
        for provider in self.providers:
            try:
                return provider.generate(
                    messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout,
                )
            except DependencyUnavailable as exc:
                last = exc
                logger.warning("llm_fallback_from provider=%s", provider.name)
                continue
        raise last or DependencyUnavailable("llm", detail="all_providers_failed")
