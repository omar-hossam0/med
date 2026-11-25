"""Phase 2 unit tests: resolver, manifest, pipeline (no network, no Qdrant).

Live integration lives in scripts/verify_phase_2.py. All fixture data is
fictional.
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import create_engine

from app.db import Base, manifest
from app.db.models import Document, utcnow_naive
from app.schemas.contract import IngestRequest
from app.schemas.errors import DependencyUnavailable
from app.services.ingest_pipeline import Child, IngestPipeline, process_document
from app.services.resolver import parse_date_string, resolve_doc_date, resolve_doc_type

TODAY = date(2026, 10, 29)


def _engine(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path}/m.db", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    return engine


def _ocr_request(**overrides):
    payload = {
        "patient_id": "p_1",
        "document_id": "doc_1",
        "uploaded_at": "2026-10-24T10:30:00Z",
        "user_selected_type": "lab_result",
        "user_selected_date": None,
        "ocr_output": {
            "raw_text": "Creatinine: 1.8 mg/dL (0.6 - 1.2)",
            "lines": ["Creatinine: 1.8 mg/dL (0.6 - 1.2)"],
            "detected_doc_type": None,
            "extracted_date": None,
        },
    }
    payload.update(overrides)
    return IngestRequest.model_validate(payload)


# ---------------------------------------------------------------------------
# Date resolution table (plan Section E, check 1)
# ---------------------------------------------------------------------------


def _resolve(**kwargs):
    base = dict(
        user_selected_date=None,
        extracted_date=None,
        raw_text="",
        uploaded_at=datetime(2026, 10, 24, 10, 30, tzinfo=UTC),
        is_session_report=False,
        today=TODAY,
    )
    base.update(kwargs)
    return resolve_doc_date(**base)


def test_user_date_wins():
    doc_date, source = _resolve(
        user_selected_date=date(2026, 1, 5), extracted_date="2026-10-15"
    )
    assert (doc_date, source) == ("2026-01-05", "user")


def test_ocr_date_when_user_date_null():
    doc_date, source = _resolve(extracted_date="2026-10-15")
    assert (doc_date, source) == ("2026-10-15", "ocr")


def test_text_iso_date_when_both_null():
    doc_date, source = _resolve(raw_text="Report\nDate: 2026-03-08\n...")
    assert (doc_date, source) == ("2026-03-08", "text")


def test_text_slash_date_day_first():
    doc_date, source = _resolve(raw_text="Date: 15/10/2026")
    assert (doc_date, source) == ("2026-10-15", "text")


def test_text_ambiguous_marks_source():
    doc_date, source = _resolve(raw_text="Visit 03/04/2026")
    assert doc_date == "2026-04-03"  # day-first assumption
    assert source == "text_ambiguous"


def test_sample_date_preferred_over_report_date():
    doc_date, _ = _resolve(
        raw_text="Report printed 2026-09-30\nSample collected: 2026-09-01"
    )
    assert doc_date == "2026-09-01"


def test_upload_date_last_resort():
    doc_date, source = _resolve()
    assert (doc_date, source) == ("2026-10-24", "upload")


def test_future_ocr_date_ignored():
    doc_date, source = _resolve(extracted_date="2027-01-01")
    assert source == "upload"  # future date skipped


def test_future_text_date_ignored():
    doc_date, source = _resolve(raw_text="Taken 2027-06-01 somewhere")
    assert source == "upload"


def test_garbage_date_ignored():
    doc_date, source = _resolve(extracted_date="not a date at all", raw_text="no dates here")
    assert source == "upload"


def test_dates_before_1900_ignored():
    doc_date, source = _resolve(raw_text="Archived 1899-12-01")
    assert source == "upload"


def test_parse_date_string_cases():
    assert parse_date_string("2026-10-15") == (date(2026, 10, 15), False)
    assert parse_date_string("15/10/2026") == (date(2026, 10, 15), False)
    assert parse_date_string("03/04/2026") == (date(2026, 4, 3), True)
    assert parse_date_string("garbage") is None


# ---------------------------------------------------------------------------
# Session-report date branch (D30)
# ---------------------------------------------------------------------------


def test_session_consultation_date_wins_over_upload():
    doc_date, source = _resolve(
        is_session_report=True,
        consultation_date="2026-10-20",
        raw_text="nothing",
    )
    assert (doc_date, source) == ("2026-10-20", "consultation")


def test_session_approved_at_converts_to_cairo_date():
    # 2026-10-23T22:30:00Z -> 2026-10-24 in Africa/Cairo (plan fixture)
    doc_date, source = _resolve(
        is_session_report=True,
        approved_at=datetime(2026, 10, 23, 22, 30, tzinfo=UTC),
    )
    assert (doc_date, source) == ("2026-10-24", "approval")


def test_session_upload_fallback_flagged_approval_time():
    doc_date, source = _resolve(is_session_report=True)
    assert (doc_date, source) == ("2026-10-24", "approval_time")


def test_session_report_never_parses_text_dates():
    doc_date, source = _resolve(
        is_session_report=True, raw_text="Mentioned 2020-01-01 in narrative"
    )
    assert (doc_date, source) == ("2026-10-24", "approval_time")


# ---------------------------------------------------------------------------
# Type resolution
# ---------------------------------------------------------------------------


def test_user_type_wins_and_mismatch_logged(caplog):
    with caplog.at_level(logging.INFO):
        doc_type, mismatch = resolve_doc_type(
            "lab_result", "prescription", document_id="doc_x"
        )
    assert doc_type == "lab_result" and mismatch is True
    joined = caplog.text
    assert "doc_type_mismatch" in joined and "doc_x" in joined
    assert "Creatinine" not in joined  # ids only, never text


def test_invalid_ocr_type_ignored():
    doc_type, mismatch = resolve_doc_type("lab_result", "unknown_kind")
    assert doc_type == "lab_result" and mismatch is False


# ---------------------------------------------------------------------------
# Manifest + pipeline (fake store, no Qdrant)
# ---------------------------------------------------------------------------


class Recorder:
    def __init__(self):
        self.upserts: list[list] = []
        self.deletes: list[dict] = []

    def upsert(self, points, collection_name=None, client=None):
        self.upserts.append(points)

    def delete(self, document_id, keep_version=None, collection_name=None, client=None):
        self.deletes.append({"document_id": document_id, "keep_version": keep_version})


def _fake_pipeline(children_per_call: list[int], fail_embed_on_call: int | None = None):
    state = {"call": 0}

    def chunk(request, doc_type, doc_date):
        n = children_per_call[min(state["call"], len(children_per_call) - 1)]
        return [
            Child(
                child_text=f"child {i}",
                raw_snippet=f"child {i}",
                parent_text="parent",
                parent_id=f"{request.document_id}#p0",
                child_index=i,
            )
            for i in range(n)
        ]

    def embed(texts):
        state["call"] += 1
        if fail_embed_on_call is not None and state["call"] == fail_embed_on_call:
            raise RuntimeError("boom")
        return [[0.1] * 4 for _ in texts], [([1], [1.0]) for _ in texts]

    return IngestPipeline(chunk=chunk, embed=embed)


def test_pipeline_happy_path_and_exact_payload_keys(tmp_path):
    engine = _engine(tmp_path)
    rec = Recorder()
    request = _ocr_request()
    process_document(
        request, "lab_result", "2026-10-24", "upload",
        version="vA", pipeline=_fake_pipeline([3]), engine=engine,
        upsert_fn=rec.upsert, delete_fn=rec.delete,
    )
    row = manifest.get_document("doc_1", engine=engine)
    assert row.status == "indexed" and row.child_count == 3 and row.version == "vA"
    points = rec.upserts[0]
    assert len(points) == 3
    expected_keys = {
        "patient_id", "document_id", "parent_id", "doc_type", "doc_date",
        "child_text", "raw_snippet", "parent_text", "version", "child_index",
    }
    for point in points:
        assert set(point.payload.keys()) == expected_keys
        assert point.payload["version"] == "vA"
    # replacement ran AFTER the upsert, keeping only the new version
    assert rec.deletes == [{"document_id": "doc_1", "keep_version": "vA"}]


def test_pipeline_failure_keeps_old_version(tmp_path):
    engine = _engine(tmp_path)
    rec = Recorder()
    request = _ocr_request()
    process_document(
        request, "lab_result", "2026-10-24", "upload",
        version="v1", pipeline=_fake_pipeline([2]), engine=engine,
        upsert_fn=rec.upsert, delete_fn=rec.delete,
    )
    assert manifest.get_document("doc_1", engine=engine).status == "indexed"

    failing = _fake_pipeline([9], fail_embed_on_call=1)
    process_document(
        request, "lab_result", "2026-10-24", "upload",
        version="v2", pipeline=failing, engine=engine,
        upsert_fn=rec.upsert, delete_fn=rec.delete,
    )
    row = manifest.get_document("doc_1", engine=engine)
    assert row.status == "failed" and row.error_code == "ingest_failed"
    # old version still "searchable": nothing new upserted, nothing deleted
    assert len(rec.upserts) == 1  # only the first (successful) call
    assert rec.deletes == [{"document_id": "doc_1", "keep_version": "v1"}]


def test_pipeline_dependency_failure_short_code(tmp_path):
    engine = _engine(tmp_path)

    def embed(texts):
        raise DependencyUnavailable("qdrant")

    pipeline = IngestPipeline(
        chunk=lambda r, t, d: [Child("c", "c", "p", "p#0", 0)], embed=embed
    )
    process_document(
        _ocr_request(), "lab_result", "2026-10-24", "upload",
        version="v1", pipeline=pipeline, engine=engine,
        upsert_fn=Recorder().upsert, delete_fn=Recorder().delete,
    )
    row = manifest.get_document("doc_1", engine=engine)
    assert row.status == "failed" and row.error_code == "dependency_unavailable"


def test_concurrent_ingests_end_on_one_version(tmp_path):
    import threading

    engine = _engine(tmp_path)
    rec = Recorder()
    request = _ocr_request()
    manifest.create_processing(
        document_id="doc_1", patient_id="p_1", version="v1", doc_type="lab_result",
        doc_date="2026-10-24", date_source="upload", upload_date="2026-10-24T10:30:00+00:00",
        source="ocr", engine=engine,
    )
    versions = ["v1", "v2"]
    threads = [
        threading.Thread(
            target=process_document,
            kwargs={
                "request": request,
                "doc_type": "lab_result",
                "doc_date": "2026-10-24",
                "date_source": "upload",
                "version": v,
                "pipeline": _fake_pipeline([4]),
                "engine": engine,
                "upsert_fn": rec.upsert,
                "delete_fn": rec.delete,
            },
        )
        for v in versions
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    row = manifest.get_document("doc_1", engine=engine)
    assert row.status == "indexed"
    # every recorded delete kept exactly the version being processed
    assert all(d["keep_version"] in versions for d in rec.deletes)
    # the last delete corresponds to the final manifest version
    assert rec.deletes[-1]["keep_version"] == row.version


def test_recover_stuck_marks_only_old_rows(tmp_path):
    engine = _engine(tmp_path)
    manifest.create_processing(
        document_id="doc_old", patient_id="p", version="v", doc_type="lab_result",
        doc_date="2026-01-01", date_source="upload", upload_date="x", source="ocr",
        engine=engine,
    )
    manifest.create_processing(
        document_id="doc_fresh", patient_id="p", version="v", doc_type="lab_result",
        doc_date="2026-01-01", date_source="upload", upload_date="x", source="ocr",
        engine=engine,
    )
    with engine.begin() as conn:
        old_cutoff = utcnow_naive() - timedelta(hours=2)
        conn.execute(
            Document.__table__.update()
            .where(Document.__table__.c.document_id == "doc_old")
            .values(updated_at=old_cutoff)
        )
    recovered = manifest.recover_stuck(600, engine=engine)
    assert recovered == 1
    assert manifest.get_document("doc_old", engine=engine).status == "failed"
    assert manifest.get_document("doc_old", engine=engine).error_code == "stale_processing"
    assert manifest.get_document("doc_fresh", engine=engine).status == "processing"
