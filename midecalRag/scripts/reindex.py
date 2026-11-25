"""Re-index CLI (plan Phase 4): rebuild vectors from stored child_text.

Run from the repository root after changing DENSE_MODEL / SPARSE_MODEL /
DENSE_DIM (the startup model guard refuses ingest/query until this runs):

    env/Scripts/python.exe scripts/reindex.py
    env/Scripts/python.exe scripts/reindex.py --collection careos_medical_records

Only ids, counts and timings are printed; document text never is.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover
    pass

from app.config import get_settings  # noqa: E402
from app.services.embedder import get_embedder  # noqa: E402
from app.services.reindexer import reindex_collection  # noqa: E402
from app.services.vectorstore import get_client  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    settings = get_settings()
    parser = argparse.ArgumentParser(description="Re-embed every point in a collection.")
    parser.add_argument(
        "--collection",
        default=settings.collection_name,
        help="Collection to rebuild (default: COLLECTION_NAME).",
    )
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument(
        "--no-manifest",
        action="store_true",
        help="Do not update the manifest model signature after re-indexing.",
    )
    args = parser.parse_args(argv)

    embedder = get_embedder()
    embedder.load()
    client = get_client()
    try:
        summary = reindex_collection(
            embedder=embedder,
            client=client,
            collection_name=args.collection,
            batch_size=max(1, args.batch_size),
            update_manifest=not args.no_manifest,
        )
    finally:
        try:
            client.close()
        except Exception:  # noqa: BLE001
            pass

    summary["collection"] = args.collection
    summary["dense_model"] = settings.dense_model
    summary["sparse_model"] = settings.sparse_model
    summary["dense_dim"] = settings.dense_dim
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
