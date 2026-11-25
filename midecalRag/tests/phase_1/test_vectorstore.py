"""Fast Phase 1 tests: pure logic only (no network, no qdrant_client import).

The import-isolation rule says qdrant_client may only appear inside
app/services/vectorstore.py, so these tests never import it - qdrant objects
are inspected by attribute access only. Live-Qdrant checks live in
scripts/verify_phase_1.py.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.schemas.errors import ApiError, DependencyUnavailable
from app.services import vectorstore as vs

APP_DIR = Path(__file__).resolve().parents[2] / "app"


def test_point_id_deterministic():
    assert vs.point_id("doc_x", "v1", 0) == vs.point_id("doc_x", "v1", 0)


def test_point_id_distinct_across_version_index_document():
    ids = {
        vs.point_id("doc_x", "v1", 0),
        vs.point_id("doc_x", "v2", 0),
        vs.point_id("doc_x", "v1", 1),
        vs.point_id("doc_y", "v1", 0),
    }
    assert len(ids) == 4


def test_point_id_is_uuid_shape():
    pid = vs.point_id("doc_x", "v1", 0)
    assert len(pid) == 36 and pid.count("-") == 4
    int(pid.replace("-", ""), 16)  # hex


@pytest.mark.parametrize("bad", ["", "   ", None])
def test_patient_filter_requires_patient_id(bad):
    with pytest.raises(ApiError) as excinfo:
        vs.patient_filter(bad)  # type: ignore[arg-type]
    assert excinfo.value.status_code == 400
    assert excinfo.value.code == "invalid_request"


def test_patient_filter_structure():
    flt = vs.patient_filter("p_1")
    assert len(flt.must) == 1
    assert flt.must[0].key == "patient_id"
    assert flt.must[0].match.value == "p_1"


def test_patient_filter_with_doc_type_and_date_from():
    flt = vs.patient_filter("p_1", doc_type="lab_result", date_from="2026-02-01")
    keys = [c.key for c in flt.must]
    assert keys == ["patient_id", "doc_type", "doc_date"]
    assert flt.must[2].range is not None  # DatetimeRange on the indexed field


def test_dependency_unavailable_is_api_error_503():
    err = DependencyUnavailable("qdrant", detail="TimeoutError")
    assert isinstance(err, ApiError)
    assert err.status_code == 503
    assert err.code == "dependency_unavailable"
    assert err.to_body() == {
        "error": {"code": "dependency_unavailable", "message": err.message}
    }


def test_no_qdrant_client_import_outside_vectorstore():
    offenders = []
    for path in APP_DIR.rglob("*.py"):
        if path.name == "vectorstore.py":
            continue
        if "qdrant_client" in path.read_text(encoding="utf-8"):
            offenders.append(str(path.relative_to(APP_DIR)))
    assert offenders == []
