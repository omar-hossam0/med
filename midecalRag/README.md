# CareOS Medical RAG Service

Internal retrieval-augmented generation microservice for the CareOS clinical
record system: it ingests OCR/session documents, retrieves a patient's own
records, and produces grounded answers and doctor briefs with citations.

**Status:** Phases 0–9 complete and owner-approved — see `PROGRESS.md`.

---

## 1. Setup

```bash
python -m venv env
env/Scripts/activate            # Windows
# source env/bin/activate       # macOS / Linux

pip install -r requirements.txt
cp .env.example .env            # then fill RAG_API_KEY, QDRANT_URL, OPENROUTER_API_KEY
```

`RAG_API_KEY`, `QDRANT_URL` and `OPENROUTER_API_KEY` are required: the service
refuses to start without them. `GEMINI_API_KEY` is optional (fallback provider).

## 2. Run

```bash
python -m app.main                                   # 127.0.0.1:8000
# or
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The first start downloads the FastEmbed models (a few hundred MB); set
`EMBED_WARMUP_ON_STARTUP=false` to skip the warm-up during tests.

## 3. Developer test UI

**URL: <http://127.0.0.1:8000/ui>** (also `/ui/`)

A zero-build, single-page console for manually exercising every endpoint without
curl. It is a plain static file (`static/index.html`, vanilla HTML/CSS/JS, no
npm, no bundler) mounted by `app/main.py` via `StaticFiles`; it adds no runtime
dependency and does not touch the RAG logic, schemas or tests.

What it gives you:

| Tab | Endpoint | Highlights |
| --- | --- | --- |
| 1 · Ingest | `POST /rag/ingest` | OCR vs Session-Report modes, `document_id` generator, ISO-8601 `uploaded_at`, live request preview, Arabic lab + prescription sample buttons |
| 2 · Doctor Q&A | `POST /rag/ask` | chat window keeping the last 5 turns as `chat_history`, `doc_type`/`date_from` filters, answers rendered with `dir="auto"`, one card per source, raw JSON drawer |
| 3 · Patient Summary | `POST /rag/patient-summary` | `ar`/`en`, `max_documents`, filters, status badge, the four sections with their own sources, raw JSON drawer |

**Connection bar (top of page):** Base URL, `X-API-Key`, shared `patient_id`,
and a **Check /health** button with a live status badge. The base URL, key and
patient id are kept in `localStorage` for convenience — the key is never written
into the source and never leaves your browser except as the `X-API-Key` header.

Notes:

- The page is served from the **same origin** as the API, so no CORS change is
  needed (`CORS_ALLOWED_ORIGINS` stays closed).
- `/ui` itself is unauthenticated static content; **every API call still needs
  `X-API-Key`**. It is a development tool: keep the service internal and do not
  expose `/ui` publicly. To remove it, delete the `static/` directory or the
  mount block in `app/main.py`.
- The key lives in your `.env` as `RAG_API_KEY` — copy it into the UI field.

## 4. API surface

| Method | Path | Success | Auth |
| --- | --- | --- | --- |
| GET | `/health` | `200` | none |
| POST | `/rag/ingest` | `202` | `X-API-Key` |
| POST | `/rag/ask` | `200` | `X-API-Key` |
| POST | `/rag/patient-summary` | `200` | `X-API-Key` |
| GET | `/ui` | `200` | none (dev tool) |

Errors are always `{"error": {"code": "...", "message": "..."}}` with
`400 / 401 / 413 / 429 / 500 / 503`. `422` is never returned (validation errors
are mapped to `400`). Exact request/response models, limits and error codes:
**`RAG_CONTRACT_DUMP.md`**.

## 5. Tests and verification

```bash
env/Scripts/python.exe -m pytest -q          # 238 tests
env/Scripts/ruff.exe check app scripts tests # lint
```

Each phase ships a live verification script that runs against a **dedicated**
Qdrant test collection (never the real one) and a temp manifest DB:

```bash
env/Scripts/python.exe scripts/verify_phase_0.py    # … through …
env/Scripts/python.exe scripts/verify_phase_9.py
```

Golden-set evaluation and threshold calibration:

```bash
env/Scripts/python.exe scripts/evaluate_rag.py            # deterministic (no quota)
env/Scripts/python.exe scripts/evaluate_rag.py --live     # real provider
```

Reports are written to `eval/reports/`.

## 6. Documentation map

| File | Contents |
| --- | --- |
| `PROGRESS.md` | Project status, per-phase decisions, measurements, open items |
| `RAG_CONTRACT_DUMP.md` | Exact API contract extracted from the code |
| `docs/BACKEND_SECURITY_CHECKLIST.md` | What the Backend must verify before calling |
| `RAG_PROJECT_PLAN (1).md` | The original plan |

## 7. Known limits

- Patient text is sent to an external LLM provider; the built-in scrubber removes
  IDs, phones and e-mails but **not names** (decision O1 is still open).
- `RELEVANCE_FLOOR` is `0.0` (gate off): no threshold separated relevant from
  irrelevant parents without losing recall on the golden set.
- Absent-fact questions still reach the LLM (no retrieval short circuit); the
  prompt's "not enough information" rule is the guard.
- Rate limiting is in-memory, per process.
