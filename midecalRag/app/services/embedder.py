"""FastEmbed embedding service (plan Phase 4).

One shared instance loads both models once and is reused for every ingest and
query. FastEmbed runs locally, so patient text never leaves the server for
embeddings (plan O1 privacy advantage).

Owner decision 2026-10-29: the dense model is
``sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`` (dim 384,
128-token truncation). Its FastEmbed metadata says "Prefixes for
queries/documents: not necessary", so the wrapper adds NO ``query:`` /
``passage:`` prefix (the plan's E5 prefix task is superseded). This is why the
same text is passed to the dense and sparse models.

Inference is synchronous. Ingestion runs it inside a Starlette background-task
worker thread, so the FastAPI event loop is never blocked.
"""

from __future__ import annotations

import functools
import logging
import threading
import time
from typing import Any

from app.config import get_settings
from app.services.normalizer import normalize

logger = logging.getLogger(__name__)


class EmbedderDimensionError(RuntimeError):
    """The loaded dense model's dimension differs from DENSE_DIM."""


class EmbedderInputTooLong(ValueError):
    """A document child exceeds CHILD_MAX_CHARS (the model token limit proxy)."""


class Embedder:
    """Dense + sparse FastEmbed wrapper with lazy, one-time loading."""

    def __init__(
        self,
        *,
        dense_model: str | None = None,
        sparse_model: str | None = None,
        batch_size: int | None = None,
        dense_backend: Any = None,
        sparse_backend: Any = None,
    ) -> None:
        settings = get_settings()
        self.dense_model = dense_model or settings.dense_model
        self.sparse_model = sparse_model or settings.sparse_model
        self.batch_size = batch_size or settings.embed_batch_size
        self._dense = dense_backend
        self._sparse = sparse_backend
        self._load_lock = threading.Lock()
        self._loaded = dense_backend is not None and sparse_backend is not None
        self._dim_checked = False
        self._load_seconds = 0.0
        # Debug/verification only: the exact strings handed to the model.
        self.last_inputs: list[str] = []

    @property
    def loaded(self) -> bool:
        return self._loaded

    @property
    def dense_dim(self) -> int:
        self.load()
        return int(getattr(self._dense, "embedding_size", 0))

    @property
    def load_seconds(self) -> float:
        return self._load_seconds

    def load(self) -> None:
        """Load both FastEmbed models once and assert the dense dimension."""
        if self._loaded:
            self._check_dimension()
            return
        with self._load_lock:
            if self._loaded:
                self._check_dimension()
                return
            started = time.perf_counter()
            if self._dense is None:
                from fastembed import TextEmbedding

                self._dense = TextEmbedding(model_name=self.dense_model)
            if self._sparse is None:
                from fastembed import SparseTextEmbedding

                self._sparse = SparseTextEmbedding(model_name=self.sparse_model)
            self._check_dimension()
            self._load_seconds = time.perf_counter() - started
            self._loaded = True

    def _check_dimension(self) -> None:
        """Assert once that the loaded dense model matches DENSE_DIM."""
        if self._dim_checked:
            return
        dim = int(getattr(self._dense, "embedding_size", 0))
        expected = get_settings().dense_dim
        if dim != expected:
            raise EmbedderDimensionError(
                f"dense model dimension {dim} != DENSE_DIM {expected}; "
                "change DENSE_DIM or the model, then re-index"
            )
        self._dim_checked = True

    @staticmethod
    def _assert_child_lengths(prepared: list[str]) -> None:
        """Fail before truncation: children must fit CHILD_MAX_CHARS.

        The configured limit is the character proxy for the model's 128-token
        truncation (Phase 3 keeps every child, prefix included, under it).
        """
        limit = get_settings().child_max_chars
        for text in prepared:
            if len(text) > limit:
                raise EmbedderInputTooLong(
                    f"child text length {len(text)} > CHILD_MAX_CHARS {limit}; "
                    "split children further before embedding"
                )

    @staticmethod
    def _prepare(text: str) -> str:
        """The exact model input: normalized text, no E5 prefix added."""
        return normalize(text or "")

    def _dense_vectors(self, texts: list[str]) -> list[list[float]]:
        vectors = self._dense.embed(texts, batch_size=self.batch_size)
        out: list[list[float]] = []
        for vector in vectors:
            out.append(vector.tolist() if hasattr(vector, "tolist") else list(vector))
        return out

    def _sparse_vectors(self, texts: list[str]) -> list[tuple[list[int], list[float]]]:
        embeddings = self._sparse.embed(texts, batch_size=self.batch_size)
        out: list[tuple[list[int], list[float]]] = []
        for embedding in embeddings:
            out.append(
                (
                    [int(index) for index in embedding.indices],
                    [float(value) for value in embedding.values],
                )
            )
        return out

    def embed_children(
        self, texts: list[str]
    ) -> tuple[list[list[float]], list[tuple[list[int], list[float]]]]:
        """Embed document children: (dense vectors, (indices, values) tuples)."""
        self.load()
        prepared = [self._prepare(text) for text in texts]
        self._assert_child_lengths(prepared)
        self.last_inputs = prepared
        if not prepared:
            return [], []
        dense = self._dense_vectors(prepared)
        sparse = self._sparse_vectors(prepared)
        if len(dense) != len(prepared) or len(sparse) != len(prepared):
            raise RuntimeError("embedder returned a different number of vectors")
        return dense, sparse

    def embed_query(
        self, text: str
    ) -> tuple[list[float], tuple[list[int], list[float]]]:
        """Embed one query with the same models and normalizer as documents."""
        self.load()
        prepared = self._prepare(text)
        self.last_inputs = [prepared]
        dense_vector = next(iter(self._dense.query_embed([prepared])))
        sparse_embedding = next(iter(self._sparse.query_embed([prepared])))
        dense = (
            dense_vector.tolist()
            if hasattr(dense_vector, "tolist")
            else list(dense_vector)
        )
        sparse = (
            [int(index) for index in sparse_embedding.indices],
            [float(value) for value in sparse_embedding.values],
        )
        return dense, sparse

    def token_count(self, texts: list[str]) -> int:
        """Total model tokens for ``texts`` (dense tokenizer); verification aid."""
        self.load()
        counter = getattr(self._dense, "token_count", None)
        if counter is None:
            return sum(len(text.split()) for text in texts)
        return int(counter(texts, batch_size=self.batch_size))

    def warmup(self) -> dict[str, Any]:
        """Load the models and run one tiny encode (startup, no cold request)."""
        self.load()
        started = time.perf_counter()
        self.embed_children(["warmup"])
        encode_seconds = time.perf_counter() - started
        metrics = {
            "dense_model": self.dense_model,
            "sparse_model": self.sparse_model,
            "dense_dim": self.dense_dim,
            "load_seconds": round(self._load_seconds, 3),
            "warmup_encode_seconds": round(encode_seconds, 4),
        }
        logger.info(
            "embedder_warmup dense_dim=%d load_seconds=%.3f",
            metrics["dense_dim"],
            metrics["load_seconds"],
        )
        return metrics


@functools.lru_cache(maxsize=1)
def get_embedder() -> Embedder:
    """The one shared embedder instance (never reload per request)."""
    return Embedder()


def reset_embedder() -> None:
    """Drop the singleton (tests only)."""
    get_embedder.cache_clear()
