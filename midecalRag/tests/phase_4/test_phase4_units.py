"""Phase 4 unit tests: embedder, model guard, re-indexer, API guard.

Fast and offline: every model backend is injected, so FastEmbed is never
imported or downloaded. The real end-to-end ranking tests live in
``scripts/verify_phase_4.py``.
"""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.config import get_settings  # noqa: E402
from app.services import (  # noqa: E402
    model_guard,
    reindexer,
)
from app.services.embedder import (  # noqa: E402
    Embedder,
    EmbedderDimensionError,
    EmbedderInputTooLong,
    get_embedder,
)


class FakeDense:
    """Deterministic dense backend with FastEmbed-like metadata."""

    def __init__(self, dim: int = 384) -> None:
        self.embedding_size = dim
        self.embedded: list[list[str]] = []
        self.queried: list[list[str]] = []

    def embed(self, documents, batch_size: int = 256, **kwargs):
        texts = [documents] if isinstance(documents, str) else list(documents)
        self.embedded.append(texts)
        return [self._vector(text) for text in texts]

    def query_embed(self, query, **kwargs):
        texts = [query] if isinstance(query, str) else list(query)
        self.queried.append(texts)
        return [self._vector(text) for text in texts]

    def token_count(self, texts, batch_size: int = 1024, **kwargs) -> int:
        values = [texts] if isinstance(texts, str) else list(texts)
        return sum(len(value.split()) for value in values)

    def _vector(self, text: str) -> list[float]:
        seed = sum(ord(char) for char in text)
        return [float((seed + index) % 13) for index in range(self.embedding_size)]


class SparseEmbedding:
    def __init__(self, indices: list[int], values: list[float]) -> None:
        self.indices = indices
        self.values = values


class FakeSparse:
    def embed(self, documents, batch_size: int = 256, **kwargs):
        texts = [documents] if isinstance(documents, str) else list(documents)
        return [self._embedding(text) for text in texts]

    def query_embed(self, query, **kwargs):
        texts = [query] if isinstance(query, str) else list(query)
        return [self._embedding(text) for text in texts]

    @staticmethod
    def _embedding(text: str) -> SparseEmbedding:
        tokens = sorted({abs(hash(token)) % 1000 for token in text.split()}) or [0]
        return SparseEmbedding(tokens, [1.0] * len(tokens))


def _embedder(dim: int = 384) -> Embedder:
    return Embedder(
        dense_backend=FakeDense(dim),
        sparse_backend=FakeSparse(),
        batch_size=4,
    )


# ---------------------------------------------------------------------------
# Embedder
# ---------------------------------------------------------------------------


def test_embedder_is_deterministic_and_has_both_vectors():
    embedder = _embedder()
    dense_a, sparse_a = embedder.embed_children(["Creatinine 1.8 mg/dL"])
    dense_b, sparse_b = embedder.embed_children(["Creatinine 1.8 mg/dL"])
    assert dense_a == dense_b
    assert sparse_a == sparse_b
    assert len(dense_a[0]) == 384
    indices, values = sparse_a[0]
    assert indices and len(indices) == len(values)


def test_embedder_normalizes_shared_text_and_adds_no_prefix():
    embedder = _embedder()
    embedder.embed_children(["١٢.٥mg/dL"])
    assert embedder.last_inputs == ["12.5 mg/dL"]
    embedder.embed_children(["Creatinine: 1.8 mg/dL"])
    assert embedder.last_inputs == ["Creatinine: 1.8 mg/dL"]
    assert not embedder.last_inputs[0].startswith(("passage:", "query:"))


def test_embed_query_uses_same_normalizer():
    embedder = _embedder()
    embedder.embed_query("Amlodipine 5mg")
    assert embedder.last_inputs == ["Amlodipine 5 mg"]


def test_embedder_dimension_mismatch_fails_fast():
    embedder = _embedder(dim=8)
    with pytest.raises(EmbedderDimensionError):
        embedder.load()


def test_embedder_rejects_too_long_child(monkeypatch):
    fake_settings = SimpleNamespace(
        dense_model="dense",
        sparse_model="sparse",
        embed_batch_size=4,
        dense_dim=384,
        child_max_chars=5,
    )
    monkeypatch.setattr("app.services.embedder.get_settings", lambda: fake_settings)
    embedder = _embedder()
    with pytest.raises(EmbedderInputTooLong):
        embedder.embed_children(["this child is too long"])


def test_singleton_embedder_is_shared():
    assert get_embedder() is get_embedder()


# ---------------------------------------------------------------------------
# Model guard
# ---------------------------------------------------------------------------


def _signature_row(**overrides):
    signature = model_guard.current_signature()
    row = {
        "document_id": "doc_1",
        "dense_model": signature.dense_model,
        "sparse_model": signature.sparse_model,
        "dense_dim": signature.dense_dim,
    }
    row.update(overrides)
    return row


def test_manifest_guard_accepts_matching_signature(monkeypatch):
    monkeypatch.setattr(
        model_guard.manifest, "indexed_model_rows", lambda engine=None: [_signature_row()]
    )
    assert model_guard.manifest_mismatches() == []
    model_guard.assert_manifest_consistent()


def test_manifest_guard_rejects_changed_model(monkeypatch):
    monkeypatch.setattr(
        model_guard.manifest,
        "indexed_model_rows",
        lambda engine=None: [_signature_row(dense_model="some/other-model")],
    )
    assert len(model_guard.manifest_mismatches()) == 1
    with pytest.raises(model_guard.ModelMismatchError):
        model_guard.assert_manifest_consistent()


class _FakeQdrant:
    def __init__(self, size: int) -> None:
        self._size = size

    def get_collection(self, collection_name):
        dense = SimpleNamespace(size=self._size)
        vectors = {"dense": dense}
        return SimpleNamespace(
            config=SimpleNamespace(params=SimpleNamespace(vectors=vectors))
        )


def test_collection_dimension_mismatch_is_reported(monkeypatch):
    monkeypatch.setattr(
        model_guard.manifest, "indexed_model_rows", lambda engine=None: [_signature_row()]
    )
    embedder = _embedder()
    mismatch = model_guard.collection_mismatch(client=_FakeQdrant(8))
    assert mismatch == {"collection_dim": 8, "expected": 384}
    problems = model_guard.startup_check(embedder, client=_FakeQdrant(8))
    assert any(problem.startswith("collection_dense_dim=") for problem in problems)
    assert model_guard.startup_check(embedder, client=_FakeQdrant(384)) == []


def test_collection_lookup_errors_are_not_model_mismatches(monkeypatch):
    class Broken:
        def get_collection(self, collection_name):
            raise RuntimeError("network down")

    assert model_guard.collection_mismatch(client=Broken()) is None


# ---------------------------------------------------------------------------
# Re-indexer
# ---------------------------------------------------------------------------


class _FakeScrollClient:
    def __init__(self) -> None:
        self.upserts: list[dict] = []
        self._batch = [
            SimpleNamespace(
                id="id-1",
                payload={
                    "patient_id": "p1",
                    "document_id": "doc_1",
                    "parent_id": "doc_1#p0",
                    "doc_type": "lab_result",
                    "doc_date": "2026-10-15",
                    "child_text": "Creatinine 1.8 mg/dL",
                    "raw_snippet": "Creatinine 1.8 mg/dL",
                    "parent_text": "Creatinine 1.8 mg/dL",
                    "version": "v1",
                    "child_index": 0,
                },
            ),
            SimpleNamespace(
                id="id-2",
                payload={
                    "patient_id": "p1",
                    "document_id": "doc_1",
                    "parent_id": "doc_1#p0",
                    "doc_type": "lab_result",
                    "doc_date": "2026-10-15",
                    "child_text": "Urea 65 mg/dL",
                    "raw_snippet": "Urea 65 mg/dL",
                    "parent_text": "Creatinine 1.8 mg/dL",
                    "version": "v1",
                    "child_index": 1,
                },
            ),
        ]

    def scroll(self, **kwargs):
        batch, self._batch = self._batch, []
        return batch, None

    def upsert(self, **kwargs):
        self.upserts.append(kwargs)


class _FakeEmbedder:
    def embed_children(self, texts):
        return ([[1.0] * 384 for _ in texts], [([1], [1.0]) for _ in texts])


def test_reindexer_rebuilds_vectors_and_updates_manifest(monkeypatch):
    client = _FakeScrollClient()
    updated: list[tuple] = []
    monkeypatch.setattr(
        reindexer.manifest,
        "update_models",
        lambda document_id, dense, sparse, dim, engine=None: updated.append(
            (document_id, dense, sparse, dim)
        ),
    )

    summary = reindexer.reindex_collection(
        embedder=_FakeEmbedder(),
        client=client,
        collection_name="test_collection",
        batch_size=10,
    )

    assert summary["points"] == 2
    assert summary["documents"] == 1
    assert summary["batches"] == 1
    assert len(client.upserts) == 1
    upserted = client.upserts[0]["points"]
    assert len(upserted) == 2
    assert updated and updated[0][0] == "doc_1" and updated[0][3] == 384


# ---------------------------------------------------------------------------
# API model-guard enforcement
# ---------------------------------------------------------------------------


def _auth_headers() -> dict[str, str]:
    return {"X-API-Key": get_settings().rag_api_key.get_secret_value()}


def _ask_body() -> dict:
    return {"patient_id": "p_guard", "doctor_query": "creatinine?", "chat_history": []}


def _ingest_body() -> dict:
    return {
        "patient_id": "p_guard",
        "document_id": "doc_guard",
        "uploaded_at": "2026-10-24T10:30:00Z",
        "user_selected_type": "lab_result",
        "ocr_output": {
            "raw_text": "Creatinine: 1.8 mg/dL",
            "lines": ["Creatinine: 1.8 mg/dL"],
        },
    }


def test_ingest_and_ask_refused_on_model_mismatch():
    from fastapi.testclient import TestClient

    from app.main import app

    original = getattr(app.state, "model_guard_ok", None)
    app.state.model_guard_ok = False
    app.state.model_guard_problems = ["dense_model changed"]
    try:
        client = TestClient(app)
        for path, body in (
            ("/rag/ingest", _ingest_body()),
            ("/rag/ask", _ask_body()),
        ):
            response = client.post(path, json=body, headers=_auth_headers())
            assert response.status_code == 503, path
            assert response.json()["error"]["code"] == "model_mismatch", path
    finally:
        app.state.model_guard_ok = original
        app.state.model_guard_problems = []


def test_ask_runs_when_guard_did_not_flag_a_mismatch(monkeypatch):
    """``None`` means the guard did not run: it must not block the ask path."""
    from fastapi.testclient import TestClient

    from app.api import routes
    from app.main import app
    from app.services.generator import GeneratedAnswer

    monkeypatch.setattr(
        routes,
        "answer_question",
        lambda *args, **kwargs: GeneratedAnswer(
            answer="ok", sources=[], mode="normal", result_type="answered", rewritten=False
        ),
    )
    original = getattr(app.state, "model_guard_ok", None)
    app.state.model_guard_ok = None
    try:
        response = TestClient(app).post(
            "/rag/ask", json=_ask_body(), headers=_auth_headers()
        )
        assert response.status_code == 200
        assert set(response.json()) == {"answer", "sources"}
    finally:
        app.state.model_guard_ok = original
