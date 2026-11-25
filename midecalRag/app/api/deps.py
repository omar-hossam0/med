"""Shared API dependencies.

- ``require_api_key`` protects every endpoint except GET /health.
- ``require_model_ready`` refuses ingest/query while the Phase 4 model guard
  reports a mismatch (the manifest or collection was built with other models).
"""

import secrets

from fastapi import Header, Request

from app.config import get_settings
from app.schemas.errors import model_mismatch, unauthorized


async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    # Bytes form: compare_digest rejects non-ASCII str input, and header
    # values are latin-1 decoded, so encode both sides first.
    expected = settings.rag_api_key.get_secret_value().encode("utf-8")
    provided = (x_api_key or "").encode("utf-8")
    if not expected or not secrets.compare_digest(provided, expected):
        raise unauthorized()


async def require_model_ready(request: Request) -> None:
    """Block ingest and query when the startup model guard failed.

    ``None`` means the guard did not run (e.g. warm-up disabled); that is not a
    mismatch and does not block. ``False`` means indexed data uses different
    models and requires a re-index first.
    """
    if getattr(request.app.state, "model_guard_ok", None) is False:
        raise model_mismatch()
