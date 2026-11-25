"""Shared error model. Every error leaves the service as
``{"error": {"code": "<snake_case>", "message": "<text>"}}``.
"""

_STATUS_BAD_REQUEST = 400
_STATUS_UNAUTHORIZED = 401
_STATUS_NOT_IMPLEMENTED = 501
_STATUS_DEPENDENCY_UNAVAILABLE = 503
_STATUS_TEXT_TOO_LARGE = 413
_STATUS_TOO_MANY_REQUESTS = 429


class ApiError(Exception):
    """Raise anywhere; the app-level handler turns it into status + body."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        #: Extra response headers (e.g. Retry-After on 429). Never contains PII.
        self.headers = headers or {}

    def to_body(self) -> dict[str, dict[str, str]]:
        return {"error": {"code": self.code, "message": self.message}}


def invalid_request(message: str = "The request payload is invalid.") -> ApiError:
    return ApiError(_STATUS_BAD_REQUEST, "invalid_request", message)


def unauthorized() -> ApiError:
    return ApiError(
        _STATUS_UNAUTHORIZED, "unauthorized", "A valid X-API-Key header is required."
    )


def empty_text(message: str = "Text fields must contain non-whitespace text.") -> ApiError:
    return ApiError(_STATUS_BAD_REQUEST, "empty_text", message)


def text_too_large() -> ApiError:
    return ApiError(
        _STATUS_TEXT_TOO_LARGE,
        "text_too_large",
        "The document text exceeds MAX_TEXT_CHARS.",
    )


def not_implemented(endpoint: str) -> ApiError:
    return ApiError(
        _STATUS_NOT_IMPLEMENTED, "not_implemented", f"{endpoint} is not implemented yet"
    )


def dependency_unavailable(dep: str) -> ApiError:
    return ApiError(
        _STATUS_DEPENDENCY_UNAVAILABLE,
        "dependency_unavailable",
        f"The '{dep}' dependency is currently unavailable.",
    )


def model_mismatch() -> ApiError:
    """Active embedding models/dimension differ from indexed data (Phase 4)."""
    return ApiError(
        _STATUS_DEPENDENCY_UNAVAILABLE,
        "model_mismatch",
        "Embedding model configuration changed; re-index and restart before serving requests.",
    )


def rate_limited(retry_after_seconds: float) -> ApiError:
    """Too many requests (Phase 9). ``Retry-After`` tells the caller when to retry."""
    retry_after = max(1, int(round(retry_after_seconds)))
    return ApiError(
        _STATUS_TOO_MANY_REQUESTS,
        "rate_limited",
        f"Too many requests; retry after {retry_after} seconds.",
        headers={"Retry-After": str(retry_after)},
    )


class DependencyUnavailable(ApiError):
    """A backing dependency (Qdrant, later the LLM) failed.

    Maps to HTTP 503 with the standard error body through the app-level
    ApiError handler. ``detail`` carries the exception class name for logs
    only and is never returned to clients.
    """

    def __init__(self, dependency: str, detail: str | None = None) -> None:
        super().__init__(
            _STATUS_DEPENDENCY_UNAVAILABLE,
            "dependency_unavailable",
            f"The '{dependency}' dependency is currently unavailable.",
        )
        self.dependency = dependency
        self.detail = detail
