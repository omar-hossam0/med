"""Manifest / audit database (plan Phase 2). SQLite for the MVP.

Only app.config touches the environment; the engine is built from
``Settings.db_url`` once and reused. Tests may call :func:`reset_engine`
after pointing DB_URL elsewhere, or pass an explicit engine to manifest
functions.
"""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session

_engine = None


class Base(DeclarativeBase):
    pass


def get_engine():
    """Build the engine lazily from settings and create all tables."""
    global _engine
    if _engine is None:
        from app.config import get_settings

        settings = get_settings()
        kwargs = {}
        if settings.db_url.startswith("sqlite"):
            # Background tasks may run in worker threads.
            kwargs["connect_args"] = {"check_same_thread": False}
        _engine = create_engine(settings.db_url, **kwargs)
        from app.db import models  # noqa: F401 - register table mappings

        Base.metadata.create_all(_engine)
        _ensure_sqlite_columns(_engine)
    return _engine


def _ensure_sqlite_columns(engine) -> None:
    """Additive migration for the dev SQLite manifest.

    Phase 4 adds ``dense_dim``. ``create_all`` does not alter an existing
    table, so a dev database created in Phase 2 needs one ALTER. Production
    PostgreSQL will get a real migration in the deployment phase.
    """
    if not str(engine.url).startswith("sqlite"):
        return
    with engine.begin() as conn:
        columns = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(documents)")}
        if columns and "dense_dim" not in columns:
            conn.exec_driver_sql("ALTER TABLE documents ADD COLUMN dense_dim INTEGER")


def reset_engine() -> None:
    """Drop the cached engine (tests only)."""
    global _engine
    _engine = None


def open_session(engine=None) -> Session:
    return Session(bind=engine or get_engine(), expire_on_commit=False)
