# RAG_CONTRACT_DUMP.md — CareOS Medical RAG Service

**Generated:** 2026-11-25 · **Mode:** read-only extraction · **Source of truth:** the code in this repository.

Every block below is copied from the file named above it. Nothing here is
summarised or inferred. If a block and the code disagree, the code wins.

No secret values are reproduced: `.env` was never read. Environment variable
**names** and the **template defaults** from `.env.example` are listed instead.

### File-path mapping (requested path → actual path in this repository)

Some paths in the request do not exist under those names; the definitions were
extracted from the real modules:

| Requested | Actual |
| --- | --- |
| `app/api/auth.py` | `app/api/deps.py` (`require_api_key`, `require_model_ready`) |
| `app/models/schemas.py` | `app/schemas/contract.py`, `app/schemas/summary.py`, `app/schemas/errors.py` |
| `app/services/chunker.py` | `app/services/chunking/` package (`base.py` + 5 chunkers + `__init__.py`) |
| `app/api/errors.py` | `app/schemas/errors.py` |

---

## 1. API endpoints, headers and status codes

### 1.1 Router wiring

`app/api/routes.py`:

```python
router = APIRouter(
    dependencies=[Depends(require_api_key), Depends(require_rate_limit)]
)
```

Both dependencies are resolved in that order, so an unauthenticated request is
rejected **before** it can consume rate-limit quota.

`app/api/deps.py`:

```python
async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    # Bytes form: compare_digest rejects non-ASCII str input, and header
    # values are latin-1 decoded, so encode both sides first.
    expected = settings.rag_api_key.get_secret_value().encode("utf-8")
    provided = (x_api_key or "").encode("utf-8")
    if not expected or not secrets.compare_digest(provided, expected):
        raise unauthorized()


async def require_model_ready(request: Request) -> None:
    """Block ingest and query when the startup model guard failed.

    ``None`` means the guard did not run (e.g. warm-up disabled); that is not a
    mismatch and does not block. ``False`` means indexed data uses different
    models and requires a re-index first.
    """
    if getattr(request.app.state, "model_guard_ok", None) is False:
        raise model_mismatch()
```

`app/api/ratelimit.py`:

```python
async def require_rate_limit(
    request: Request, x_api_key: str | None = Header(default=None)
) -> None:
    """FastAPI dependency: 429 with ``Retry-After`` once the window is full."""
    limiter = get_limiter()
    host = request.client.host if request.client else None
    allowed, retry_after = limiter.check(bucket_key(x_api_key, host))
    if not allowed:
        raise rate_limited(retry_after)
```

```python
def bucket_key(api_key: str | None, host: str | None) -> str:
    """Hash the key: the bucket map must never hold the secret itself."""
    digest = hashlib.sha256((api_key or "").encode("utf-8")).hexdigest()[:16]
    return f"{digest}:{host or 'unknown'}"
```

### 1.2 Routes

| Method | Path | Auth | Rate limited | Success |
| --- | --- | --- | --- | --- |
| GET | `/health` | **no** | no | `200` |
| POST | `/rag/ingest` | yes | yes | `202` |
| POST | `/rag/ask` | yes | yes | `200` |
| POST | `/rag/patient-summary` | yes | yes | `200` |

`app/api/health.py`:

```python
@router.get("/health")
async def health() -> Any:
    return {"status": "ok", "service": "careos-rag", "phase": 0}
```

`app/api/routes.py` (decorators, verbatim):

```python
@router.post("/rag/ingest", dependencies=[Depends(require_model_ready)])
async def ingest(
    request: IngestRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
) -> JSONResponse:
```

```python
@router.post("/rag/ask", dependencies=[Depends(require_model_ready)])
async def ask(request: AskRequest, http_request: Request) -> JSONResponse:
```

```python
@router.post("/rag/patient-summary", dependencies=[Depends(require_model_ready)])
async def patient_summary(
    request: PatientSummaryRequest, http_request: Request
) -> JSONResponse:
```

### 1.3 Request and response headers

| Header | Direction | Required | Meaning |
| --- | --- | --- | --- |
| `X-API-Key` | request | **yes** on all `/rag/*` routes; ignored by `/health` | Service credential, compared with `secrets.compare_digest` |
| `X-Request-ID` | request | no | Correlation id; accepted only if ≤128 chars of printable ASCII, otherwise replaced |
| `X-Request-ID` | response | always | The accepted id, or a generated `uuid4().hex` |
| `Retry-After` | response | on `429` only | Whole seconds (≥1) before the caller may retry |
| `Content-Type` | request | yes for JSON bodies | `application/json` |
| `Access-Control-Allow-Origin` | response | only if CORS is configured | Echoes an allowed origin |

`app/main.py`:

```python
def _sanitize_request_id(value: str | None) -> str | None:
    """Accept only short printable-ASCII ids so a hostile header value can
    never leak control characters into logs or the response header."""
    if not value:
        return None
    value = value.strip()
    if not value or len(value) > 128 or any(not (0x21 <= ord(c) <= 0x7E) for c in value):
        return None
    return value
```

### 1.4 Status codes actually returned

| Code | `code` value | Raised by | Body |
| --- | --- | --- | --- |
| `200` | — | `/health`, `/rag/ask`, `/rag/patient-summary` | success payload |
| `202` | — | `/rag/ingest` | `IngestAccepted` |
| `400` | `invalid_request` | request validation (mapped), `ApiError` from resolvers/`patient_id` checks | `{"error": {...}}` |
| `400` | `empty_text` | blank `raw_text`, empty `session_report_data` | `{"error": {...}}` |
| `401` | `unauthorized` | missing/wrong `X-API-Key` | `{"error": {...}}` |
| `413` | `text_too_large` | ingest text over `MAX_TEXT_CHARS` | `{"error": {...}}` |
| `429` | `rate_limited` | rate limiter | `{"error": {...}}` + `Retry-After` |
| `500` | `internal_error` | unhandled exception | `{"error": {"code": "internal_error", "message": "Internal server error."}}` |
| `503` | `dependency_unavailable` | Qdrant / LLM failure after retries | `{"error": {...}}` |
| `503` | `model_mismatch` | `require_model_ready` when the guard is `False` | `{"error": {...}}` |

**`422` is never returned.** FastAPI's `RequestValidationError` is remapped to
`400` in `app/main.py`:

```python
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        try:
            raw_errors = exc.errors(include_url=False)
        except TypeError:
            # FastAPI's RequestValidationError.errors() takes no kwargs in
            # some versions; plain errors() is fine because only the keys
            # below are ever read.
            raw_errors = exc.errors()
        parts = []
        for error in raw_errors:
            loc = ".".join(str(part) for part in error.get("loc", ()))
            parts.append(f"{loc}: {error.get('type', 'unknown')}: {error.get('msg', '')}")
        # Built ONLY from loc/type/msg. The 'input' and 'ctx' payloads of
        # pydantic errors can carry patient text and must never be included.
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "invalid_request", "message": "; ".join(parts)}},
        )
```

`501 not_implemented` still exists as a helper but **no route raises it any
more** (`/rag/ask` became real in Phase 6).

### 1.5 CORS (closed by default)

`app/main.py`:

```python
    origins = settings.cors_allowed_origins
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=False,
            allow_methods=["GET", "POST"],
            allow_headers=["X-API-Key", "X-Request-ID", "Content-Type"],
            expose_headers=["X-Request-ID", "Retry-After"],
            max_age=600,
        )
```

---

## 2. Exact Pydantic models

### 2.1 `app/schemas/contract.py` (frozen cross-team contract)

```python
DocType = Literal[
    "lab_result", "prescription", "radiology", "medical_report", "session_report"
]


class OcrOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    raw_text: str = Field(min_length=1)
    lines: list[str] = Field(default_factory=list)
    detected_doc_type: str | None = None  # validated in the resolver; invalid -> ignored and logged
    extracted_date: str | None = None  # parsed in the resolver; invalid -> ignored and logged

    @field_validator("raw_text")
    @classmethod
    def _raw_text_not_blank(cls, value: str) -> str:
        # Raise ApiError itself (not ValueError) so it escapes pydantic's
        # ValidationError wrapper and keeps the documented 400 empty_text shape.
        if not value.strip():
            raise empty_text("ocr_output.raw_text must contain non-whitespace text")
        return value


class SessionReportData(BaseModel):
    """Structured report from the Session Agent (plan Section 5.4).

    Known field names come from the Owner Constraints; the full list is
    [NOT YET CONFIRMED] (O17). Extra string fields are kept as additional
    sections, in the order received.
    """

    model_config = ConfigDict(extra="allow")

    full_report_text: str | None = None
    chief_complaint: str | None = None
    history_of_present_illness: str | None = None
    assessment_and_diagnosis: str | None = None
    treatment_plan: str | None = None
    consultation_date: str | None = None  # [NOT YET CONFIRMED] name; ISO date
    approved_at: datetime | None = None  # [NOT YET CONFIRMED] name


class IngestRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    patient_id: str = Field(min_length=1, max_length=128)
    document_id: str = Field(min_length=1, max_length=128)
    uploaded_at: datetime
    user_selected_type: DocType
    user_selected_date: date | None = None  # null when the user did not enter a date
    ocr_output: OcrOutput | None = None  # required unless session_report_data is used
    session_report_data: SessionReportData | None = None

    @model_validator(mode="after")
    def _enforce_single_source(self) -> "IngestRequest":
        has_ocr = self.ocr_output is not None
        has_report = self.session_report_data is not None
        if has_ocr == has_report:
            raise invalid_request(
                "exactly one of ocr_output / session_report_data must be present"
            )
        if self.user_selected_type == "session_report":
            if self.ocr_output is not None:
                raise invalid_request(
                    "user_selected_type 'session_report' requires session_report_data"
                )
        elif self.session_report_data is not None:
            raise invalid_request(
                f"user_selected_type '{self.user_selected_type}' requires ocr_output"
            )
        if has_report and not _session_report_has_text(self.session_report_data):
            raise empty_text(
                "session_report_data must contain at least one non-empty field"
            )
        return self


class IngestAccepted(BaseModel):
    document_id: str
    status: Literal["processing"]  # shape of the 202 body: [NOT YET CONFIRMED] with Backend


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    role: Literal["user", "assistant"]
    content: str


class OptionalFilters(BaseModel):
    model_config = ConfigDict(extra="ignore")

    doc_type: DocType | None = None  # hard filter when present
    date_from: date | None = None  # ISO date; Backend converts chips such as "Last 3 Months"


class AskRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    patient_id: str = Field(min_length=1, max_length=128)
    doctor_query: str = Field(min_length=1, max_length=2000)
    chat_history: list[ChatMessage] = Field(default_factory=list)
    optional_filters: OptionalFilters = Field(default_factory=OptionalFilters)


class Source(BaseModel):
    document_id: str
    doc_type: DocType
    doc_date: str  # ISO YYYY-MM-DD
    reference_snippet: str  # the matching original line or text (raw_snippet)


class AskResponse(BaseModel):
    answer: str
    sources: list[Source]
```

Validation rules implied by the above, verbatim in effect:

- `IngestRequest.patient_id`, `document_id`: `min_length=1`, `max_length=128`.
- `IngestRequest.uploaded_at`: required `datetime`.
- `IngestRequest.user_selected_type`: required, one of the five `DocType` values.
- Exactly one of `ocr_output` / `session_report_data` must be present.
- `user_selected_type == "session_report"` requires `session_report_data`;
  every other type requires `ocr_output`.
- `SessionReportData` needs at least one non-empty text field (known fields or
  any extra string field).
- `AskRequest.doctor_query`: `min_length=1`, `max_length=2000`.
- `ChatMessage.role`: only `"user"` or `"assistant"`.
- All request models: `extra="ignore"` (unknown fields are dropped silently).
  `SessionReportData` is the exception: `extra="allow"` (extras become sections).

### 2.2 `app/schemas/summary.py` (`POST /rag/patient-summary`)

```python
SummaryStatus = Literal["ok", "no_records", "verification_failed"]
SummarySectionKey = Literal["medications", "labs", "reports", "visits"]
Language = Literal["ar", "en"]


class SummarySection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    key: SummarySectionKey
    title: str  # localized heading shown to the doctor
    content: str  # citation markers already stripped
    sources: list[Source] = Field(default_factory=list)


class PatientSummaryRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    patient_id: str = Field(min_length=1, max_length=128)
    # Optional: the brief has no question to infer the language from.
    language: Language | None = None
    optional_filters: OptionalFilters = Field(default_factory=OptionalFilters)
    # Optional per-request cap on how many documents feed the brief.
    max_documents: int | None = Field(default=None, ge=1, le=50)


class PatientSummaryResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: SummaryStatus
    message: str
    sections: list[SummarySection] = Field(default_factory=list)
    sources: list[Source] = Field(default_factory=list)
```

### 2.3 `/health` response

Not a Pydantic model — a literal dict:

```python
    return {"status": "ok", "service": "careos-rag", "phase": 0}
```

---

## 3. Document types, date resolution, normalization and limits

### 3.1 Allowed `doc_type` values

`app/schemas/contract.py` (the wire enum):

```python
DocType = Literal[
    "lab_result", "prescription", "radiology", "medical_report", "session_report"
]
```

`app/services/resolver.py` (the same set, used for validation):

```python
VALID_DOC_TYPES = frozenset(
    {"lab_result", "prescription", "radiology", "medical_report", "session_report"}
)
```

Resolution rule (`app/services/resolver.py`):

```python
def resolve_doc_type(
    user_selected_type: str, detected_doc_type: str | None, document_id: str = ""
) -> tuple[str, bool]:
    """The user's choice always wins; a valid OCR detection that disagrees is
    logged (document id only, never text) to measure OCR quality."""
    mismatch = bool(
        detected_doc_type
        and detected_doc_type in VALID_DOC_TYPES
        and detected_doc_type != user_selected_type
    )
    if mismatch:
        logger.info("doc_type_mismatch document_id=%s", document_id)
    return user_selected_type, mismatch
```

### 3.2 Date resolution priority

Module docstring of `app/services/resolver.py`, verbatim:

```text
Date priority for OCR documents:
    user_selected_date -> ocr_output.extracted_date -> date parsed from the
    text (sample/examination dates preferred; dd/mm/yyyy is day-first, and
    when both numbers are <= 12 the source is marked text_ambiguous) ->
    the clinic-timezone date of uploaded_at (source "upload", unreliable).

Session reports (D30) never parse dates from report text:
    user_selected_date -> consultation_date -> clinic-timezone date of
    approved_at (source "approval") -> clinic-timezone date of uploaded_at
    (source "approval_time", because upload happens at approval).

Dates in the future or before 1900 are ignored (plan Section 5.1 rules);
this range check is applied to user-provided dates too.
```

`date_source` values emitted: `user`, `ocr`, `text`, `text_ambiguous`,
`upload` (OCR documents); `user`, `consultation`, `approval`, `approval_time`
(session reports).

```python
def _in_valid_range(value: date | None, today: date) -> bool:
    return value is not None and date(1900, 1, 1) <= value <= today
```

```python
def parse_date_string(value: str) -> tuple[date, bool] | None:
    """Parse ISO YYYY-MM-DD or dd/mm/yyyy or dd-mm-yyyy (day-first for Egypt,
    plan O8 default). Returns (date, ambiguous); ambiguous only when a
    day-first slash/dash date has both numbers <= 12."""
    s = (value or "").strip()
    m = _ISO_RE.fullmatch(s)
    if m:
        parsed = _mk_date(m["y"], m["m"], m["d"])
        return (parsed, False) if parsed else None
    m = _SLASH_RE.fullmatch(s) or _DASH_RE.fullmatch(s)
    if m:
        day, month = int(m["d"]), int(m["m"])
        parsed = _mk_date(m["y"], str(month), str(day))
        if parsed is None:
            return None
        return parsed, (day <= 12 and month <= 12)
    return None
```

Date patterns and the "sample date" keywords:

```python
_DATE_KEYWORDS = ("sample", "collected", "collection", "examination", "عينة")

_ISO_RE = re.compile(r"(?P<y>\d{4})-(?P<m>\d{1,2})-(?P<d>\d{1,2})")
_SLASH_RE = re.compile(r"(?P<d>\d{1,2})/(?P<m>\d{1,2})/(?P<y>\d{4})")
_DASH_RE = re.compile(r"(?P<d>\d{1,2})-(?P<m>\d{1,2})-(?P<y>\d{4})")
```

Timestamp → date always goes through the clinic time zone:

```python
def _clinic_date(value: datetime, tz: ZoneInfo) -> date:
    """Convert a timestamp to the clinic time zone before taking the date
    (plan D30/A19: a late-evening visit must not get the next day's date).
    Naive timestamps are assumed UTC."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(tz).date()
```

### 3.3 Text normalization

`app/services/normalizer.py`:

```python
# ٠..٩ (Arabic-Indic) and ۰..۹ (Persian/Urdu) -> 0..9
_DIGIT_TRANSLATION = str.maketrans(
    "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹",
    "01234567890123456789",
)

# Units that must be separated from a preceding number. Longest alternatives
# come first so "mmol" wins over "mol"; the trailing word boundary prevents
# splitting identifiers such as "A1c" or "T2DM".
_UNIT_AFTER_NUMBER = re.compile(
    r"(?<=\d)(?=(?:mmhg|mmol|µmol|umol|mcg|µg|miu|meq|mg|kg|ng|pg|ml|dl|iu|cm|mm|g|l|u|%)\b)",
    re.IGNORECASE,
)

_WHITESPACE = re.compile(r"\s+")


def normalize(text: str) -> str:
    """Return the canonical text used for embedding and query matching."""
    if not text:
        return ""
    value = text.translate(_DIGIT_TRANSLATION)
    value = _UNIT_AFTER_NUMBER.sub(" ", value)
    return _WHITESPACE.sub(" ", value).strip()
```

Matching-only Arabic normalization (used by the query analyzer and the
verifier's bilingual term check; never applied to embedded or displayed text):

```python
_ARABIC_DIACRITICS = re.compile(r"[\u064B-\u0652\u0670\u0640]")
_ALEF_FORMS = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا"})
_TAA_MARBOOTA = str.maketrans({"ة": "ه", "ى": "ي"})


def light_arabic_normalize(text: str) -> str:
    """Matching-only Arabic normalization: unify alef/taa forms, drop diacritics.

    ``أملوديبين``, ``املوديبين`` and ``أملوديبين`` must compare equal, and the
    same for ``الكلى`` / ``الكلي``.
    """
    if not text:
        return ""
    return _ARABIC_DIACRITICS.sub("", text.translate(_ALEF_FORMS).translate(_TAA_MARBOOTA))
```

### 3.4 Chunk context prefix and parent ids

`app/services/chunking/base.py`:

```python
def make_parent_id(document_id: str, index: int) -> str:
    return f"{document_id}#p{index}"
```

```python
    """Prepend the exact plan prefix to a normalized child text."""
    normalized = normalize(text)
    if doc_type == "session_report":
        label = (section_label or "General").strip() or "General"
        return f"[session_report | {doc_date} | Section: {label}] {normalized}"
    return f"[{doc_type} | {doc_date}] {normalized}"
```

So a child's embedded text is exactly one of:

```text
[<doc_type> | <doc_date>] <normalized text>
[session_report | <doc_date> | Section: <Label>] <normalized text>
```

### 3.5 Size and count limits

| Limit | Setting | Default | Enforced where |
| --- | --- | --- | --- |
| Ingest text size | `MAX_TEXT_CHARS` | `100000` | `/rag/ingest` → `413 text_too_large` |
| Child text (prefix included) | `CHILD_MAX_CHARS` | `480` | chunkers; embedder rejects longer input |
| Parent text | `PARENT_MAX_CHARS` | `6000` | chunkers; context building |
| Summary context (all blocks) | `SUMMARY_MAX_CHARS` | `12000` | `patient_summary` |
| `doctor_query` | model field | `2000` chars | `AskRequest` |
| `patient_id`, `document_id` | model field | `128` chars | request models |
| Chat history depth | `HISTORY_MAX_MESSAGES` | `5` | `history.clamp_history` |
| Each history message | `HISTORY_MAX_CHARS` | `1000` | `history.clamp_history` |
| Dense vector size | `DENSE_DIM` | `384` | collection + embedder assertion |
| Summary documents | `SUMMARY_MAX_DOCUMENTS` / `SUMMARY_DOCS_PER_TYPE` | `9` / `3` | record collection |
| Over-fetch | `WIDE_K` | `40` | retriever |
| Returned parents | `FINAL_PARENTS` | `5` | retriever |

---

## 4. Configuration and error codes

### 4.1 Environment variables (names + safe template defaults only)

Defaults below are the `.env.example` template values or the `Settings` field
defaults. **No real key, URL or salt is reproduced.**

| Variable | Type | Safe default | Notes |
| --- | --- | --- | --- |
| `RAG_API_KEY` | secret | *(required, no default)* | `Field(min_length=1)`; Settings fails fast if empty |
| `QDRANT_URL` | str | `https://your-qdrant-cloud-instance.example:6333` | `Field(min_length=1)`; required |
| `QDRANT_API_KEY` | secret | *(empty)* | Optional (local docker Qdrant) |
| `COLLECTION_NAME` | str | `careos_medical_records` | |
| `QDRANT_TIMEOUT_SECONDS` | float | `15` | |
| `QDRANT_RETRY_ATTEMPTS` | int | `3` | transient errors only |
| `QDRANT_RETRY_WAIT_SECONDS` | float | `0.5` | exponential backoff base |
| `DENSE_MODEL` | str | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | |
| `SPARSE_MODEL` | str | `Qdrant/bm25` | |
| `DENSE_DIM` | int | `384` | config field; **not** templated in `.env.example` |
| `EMBED_BATCH_SIZE` | int | `32` | |
| `EMBED_WARMUP_ON_STARTUP` | bool | `true` | |
| `DB_URL` | str | `sqlite:///./rag_manifest.db` | manifest DB |
| `LLM_PROVIDER` | str | `openrouter` | |
| `OPENROUTER_API_KEY` | secret | *(empty)* | `Field(min_length=1)`; required |
| `OPENROUTER_BASE_URL` | str | `https://openrouter.ai/api/v1` | |
| `OPENROUTER_MODEL` | str | `google/gemma-4-31b-it:free` | |
| `LLM_TEMPERATURE` | float | `0.1` | |
| `LLM_TIMEOUT_SECONDS` | int | `60` | |
| `LLM_MAX_TOKENS` | int | `2000` | must cover thinking tokens |
| `LLM_RETRY_ATTEMPTS` | int | `3` | |
| `LLM_RETRY_WAIT_SECONDS` | float | `1.0` | `Retry-After` honoured, capped 30 s |
| `WIDE_K` | int | `40` | |
| `FINAL_PARENTS` | int | `5` | |
| `RELEVANCE_FLOOR` | float | `0.0` | 0 = gate off (Phase 8 calibration) |
| `RECENCY_WEIGHT` | float | `0.1` | |
| `RECENCY_DECAY_DAYS` | int | `180` | |
| `LATEST_KEYWORDS_EN` | csv | `latest,last,most recent,current,currently,newest,recent` | alias of `latest_keywords_en_csv` |
| `LATEST_KEYWORDS_AR` | csv | `اخر,اخير,احدث,حالي,حاليا,الحالي` | alias of `latest_keywords_ar_csv` |
| `TREND_KEYWORDS_EN` | csv | `change,changed,trend,trending,over time,compare,comparison,history` | alias of `trend_keywords_en_csv` |
| `TREND_KEYWORDS_AR` | csv | `تغير,تطور,مقارنه,مقارنة,علي مدار,على مدار,تاريخ` | alias of `trend_keywords_ar_csv` |
| `PARENT_MAX_CHARS` | int | `6000` | |
| `CHILD_MAX_CHARS` | int | `480` | |
| `QUERY_EXPANSION_ENABLED` | bool | `true` | |
| `QUERY_EXPANSION_MAX_VARIANTS` | int | `3` | |
| `QUERY_EXPANSION_TIMEOUT_SECONDS` | float | `10` | |
| `GEMINI_API_KEY` | secret | *(empty)* | optional fallback |
| `GEMINI_BASE_URL` | str | `https://generativelanguage.googleapis.com/v1beta/openai/` | |
| `GEMINI_FALLBACK_MODEL` | str | `gemini-2.5-flash` | alias of `gemini_model` |
| `CLINIC_DEFAULT_LANGUAGE` | str | `ar` | |
| `SUMMARY_DOCS_PER_TYPE` | int | `3` | |
| `SUMMARY_MAX_DOCUMENTS` | int | `9` | |
| `SUMMARY_MAX_CHARS` | int | `12000` | |
| `HISTORY_MAX_MESSAGES` | int | `5` | |
| `HISTORY_MAX_CHARS` | int | `1000` | |
| `MAX_TEXT_CHARS` | int | `100000` | |
| `DEIDENTIFY_ENABLED` | bool | `true` | |
| `RECOVERY_STALE_SECONDS` | int | `900` | |
| `CORS_ALLOWED_ORIGINS` | csv | *(empty = closed)* | alias of `cors_allowed_origins_csv` |
| `RATE_LIMIT_PER_MINUTE` | int | `60` | `0` disables |
| `AUDIT_ENABLED` | bool | `true` | |
| `AUDIT_LOG_PATH` | str | `logs/audit.jsonl` | |
| `AUDIT_HASH_SALT` | secret | *(empty → random per process)* | set in production |
| `CLINIC_TIMEZONE` | str | `Africa/Cairo` | must not be blank |
| `LOG_LEVEL` | str | `INFO` | |

`Settings` config, verbatim:

```python
    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        # Allow constructing Settings with the Python field name even when a
        # field declares a validation_alias (used by tests and tooling).
        populate_by_name=True,
    )
```

### 4.2 Error envelope

Every error response is exactly:

```json
{"error": {"code": "<snake_case>", "message": "<text>"}}
```

`app/schemas/errors.py`:

```python
class ApiError(Exception):
    """Raise anywhere; the app-level handler turns it into status + body."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        #: Extra response headers (e.g. Retry-After on 429). Never contains PII.
        self.headers = headers or {}

    def to_body(self) -> dict[str, dict[str, str]]:
        return {"error": {"code": self.code, "message": self.message}}
```

### 4.3 Error codes and their exact messages

| Status | `code` | `message` (exact, `{}` = interpolated) |
| --- | --- | --- |
| 400 | `invalid_request` | default `The request payload is invalid.`; validation handler emits `"<loc>: <type>: <msg>"` joined by `"; "`; ingest emits `exactly one of ocr_output / session_report_data must be present`, `user_selected_type 'session_report' requires session_report_data`, `user_selected_type '<type>' requires ocr_output`; retriever emits `patient_id is required for retrieval`; summary emits `patient_id is required for a patient summary`; Qdrant layer emits `patient_id is required for every Qdrant operation` |
| 400 | `empty_text` | default `Text fields must contain non-whitespace text.`; `ocr_output.raw_text must contain non-whitespace text`; `session_report_data must contain at least one non-empty field` |
| 401 | `unauthorized` | `A valid X-API-Key header is required.` |
| 413 | `text_too_large` | `The document text exceeds MAX_TEXT_CHARS.` |
| 429 | `rate_limited` | `Too many requests; retry after {n} seconds.` + header `Retry-After: {n}` |
| 500 | `internal_error` | `Internal server error.` |
| 503 | `dependency_unavailable` | `The '{dep}' dependency is currently unavailable.` (`dep` is `qdrant` or `llm`) |
| 503 | `model_mismatch` | `Embedding model configuration changed; re-index and restart before serving requests.` |
| 501 | `not_implemented` | `{endpoint} is not implemented yet` — helper retained, **unused** |

```python
def rate_limited(retry_after_seconds: float) -> ApiError:
    """Too many requests (Phase 9). ``Retry-After`` tells the caller when to retry."""
    retry_after = max(1, int(round(retry_after_seconds)))
    return ApiError(
        _STATUS_TOO_MANY_REQUESTS,
        "rate_limited",
        f"Too many requests; retry after {retry_after} seconds.",
        headers={"Retry-After": str(retry_after)},
    )
```

### 4.4 Success payload shapes

`202` from `/rag/ingest`:

```json
{"document_id": "<id>", "status": "processing"}
```

`200` from `/rag/ask`:

```json
{"answer": "<text>", "sources": [{"document_id": "...", "doc_type": "lab_result", "doc_date": "YYYY-MM-DD", "reference_snippet": "..."}]}
```

`200` from `/rag/patient-summary`:

```json
{"status": "ok", "message": "<localized status line>", "sections": [{"key": "medications", "title": "...", "content": "...", "sources": [...]}], "sources": [...]}
```

`message` is produced by code (never by the model) and is localized (`ar` / `en`).
`status` is one of `ok`, `no_records`, `verification_failed`.

### 4.5 Audit record (written to `AUDIT_LOG_PATH`, one JSON line per request)

`app/services/audit.py`:

```python
@dataclass(frozen=True)
class AuditRecord:
    """One audit line. Field names are part of the operational contract."""

    timestamp: str
    request_id: str
    endpoint: str
    patient_id_hash: str
    status: int
    latency_ms: float
    source_count: int = 0
    mode: str | None = None
    result_type: str | None = None
```

Never written: the question, the answer, document text, the raw `patient_id`, or
the API key. `patient_id_hash` is `sha256("<salt>:<patient_id>")[:32]`.

### 4.6 Operational rules the Backend must follow

See `docs/BACKEND_SECURITY_CHECKLIST.md` (shipped with this repository). The
three that affect the contract directly:

1. The Backend authorises the end user for the `patient_id` **before** calling;
   the service trusts it.
2. `429` → wait `Retry-After`, then retry once. `503` → retry with backoff.
   `4xx` → do not retry.
3. Responses must not be cached by question text alone (patient leakage).
