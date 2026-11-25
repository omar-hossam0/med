"""Print the parents and children of one document for human review.

Usage (repository root):

    env/Scripts/python.exe scripts/dump_chunks.py [payload.json]

Without a file, the five-line lab sample from the plan is used. A JSON file
must contain a full IngestRequest payload (same shape as POST /rag/ingest).
No secrets are read or printed; all sample data is fictional.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

os.environ.setdefault("RAG_API_KEY", "phase3-dump")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("OPENROUTER_API_KEY", "phase3-dump")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover
    pass

from app.schemas.contract import IngestRequest  # noqa: E402
from app.services.chunking import chunk_document  # noqa: E402
from app.services.resolver import resolve_doc_date, resolve_doc_type  # noqa: E402

SAMPLE_LAB = {
    "patient_id": "sample_patient",
    "document_id": "sample_doc",
    "uploaded_at": "2026-10-24T10:30:00Z",
    "user_selected_type": "lab_result",
    "user_selected_date": None,
    "ocr_output": {
        "raw_text": (
            "Al-Borg Lab\n"
            "Date: 15/10/2026\n"
            "Renal Function:\n"
            "Creatinine: 1.8 mg/dL (0.6 - 1.2)\n"
            "Urea: 65 mg/dL (15 - 45)"
        ),
        "lines": [
            "Al-Borg Lab",
            "Date: 15/10/2026",
            "Renal Function:",
            "Creatinine: 1.8 mg/dL (0.6 - 1.2)",
            "Urea: 65 mg/dL (15 - 45)",
        ],
    },
}


def _load_payload(path: str | None) -> dict:
    if path is None:
        return SAMPLE_LAB
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def _resolve(request: IngestRequest) -> tuple[str, str]:
    data = request.session_report_data
    if data is not None:
        doc_type, _ = resolve_doc_type(
            request.user_selected_type, None, request.document_id
        )
        doc_date, _ = resolve_doc_date(
            user_selected_date=request.user_selected_date,
            extracted_date=None,
            raw_text="",
            uploaded_at=request.uploaded_at,
            is_session_report=True,
            consultation_date=data.consultation_date,
            approved_at=data.approved_at,
        )
        return doc_type, doc_date

    ocr = request.ocr_output
    assert ocr is not None
    doc_type, _ = resolve_doc_type(
        request.user_selected_type, ocr.detected_doc_type, request.document_id
    )
    doc_date, _ = resolve_doc_date(
        user_selected_date=request.user_selected_date,
        extracted_date=ocr.extracted_date,
        raw_text=ocr.raw_text,
        uploaded_at=request.uploaded_at,
        is_session_report=False,
    )
    return doc_type, doc_date


def main(argv: list[str]) -> int:
    if len(argv) > 2:
        print("usage: python scripts/dump_chunks.py [payload.json]")
        return 2
    payload = _load_payload(argv[1] if len(argv) == 2 else None)
    request = IngestRequest.model_validate(payload)
    doc_type, doc_date = _resolve(request)
    children = chunk_document(request, doc_type, doc_date)

    print(f"document_id : {request.document_id}")
    print(f"doc_type    : {doc_type}")
    print(f"doc_date    : {doc_date}")
    print(f"children    : {len(children)}")

    current_parent = None
    for child in children:
        if child.parent_id != current_parent:
            current_parent = child.parent_id
            print()
            print("=" * 78)
            print(f"parent_id   : {child.parent_id}")
            print("parent_text :")
            for line in child.parent_text.split("\n"):
                print(f"  | {line}")
            print("-" * 78)
        print(f"child[{child.child_index}] {child.child_text}")
        print(f"  raw_snippet: {child.raw_snippet!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
