"""JSON logging on the stdlib logging module (no extra dependencies).

One line per record, serialized with json.dumps, keys:
``ts`` (ISO8601 UTC), ``level``, ``event`` (the record message),
``request_id`` (from the contextvar, may be null) plus any record extra
fields.

Safety rule: never log bodies, questions, answers or headers. The request
middleware only ever logs method, path, status_code, duration_ms,
request_id.
"""

import contextvars
import json
import logging
from datetime import UTC, datetime
from typing import Any

# Per-request correlation id; set by the middleware in app.main.
request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id", default=None
)

# Standard LogRecord attributes; anything else in __dict__ came from `extra=`.
_RESERVED_LOG_RECORD_KEYS = frozenset(
    {
        "name",
        "msg",
        "args",
        "levelname",
        "levelno",
        "pathname",
        "filename",
        "module",
        "exc_info",
        "exc_text",
        "stack_info",
        "lineno",
        "funcName",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "processName",
        "process",
        "taskName",
        "message",
        "asctime",
    }
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "level": record.levelname,
            "event": record.getMessage(),
        }
        # Extra fields win over the contextvar so both middleware and
        # exception-handler log lines carry the same request id.
        payload["request_id"] = record.__dict__.get(
            "request_id", request_id_var.get()
        )
        for key, value in record.__dict__.items():
            if key in _RESERVED_LOG_RECORD_KEYS or key == "request_id":
                continue
            payload[key] = value
        if record.exc_info:
            payload["exception_class"] = (
                record.exc_info[0].__name__ if record.exc_info[0] else None
            )
            payload["traceback"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging(level: str = "INFO") -> None:
    """Install the JSON formatter on the root logger (idempotent)."""
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    try:
        root.setLevel(level.upper())
    except ValueError:
        root.setLevel(logging.INFO)
    # uvicorn's access log would duplicate request lines and can include the
    # query string; our middleware is the single, sanitized request logger.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
