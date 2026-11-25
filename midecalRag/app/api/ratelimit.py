"""In-memory rate limiting (plan Phase 9, P16 hardening).

A sliding-window counter per ``(api key, client host)`` bucket. It is
deliberately in-memory: the service runs as a single process, and a shared
store would add a dependency the deployment does not need yet. Documented
consequence: with one API key and one calling host the bucket is effectively
global, which is the intended protection for the LLM budget.

``RATE_LIMIT_PER_MINUTE=0`` disables the limiter (used by unit tests and by
deployments that rate-limit at the gateway).
"""

from __future__ import annotations

import hashlib
import threading
import time
from collections import deque
from collections.abc import Callable

from fastapi import Header, Request

from app.config import get_settings
from app.schemas.errors import rate_limited


class RateLimiter:
    """Thread-safe sliding-window limiter (one window, N requests)."""

    def __init__(
        self,
        limit_per_minute: int,
        window_seconds: float = 60.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._limit = max(0, int(limit_per_minute))
        self._window = float(window_seconds)
        self._clock = clock
        self._lock = threading.Lock()
        self._hits: dict[str, deque[float]] = {}

    @property
    def limit(self) -> int:
        return self._limit

    @property
    def enabled(self) -> bool:
        return self._limit > 0

    def check(self, key: str) -> tuple[bool, float]:
        """Return ``(allowed, retry_after_seconds)`` and count the request."""
        if not self.enabled:
            return True, 0.0
        now = self._clock()
        cutoff = now - self._window
        with self._lock:
            bucket = self._hits.setdefault(key, deque())
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= self._limit:
                return False, max(0.0, bucket[0] + self._window - now)
            bucket.append(now)
            return True, 0.0

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()

    def tracked_buckets(self) -> int:
        with self._lock:
            return len(self._hits)


_limiter: RateLimiter | None = None


def get_limiter() -> RateLimiter:
    global _limiter
    if _limiter is None:
        _limiter = RateLimiter(get_settings().rate_limit_per_minute)
    return _limiter


def reset_limiter(limiter: RateLimiter | None = None) -> None:
    """Replace the process limiter (tests) or rebuild it from settings."""
    global _limiter
    _limiter = limiter


def bucket_key(api_key: str | None, host: str | None) -> str:
    """Hash the key: the bucket map must never hold the secret itself."""
    digest = hashlib.sha256((api_key or "").encode("utf-8")).hexdigest()[:16]
    return f"{digest}:{host or 'unknown'}"


async def require_rate_limit(
    request: Request, x_api_key: str | None = Header(default=None)
) -> None:
    """FastAPI dependency: 429 with ``Retry-After`` once the window is full."""
    limiter = get_limiter()
    host = request.client.host if request.client else None
    allowed, retry_after = limiter.check(bucket_key(x_api_key, host))
    if not allowed:
        raise rate_limited(retry_after)
