"""Zero-PII audit trail (plan Phase 9, P16).

Every protected request appends one JSON line to ``AUDIT_LOG_PATH`` with:

    timestamp, request_id, endpoint, patient_id_hash, status, latency_ms,
    source_count, mode, result_type

**Never** written: the doctor's question, the answer, document text, the raw
``patient_id``, or the API key. The patient identifier is hashed with
``AUDIT_HASH_SALT`` (SHA-256, first 32 hex chars) so the same patient can be
correlated across requests without storing an identifier. When the salt is
empty a random per-process salt is generated and a warning is logged - hashes
are then not comparable across restarts, which is safer than a fixed default.

A failed audit write must never break a clinical request: errors are logged
(class only) and swallowed.
"""

from __future__ import annotations

import hashlib
import json
import logging
import secrets
import threading
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AuditRecord:
    """One audit line. Field names are part of the operational contract."""

    timestamp: str
    request_id: str
    endpoint: str
    patient_id_hash: str
    status: int
    latency_ms: float
    source_count: int = 0
    mode: str | None = None
    result_type: str | None = None

    def to_json(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False, separators=(",", ":"))


class AuditLogger:
    """Thread-safe JSONL writer (one line per request, append-only)."""

    def __init__(
        self,
        path: str | Path,
        salt: str,
        *,
        enabled: bool = True,
        clock=None,
    ) -> None:
        self._path = Path(path)
        self._salt = salt or secrets.token_hex(16)
        self._enabled = bool(enabled)
        self._lock = threading.Lock()
        self._clock = clock or (lambda: datetime.now(UTC))
        if not salt:
            logger.warning(
                "audit_salt_missing using a random per-process salt; "
                "set AUDIT_HASH_SALT so hashes stay comparable across restarts"
            )

    @property
    def enabled(self) -> bool:
        return self._enabled

    @property
    def path(self) -> Path:
        return self._path

    def hash_patient(self, patient_id: str) -> str:
        material = f"{self._salt}:{patient_id}".encode()
        return hashlib.sha256(material).hexdigest()[:32]

    def build(
        self,
        *,
        request_id: str,
        endpoint: str,
        patient_id: str,
        status: int,
        latency_ms: float,
        source_count: int = 0,
        mode: str | None = None,
        result_type: str | None = None,
    ) -> AuditRecord:
        stamp = self._clock()
        return AuditRecord(
            timestamp=stamp.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            request_id=request_id or "",
            endpoint=endpoint,
            patient_id_hash=self.hash_patient(patient_id or ""),
            status=int(status),
            latency_ms=round(float(latency_ms), 2),
            source_count=int(source_count),
            mode=mode,
            result_type=result_type,
        )

    def write(self, record: AuditRecord) -> None:
        if not self._enabled:
            return
        line = record.to_json()
        try:
            with self._lock:
                self._path.parent.mkdir(parents=True, exist_ok=True)
                with self._path.open("a", encoding="utf-8") as handle:
                    handle.write(line + "\n")
        except OSError as exc:
            # Never break a clinical request because the audit file is missing.
            logger.warning("audit_write_failed class=%s", type(exc).__name__)

    def record(self, **kwargs: Any) -> None:
        self.write(self.build(**kwargs))


_audit: AuditLogger | None = None


def get_audit_logger() -> AuditLogger:
    global _audit
    if _audit is None:
        settings = get_settings()
        _audit = AuditLogger(
            settings.audit_log_path,
            settings.audit_hash_salt.get_secret_value(),
            enabled=settings.audit_enabled,
        )
    return _audit


def reset_audit_logger(audit: AuditLogger | None = None) -> None:
    global _audit
    _audit = audit
