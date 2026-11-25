"""Re-index helper (plan Phase 4).

Rebuilds every point from the ``child_text`` already stored in its payload
using the CURRENT models, keeping the same point id and payload. This is the
repair path when ``DENSE_MODEL`` / ``SPARSE_MODEL`` / ``DENSE_DIM`` changes:
the startup model guard reports the mismatch and this tool fixes the vectors.

Only ids, counts and timings are printed/logged; never document text.
"""

from __future__ import annotations

import time
from typing import Any

from app.config import get_settings
from app.db import manifest
from app.services import vectorstore


def reindex_collection(
    *,
    embedder: Any,
    client: Any,
    collection_name: str,
    batch_size: int = 128,
    update_manifest: bool = True,
    manifest_engine: Any = None,
) -> dict[str, Any]:
    """Re-embed all points in one collection. Returns counts and timing."""
    started = time.perf_counter()
    offset: Any = None
    points = 0
    document_ids: set[str] = set()
    batches = 0

    while True:
        records, next_offset = client.scroll(
            collection_name=collection_name,
            scroll_filter=None,
            limit=batch_size,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        if not records:
            break
        valid = [
            record
            for record in records
            if isinstance(record.payload, dict) and record.payload.get("child_text")
        ]
        if valid:
            texts = [record.payload["child_text"] for record in valid]
            dense, sparse = embedder.embed_children(texts)
            rebuilt = [
                vectorstore.build_point(
                    str(record.id),
                    dense_vector,
                    indices,
                    values,
                    dict(record.payload),
                )
                for record, dense_vector, (indices, values) in zip(
                    valid, dense, sparse, strict=True
                )
            ]
            vectorstore.upsert_points(
                rebuilt, collection_name=collection_name, client=client
            )
            for record in valid:
                document_id = record.payload.get("document_id")
                if document_id:
                    document_ids.add(str(document_id))
            points += len(valid)
        batches += 1
        if next_offset is None or next_offset == offset:
            break
        offset = next_offset

    if update_manifest:
        settings = get_settings()
        for document_id in document_ids:
            manifest.update_models(
                document_id,
                settings.dense_model,
                settings.sparse_model,
                settings.dense_dim,
                engine=manifest_engine,
            )

    return {
        "points": points,
        "documents": len(document_ids),
        "batches": batches,
        "seconds": round(time.perf_counter() - started, 3),
    }
