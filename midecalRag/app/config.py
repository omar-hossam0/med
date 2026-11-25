"""Application settings.

This is the ONLY module allowed to read the environment or the .env file.
Other modules must call :func:`get_settings` (cached, read once).

Owner overrides applied here (they win over the plan text):
- OpenRouter (OpenAI-compatible API) is the primary generation provider.
- Phase 5 owner instruction adds Gemini as a *query-expansion fallback only*
  (never used for answer generation); both keys are optional at runtime.
- Phase 6 owner instruction (2026-11-23) extends Gemini to a generation
  fallback as well, so the answer path degrades instead of failing outright.
- QDRANT_API_KEY is optional (empty allowed) so the local docker-compose
  Qdrant works as a development fallback next to Qdrant Cloud.
"""

import functools
import logging
from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent

_logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Every variable from plan Section 7, adapted by the owner overrides."""

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        # Allow constructing Settings with the Python field name even when a
        # field declares a validation_alias (used by tests and tooling).
        populate_by_name=True,
    )

    # --- service auth (Backend sends this in X-API-Key) ---
    # Required: Settings creation fails fast (ValidationError) when missing/empty.
    rag_api_key: SecretStr = Field(min_length=1)

    # --- vector store ---
    # Qdrant Cloud in production; docker-compose Qdrant in development.
    qdrant_url: str = Field(min_length=1)
    qdrant_api_key: SecretStr = SecretStr("")
    collection_name: str = "careos_medical_records"
    # Vector size of the "dense" named vector. Owner decision 2026-10-29: 384
    # (MiniLM-L12-v2). Phase 4 asserts this equals the loaded model's dimension.
    dense_dim: int = 384
    # Explicit per-call timeout; failures map to DependencyUnavailable (503).
    qdrant_timeout_seconds: float = 15.0
    # Transient network/timeout failures are retried with exponential backoff.
    qdrant_retry_attempts: int = 3
    qdrant_retry_wait_seconds: float = 0.5

    # --- embedding models (FastEmbed) ---
    # Dense model outputs 384-dim vectors; the vector size is asserted from
    # the loaded model itself when the collection is created in Phase 4.
    dense_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    sparse_model: str = "Qdrant/bm25"
    # Phase 4: one shared FastEmbed instance, batch size for encode calls, and
    # startup warm-up so the first ingest does not pay the model-load cost.
    embed_batch_size: int = 32
    embed_warmup_on_startup: bool = True

    # --- manifest / audit database ---
    db_url: str = "sqlite:///./rag_manifest.db"

    # --- LLM (OpenRouter is the ONLY provider; no fallback exists) ---
    llm_provider: str = "openrouter"
    # Required: Settings creation fails fast when missing/empty.
    openrouter_api_key: SecretStr = Field(min_length=1)
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "google/gemma-4-31b-it:free"
    llm_temperature: float = 0.1
    llm_timeout_seconds: int = 60
    # --- generation (Phase 6) ---
    # Owner instruction (2026-11-23): OpenRouter primary with a Gemini fallback
    # for generation too. This supersedes the plan's "no fallback provider"
    # wording, exactly like the Phase 5 query-expansion override.
    # Reasoning-capable providers (Gemini 2.5) count thinking tokens against
    # this budget: 700 truncated a four-section brief mid-sentence at ~26
    # visible tokens, so the cap must cover thinking + the answer.
    llm_max_tokens: int = 2000
    llm_retry_attempts: int = 3
    llm_retry_wait_seconds: float = 1.0

    # --- patient summary / doctor brief (Phase 7) ---
    # No doctor question exists here, so the language cannot be inferred from
    # the text: the request may set it, otherwise this clinic default is used.
    clinic_default_language: str = "ar"
    summary_docs_per_type: int = 3
    summary_max_documents: int = 9
    # Total context budget for one brief (all blocks together).
    summary_max_chars: int = 12000

    # --- query expansion / translation (Phase 5) ---
    # OpenRouter is primary; Gemini is the fallback for this step only (owner
    # instruction). Both are optional at runtime: a failure degrades to the
    # original query and never blocks retrieval.
    query_expansion_enabled: bool = True
    query_expansion_max_variants: int = 3
    query_expansion_timeout_seconds: float = 10.0
    gemini_api_key: SecretStr = SecretStr("")
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    gemini_model: str = Field(
        default="gemini-2.5-flash", validation_alias="GEMINI_FALLBACK_MODEL"
    )

    # --- retrieval tunables ---
    wide_k: int = 40
    final_parents: int = 5
    # Phase 8 calibration (35-case synthetic golden set): no floor preserved
    # recall while improving precision. Relevant and irrelevant dense cosines
    # overlap (relevant p50 0.62 / min 0.15, irrelevant p50 0.57 / max 0.88), and
    # 0.4 already drops 3 expected documents (cross-language hits). Keep the gate
    # OFF; revisit only with a better embedding model or a reranker.
    relevance_floor: float = 0.0
    recency_weight: float = 0.1
    recency_decay_days: int = 180
    # Env names stay LATEST_KEYWORDS_EN / LATEST_KEYWORDS_AR; the *_list
    # properties below expose them parsed.
    latest_keywords_en_csv: str = Field(
        default="latest,last,most recent,current,currently,newest,recent",
        validation_alias="LATEST_KEYWORDS_EN",
    )
    latest_keywords_ar_csv: str = Field(
        default="اخر,اخير,احدث,حالي,حاليا,الحالي",
        validation_alias="LATEST_KEYWORDS_AR",
    )
    trend_keywords_en_csv: str = Field(
        default="change,changed,trend,trending,over time,compare,comparison,history",
        validation_alias="TREND_KEYWORDS_EN",
    )
    trend_keywords_ar_csv: str = Field(
        default="تغير,تطور,مقارنه,مقارنة,علي مدار,على مدار,تاريخ",
        validation_alias="TREND_KEYWORDS_AR",
    )
    parent_max_chars: int = 6000
    # MiniLM-L12-v2 truncates at 128 tokens (~480 chars). Phase 3 keeps every
    # child (including the injected prefix) under this limit.
    child_max_chars: int = 480

    # --- chat history window ---
    history_max_messages: int = 5
    history_max_chars: int = 1000

    # --- ingestion limits / privacy ---
    max_text_chars: int = 100000
    deidentify_enabled: bool = True
    # Rows stuck in "processing" longer than this are marked failed at startup.
    recovery_stale_seconds: int = 900

    # --- security, rate limiting and audit (Phase 9) ---
    # The service is internal; CORS is closed unless an origin is listed.
    # Comma-separated, e.g. "https://backend.clinic.local".
    cors_allowed_origins_csv: str = Field(default="", validation_alias="CORS_ALLOWED_ORIGINS")
    # Requests per minute per (API key, client host). 0 disables the limiter.
    rate_limit_per_minute: int = 60
    # Zero-PII audit trail: one JSON line per protected request.
    audit_enabled: bool = True
    audit_log_path: str = "logs/audit.jsonl"
    # Salt for patient_id hashing. Empty -> a random per-process salt is used
    # (hashes then differ across restarts); set it in production.
    audit_hash_salt: SecretStr = SecretStr("")

    # --- misc ---
    clinic_timezone: str = "Africa/Cairo"
    log_level: str = "INFO"

    @field_validator("clinic_timezone")
    @classmethod
    def _clinic_timezone_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("CLINIC_TIMEZONE must not be blank")
        return value

    @property
    def latest_keywords_en(self) -> list[str]:
        return _split_keywords(self.latest_keywords_en_csv)

    @property
    def latest_keywords_ar(self) -> list[str]:
        return _split_keywords(self.latest_keywords_ar_csv)

    @property
    def trend_keywords_en(self) -> list[str]:
        return _split_keywords(self.trend_keywords_en_csv)

    @property
    def trend_keywords_ar(self) -> list[str]:
        return _split_keywords(self.trend_keywords_ar_csv)

    @property
    def cors_allowed_origins(self) -> list[str]:
        return _split_keywords(self.cors_allowed_origins_csv)


# Soft doc_type hints for the query analyzer. These are configuration, not
# analyzer logic; every entry is a *hint* only (never a hard filter except in
# the latest mode's first attempt, which falls back when it hides evidence).
DOC_TYPE_HINT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "prescription": (
        "drug",
        "drugs",
        "medication",
        "medications",
        "prescription",
        "prescriptions",
        "dose",
        "tablet",
        "tablets",
        "capsule",
        "capsules",
        "دواء",
        "ادويه",
        "روشته",
        "جرعه",
        "حبوب",
    ),
    "lab_result": (
        "lab",
        "labs",
        "test",
        "tests",
        "creatinine",
        "urea",
        "glucose",
        "hba1c",
        "cbc",
        "تحليل",
        "تحاليل",
        "كرياتينين",
        "سكر",
        "وظائف",
    ),
    "radiology": (
        "x-ray",
        "xray",
        "ct",
        "mri",
        "ultrasound",
        "scan",
        "radiology",
        "اشعه",
        "رنين",
        "مقطعيه",
        "سونار",
    ),
    "session_report": (
        "visit",
        "consultation",
        "session",
        "complaint",
        "symptom",
        "symptoms",
        "diagnosis",
        "زياره",
        "عياده",
        "جلسه",
        "شكوي",
        "اعراض",
        "تشخيص",
    ),
    "medical_report": (
        "report",
        "reports",
        "تقرير",
        "تقارير",
    ),
}


def _split_keywords(csv: str) -> list[str]:
    return [part.strip() for part in csv.split(",") if part.strip()]


@functools.lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Create the Settings once; every module gets them from here."""
    return Settings()


def warn_if_llm_key_missing(settings: Settings | None = None) -> None:
    """Log a WARNING when the OpenRouter API key is empty.

    OPENROUTER_API_KEY is required (Settings fails fast when it is missing),
    so this is defensive only. Only the variable NAME is ever logged, never a
    value.
    """
    active = settings or get_settings()
    if not active.openrouter_api_key.get_secret_value():
        _logger.warning(
            "LLM provider 'openrouter' is configured but its API key is empty; set OPENROUTER_API_KEY before LLM calls start"
        )
