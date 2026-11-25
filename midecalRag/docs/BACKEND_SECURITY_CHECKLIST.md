# Backend security checklist (before calling the RAG service)

The RAG service is **internal**. It authenticates the *caller*, not the end user.
Everything below is the Backend's responsibility; if any line is unticked, the
service can leak another patient's records.

## 1. Authorization (the single most important control)

- [ ] The Backend authenticates the logged-in doctor/user itself.
- [ ] Before calling `/rag/ask`, `/rag/patient-summary` or `/rag/ingest`, the
      Backend verifies that this user is allowed to access **this `patient_id`**
      (same rule the clinical UI uses). The RAG service trusts the `patient_id`
      it receives; it cannot check ownership.
- [ ] `patient_id` values are opaque and never derived from user input without
      validation (the service matches them exactly, never as a pattern).

## 2. Credentials and network

- [ ] The service is reachable **only** from the Backend network (private VPC /
      allow-listed IPs). It is never exposed to the Frontend or the internet.
- [ ] `RAG_API_KEY` lives in the Backend's secret store, is sent as `X-API-Key`,
      and is **never** shipped to a browser or mobile app.
- [ ] The key is rotated on a schedule and immediately on suspicion; rotation is
      a restart of both sides (no key history is kept).
- [ ] TLS is used for every hop that crosses a host.
- [ ] `CORS_ALLOWED_ORIGINS` stays empty unless a browser client genuinely calls
      the service directly (it should not).

## 3. What may be sent

- [ ] Patient text travels in the **JSON body only** — never in the URL, query
      string, headers, or logs.
- [ ] `X-Request-ID` is set by the Backend (short, printable ASCII) so one
      request can be traced end to end; the service echoes it back.
- [ ] No national IDs, phone numbers or e-mails are added to fields the service
      does not need.
- [ ] The Backend knows that the service sends de-identified-but-not-anonymous
      patient text to an external LLM provider; the privacy decision (O1) is
      recorded with the owner and legal advisor.

## 4. Handling the responses

- [ ] `answer` is shown **with** its `sources[]`; the doctor must be able to open
      the cited document. A source is `document_id`, `doc_type`, `doc_date` and
      `reference_snippet`.
- [ ] `status: "no_records"` / `"not_found"` are presented as "no information in
      the file", never as a clinical conclusion.
- [ ] `status: "verification_failed"` is presented as "the summary could not be
      verified" — do not display the withheld content (there is none).
- [ ] Responses are **not cached by question text**. If the Backend caches, the
      key must include `patient_id`, the normalized query and a history hash, the
      entry must expire quickly, and any ingest/delete for that patient must
      invalidate it.
- [ ] Answers are not stored in analytics, error trackers or third-party logs.

## 5. Error handling

| Status | Meaning | What the Backend should do |
| --- | --- | --- |
| 400 | invalid request / empty text | fix the payload, do not retry |
| 401 | missing or wrong `X-API-Key` | alert, do not retry |
| 413 | document too large | reject at the UI, do not retry |
| 429 | rate limited | wait `Retry-After` seconds, then retry once |
| 503 `dependency_unavailable` | Qdrant or the LLM is down | retry with exponential backoff, then degrade |
| 503 `model_mismatch` | embeddings changed, re-index needed | page the operator, do not retry |
| 500 | internal error | retry once, then alert |

- [ ] 5xx responses are retried with backoff and a cap; 4xx are not retried.
- [ ] A failed ask never blocks the doctor's workflow: show "could not retrieve
      now" and let them open the documents directly.

## 6. Ingestion

- [ ] Documents are sent **after** OCR, with `patient_id` and `document_id` that
      are stable across retries (a retry must not create a duplicate document).
- [ ] The 202 response means "accepted", not "indexed"; the Backend polls its own
      records or waits before assuming the document is searchable.
- [ ] `session_report_data` and `ocr_output` are mutually exclusive in one
      request (the service rejects both/neither).

## 7. Audit and observability

- [ ] The service writes a zero-PII audit line per protected request
      (`timestamp`, `request_id`, `endpoint`, `patient_id_hash`, `status`,
      `latency_ms`, `source_count`, `mode`, `result_type`) to `AUDIT_LOG_PATH`.
- [ ] `AUDIT_HASH_SALT` is set to a long random value in production, so hashes
      stay comparable across restarts (an empty salt means a random per-process
      salt).
- [ ] The Backend keeps its own access log (who looked at which patient); the
      service only knows the hashed `patient_id`.
