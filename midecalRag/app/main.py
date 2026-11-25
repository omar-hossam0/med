"""FastAPI application factory: middleware, exception handlers, routers."""

import asyncio
import logging
import time
import uuid
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.api import health, routes
from app.config import get_settings, warn_if_llm_key_missing
from app.logging_config import configure_logging, request_id_var
from app.schemas.errors import ApiError

logger = logging.getLogger(__name__)

#: Zero-build developer test UI (static HTML/CSS/JS). Served unauthenticated as
#: a page, but every API call it makes still needs X-API-Key.
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def _lifespan(app: FastAPI):
    settings = get_settings()
    app.state.embedder_ready = False
    app.state.collection_ready = False
    app.state.model_guard_ok = None
    app.state.model_guard_problems = []

    # Startup recovery (plan P13): ingest rows stuck in processing (e.g. the
    # process died mid-job) are marked failed; the Backend can re-send them.
    try:
        from app.db.manifest import recover_stuck

        recovered = recover_stuck(settings.recovery_stale_seconds)
        if recovered:
            logger.info("startup_recovery rows_recovered=%d", recovered)
    except Exception:
        logger.exception("startup_recovery_failed")

    # Phase 4: load FastEmbed once at startup (off the event loop) so the
    # first ingest/query does not pay the cold-start cost.
    if settings.embed_warmup_on_startup:
        from app.services.embedder import EmbedderDimensionError, get_embedder

        try:
            metrics = await asyncio.to_thread(get_embedder().warmup)
            app.state.embedder_ready = True
            logger.info(
                "embedder_ready dense_dim=%d load_seconds=%.3f",
                metrics["dense_dim"],
                metrics["load_seconds"],
            )
        except EmbedderDimensionError:
            logger.error("embedder_dimension_mismatch")
            raise
        except Exception as exc:  # model download/ONNX failure: keep serving
            logger.error("embedder_warmup_failed class=%s", type(exc).__name__)

        if app.state.embedder_ready:
            # Indexing target must exist (and have the configured dense size)
            # before the first ingest; a Qdrant outage must not stop /health.
            from app.services import vectorstore

            try:
                created = vectorstore.ensure_collection()
                app.state.collection_ready = True
                logger.info(
                    "collection_ready name=%s date_index=%s",
                    created["collection"],
                    created["date_index"],
                )
            except Exception as exc:
                logger.warning(
                    "collection_ensure_failed class=%s", type(exc).__name__
                )

            from app.services.model_guard import ModelMismatchError, startup_check

            try:
                problems = startup_check(get_embedder())
                app.state.model_guard_problems = problems
                app.state.model_guard_ok = not problems
                if problems:
                    logger.error("model_guard_mismatch count=%d", len(problems))
                else:
                    logger.info("model_guard_ok")
            except ModelMismatchError:
                logger.error("embedder_dimension_mismatch")
                raise
            except Exception as exc:
                logger.warning(
                    "model_guard_check_failed class=%s", type(exc).__name__
                )
    else:
        logger.info("embedder_warmup_skipped")

    yield


def _sanitize_request_id(value: str | None) -> str | None:
    """Accept only short printable-ASCII ids so a hostile header value can
    never leak control characters into logs or the response header."""
    if not value:
        return None
    value = value.strip()
    if not value or len(value) > 128 or any(not (0x21 <= ord(c) <= 0x7E) for c in value):
        return None
    return value


def _current_request_id(request: Request) -> str | None:
    # request.state survives into the outermost catch-all handler even after
    # the middleware has reset the contextvar.
    return getattr(request.state, "request_id", None) or request_id_var.get()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    warn_if_llm_key_missing(settings)

    app = FastAPI(title="CareOS Medical RAG Service", version="0.1.0", lifespan=_lifespan)

    @app.middleware("http")
    async def request_context_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = _sanitize_request_id(request.headers.get("x-request-id")) or uuid.uuid4().hex
        request.state.request_id = request_id
        token = request_id_var.set(request_id)
        started = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            # ids/status/timing only: never log query strings, bodies or headers
            logger.info(
                "http_request",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                    "request_id": request_id,
                },
            )
            request_id_var.reset(token)

    async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code, content=exc.to_body(), headers=exc.headers or None
        )

    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        try:
            raw_errors = exc.errors(include_url=False)
        except TypeError:
            # FastAPI's RequestValidationError.errors() takes no kwargs in
            # some versions; plain errors() is fine because only the keys
            # below are ever read.
            raw_errors = exc.errors()
        parts = []
        for error in raw_errors:
            loc = ".".join(str(part) for part in error.get("loc", ()))
            parts.append(f"{loc}: {error.get('type', 'unknown')}: {error.get('msg', '')}")
        # Built ONLY from loc/type/msg. The 'input' and 'ctx' payloads of
        # pydantic errors can carry patient text and must never be included.
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "invalid_request", "message": "; ".join(parts)}},
        )

    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "unhandled_exception",
            extra={
                "exception_class": type(exc).__name__,
                "request_id": _current_request_id(request),
            },
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": {"code": "internal_error", "message": "Internal server error."}
            },
        )

    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)

    app.include_router(health.router)
    app.include_router(routes.router)

    # Phase 10 (dev tooling): the zero-build test UI. Mounted outside the API
    # router, so the page itself needs no key while every request it makes does.
    if STATIC_DIR.is_dir():
        @app.get("/ui", include_in_schema=False)
        async def _ui_index_redirect() -> RedirectResponse:
            return RedirectResponse(url="/ui/")

        app.mount("/ui", StaticFiles(directory=str(STATIC_DIR), html=True), name="test-ui")
        logger.info("test_ui_mounted path=/ui")
    else:
        logger.info("test_ui_skipped reason=no_static_dir")

    # Phase 9: the service is internal, so CORS stays closed unless an origin is
    # configured. Added last so it wraps every other middleware (preflight is
    # answered before auth).
    origins = settings.cors_allowed_origins
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=False,
            allow_methods=["GET", "POST"],
            allow_headers=["X-API-Key", "X-Request-ID", "Content-Type"],
            expose_headers=["X-Request-ID", "Retry-After"],
            max_age=600,
        )
        logger.info("cors_enabled origins=%d", len(origins))
    else:
        logger.info("cors_disabled")

    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)
