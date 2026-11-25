"""Embedding-model consistency guard (plan Phase 4).

Documents and queries must use the same dense/sparse models and dimension.
Changing any of them requires a re-index. This module:

- asserts the loaded embedder dimension equals ``DENSE_DIM`` (fail fast);
- compares the Qdrant collection's dense size with ``DENSE_DIM``;
- compares every indexed manifest row's stored model signature with config.

The startup check returns a list of mismatch descriptions; the caller logs
them and refuses queries while the list is non-empty. Ingestion is still
allowed so a re-index can repair the data.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.config import get_settings
from app.db import manifest
from app.schemas.errors import ApiError
from app.services import vectorstore


class ModelMismatchError(RuntimeError):
    """The active models/dimension differ from what is stored/indexed."""


@dataclass(frozen=True)
class ModelSignature:
    dense_model: str
    sparse_model: str
    dense_dim: int


def current_signature() -> ModelSignature:
    settings = get_settings()
    return ModelSignature(
        dense_model=settings.dense_model,
        sparse_model=settings.sparse_model,
        dense_dim=settings.dense_dim,
    )


def assert_embedder_dimension(embedder: Any) -> int:
    expected = get_settings().dense_dim
    actual = int(embedder.dense_dim)
    if actual != expected:
        raise ModelMismatchError(
            f"loaded dense dimension {actual} != DENSE_DIM {expected}; "
            "change DENSE_DIM or the model, then re-index"
        )
    return actual


def manifest_mismatches(engine: Any = None) -> list[dict[str, Any]]:
    """Indexed rows whose stored model signature differs from config."""
    signature = current_signature()
    mismatches: list[dict[str, Any]] = []
    for row in manifest.indexed_model_rows(engine=engine):
        if (
            row["dense_model"] != signature.dense_model
            or row["sparse_model"] != signature.sparse_model
            or row["dense_dim"] != signature.dense_dim
        ):
            mismatches.append(row)
    return mismatches


def assert_manifest_consistent(engine: Any = None) -> None:
    mismatches = manifest_mismatches(engine=engine)
    if mismatches:
        raise ModelMismatchError(
            f"{len(mismatches)} indexed document(s) use a different model "
            "signature; re-index required"
        )


def collection_mismatch(
    client: Any = None, collection_name: str | None = None
) -> dict[str, int] | None:
    """Return {'collection_dim','expected'} when the collection size differs.

    A missing/unreachable collection is not a model mismatch (it may simply
    not exist yet); those errors are swallowed here and surfaced by the
    normal dependency path when ingestion runs.
    """
    try:
        actual = vectorstore.collection_dim(
            collection_name=collection_name, client=client
        )
    except ApiError:
        return None
    if actual is None:
        return None
    expected = get_settings().dense_dim
    if actual != expected:
        return {"collection_dim": actual, "expected": expected}
    return None


def startup_check(
    embedder: Any, client: Any = None, collection_name: str | None = None
) -> list[str]:
    """Fail fast on an embedder/config mismatch; report the rest as strings."""
    assert_embedder_dimension(embedder)
    problems: list[str] = []
    collection = collection_mismatch(client=client, collection_name=collection_name)
    if collection:
        problems.append(
            "collection_dense_dim="
            f"{collection['collection_dim']} expected={collection['expected']}"
        )
    mismatched_rows = manifest_mismatches()
    if mismatched_rows:
        problems.append(f"manifest_model_mismatch documents={len(mismatched_rows)}")
    return problems
