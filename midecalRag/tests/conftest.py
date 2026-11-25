"""Global test-environment guard.

Runs BEFORE any test module imports the app, so pydantic-settings picks these
up (real environment variables beat the .env file). Effect: pytest never
touches the real Qdrant collection or the real manifest database, and HTTP
ingest tests schedule background work against throwaway targets only.
"""

import os
import tempfile

os.environ.setdefault("COLLECTION_NAME", "careos_pytest_test")
os.environ.setdefault(
    "DB_URL", "sqlite:///" + tempfile.gettempdir().replace("\\", "/") + "/careos_pytest_manifest.db"
)
os.environ.setdefault("MAX_TEXT_CHARS", "2000")
# Phase 4: unit tests use fake embedders; never load FastEmbed models on the
# TestClient lifespan (Phase 4's verify script exercises the real warm-up).
os.environ.setdefault("EMBED_WARMUP_ON_STARTUP", "false")
# Phase 9: the rate limiter and the audit trail are exercised explicitly by
# their own tests; the global defaults must not interfere with other suites and
# must never write into the repository.
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "0")
os.environ.setdefault(
    "AUDIT_LOG_PATH",
    tempfile.gettempdir().replace("\\", "/") + "/careos_pytest_audit.jsonl",
)
