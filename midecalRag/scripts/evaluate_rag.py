"""Golden-set evaluation and RELEVANCE_FLOOR calibration (plan Phase 8).

    env/Scripts/python.exe scripts/evaluate_rag.py                 # deterministic
    env/Scripts/python.exe scripts/evaluate_rag.py --live          # real provider
    env/Scripts/python.exe scripts/evaluate_rag.py --keep          # keep the collection

Default mode is deterministic and quota-free: retrieval runs for real (Qdrant +
FastEmbed) while generation uses the case's scripted answer, so citations,
grounding and verification are exercised without any external API call.

Every run writes `eval/reports/report-<timestamp>.json` and `.md` with the
metrics, the score distribution, the calibration table and the configuration
used, so a result can be reproduced.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
import time
from dataclasses import replace
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

DEFAULT_DATASET = REPO_ROOT / "data" / "eval" / "golden_dataset.json"
DEFAULT_REPORT_DIR = REPO_ROOT / "eval" / "reports"
DEFAULT_COLLECTION = "careos_eval_test"

_TMP = tempfile.mkdtemp(prefix="careos_eval_")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover
    pass


def _configure_environment(collection: str) -> None:
    os.environ["COLLECTION_NAME"] = collection
    os.environ["DB_URL"] = "sqlite:///" + _TMP.replace("\\", "/") + "/manifest.db"
    os.environ["EMBED_WARMUP_ON_STARTUP"] = "false"
    os.environ["EMBED_BATCH_SIZE"] = "16"
    # Retrieval must be measured without expansion calls: the golden set scores
    # the retriever, not a provider.
    os.environ["QUERY_EXPANSION_ENABLED"] = "false"
    os.environ.setdefault("QDRANT_RETRY_ATTEMPTS", "2")
    os.environ.setdefault("QDRANT_RETRY_WAIT_SECONDS", "0.2")


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CareOS RAG golden-set evaluation")
    parser.add_argument("--dataset", default=str(DEFAULT_DATASET))
    parser.add_argument("--report-dir", default=str(DEFAULT_REPORT_DIR))
    parser.add_argument("--collection", default=DEFAULT_COLLECTION)
    parser.add_argument(
        "--live",
        action="store_true",
        help="use the real LLM chain instead of the scripted answers (needs quota)",
    )
    parser.add_argument(
        "--keep",
        action="store_true",
        help="keep the test collection after the run (default: delete it)",
    )
    parser.add_argument(
        "--no-ingest",
        action="store_true",
        help="reuse an existing collection (skips ingestion)",
    )
    parser.add_argument(
        "--wide-k",
        type=int,
        default=None,
        help="override WIDE_K for an ablation (e.g. 5 to show the recency trap)",
    )
    parser.add_argument(
        "--dense-only",
        action="store_true",
        help="ablation: replace the hybrid search with the dense branch only",
    )
    parser.add_argument("--quiet", action="store_true", help="only print the summary")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    if args.wide_k is not None:
        os.environ["WIDE_K"] = str(max(1, args.wide_k))
    _configure_environment(args.collection)

    from app.config import get_settings
    from app.schemas.contract import IngestRequest, OptionalFilters
    from app.services import evaluation as ev
    from app.services import vectorstore as vs
    from app.services.embedder import get_embedder
    from app.services.generator import answer_question
    from app.services.ingest_pipeline import process_document
    from app.services.llm.base import LlmChain, LlmResult
    from app.services.llm.factory import get_llm_chain
    from app.services.patient_summary import build_patient_summary
    from app.services.retriever import retrieve_debug

    settings = get_settings()
    if args.dense_only:
        # Ablation: keep the same call signature but answer from the dense
        # branch only, so the BM25 contribution can be measured.
        def _dense_only(patient_id, dense, sparse, doc_type=None, date_from=None, limit=None, collection_name=None, client=None):
            return vs.search_dense(
                patient_id,
                dense,
                doc_type=doc_type,
                date_from=date_from,
                limit=limit,
                collection_name=collection_name,
                client=client,
            )

        vs.hybrid_search = _dense_only
        print("ABLATION: hybrid search replaced by dense-only search")

    dataset = ev.load_dataset(args.dataset)
    problems = ev.validate_dataset(dataset)
    if problems:
        print("DATASET INVALID:")
        for problem in problems:
            print(f"  - {problem}")
        return 2

    live_chain = None
    if args.live:
        live_chain = get_llm_chain()
        if not live_chain.available:
            print("--live requested but no provider key is configured.")
            return 2

    class ScriptedProvider:
        """Deterministic provider returning this case's scripted reply."""

        name = "scripted"
        model = "golden-set"

        def __init__(self, replies: list[str]) -> None:
            self.replies = list(replies)
            self.calls = 0

        def available(self) -> bool:
            return True

        def generate(self, messages, *, temperature=None, max_tokens=None, timeout=None):
            self.calls += 1
            text = self.replies.pop(0) if self.replies else (self.replies_default or "")
            return LlmResult(
                text=text,
                provider=self.name,
                model=self.model,
                latency_ms=0.0,
                prompt_tokens=0,
                completion_tokens=0,
                finish_reason="stop",
            )

        replies_default = ""

    print("CareOS Medical RAG - Golden Set Evaluation")
    print(f"dataset: {args.dataset}")
    print(f"cases: {len(dataset.cases)}  patients: {len(dataset.patients)}")
    print(f"mode: {'live provider' if args.live else 'deterministic (scripted LLM)'}")
    print(f"collection: {args.collection}")
    print("Settings values and secrets are never printed.")

    embedder = get_embedder()
    embedder.load()
    client = vs.get_client()
    clock = date.fromisoformat(dataset.clock) if dataset.clock else date.today()

    runs: list[ev.CaseRun] = []
    failures: list[str] = []
    try:
        vs.ensure_collection(args.collection, client=client)
        if not args.no_ingest:
            _ingest_dataset(dataset, args.collection, client, process_document, IngestRequest, not args.quiet)

        for case in dataset.cases:
            started = time.perf_counter()
            own_ids = tuple(
                document.document_id
                for document in dataset.patients[case.patient_id].documents
            )
            try:
                run = _run_case(
                    case,
                    clock=clock,
                    collection=args.collection,
                    live_chain=live_chain,
                    ScriptedProvider=ScriptedProvider,
                    answer_question=answer_question,
                    build_patient_summary=build_patient_summary,
                    retrieve_debug=retrieve_debug,
                    OptionalFilters=OptionalFilters,
                    LlmChain=LlmChain,
                    own_document_ids=own_ids,
                )
            except Exception as exc:  # noqa: BLE001 - one bad case must not stop the run
                run = ev.CaseRun(
                    case=case,
                    latency_ms=round((time.perf_counter() - started) * 1000, 2),
                    error=type(exc).__name__,
                    own_document_ids=own_ids,
                )
            run = replace(run, latency_ms=round((time.perf_counter() - started) * 1000, 2))
            runs.append(run)
            if not args.quiet:
                print(f"  {case.id:34s} {run.mode:7s} {run.result_type or run.summary_status or run.error or '-'}")
            _note_failure(run, failures)

        metrics = ev.evaluate_cases(runs, floor=0.0)
        calibration = ev.calibrate_floor(runs)
        distribution = ev.score_distribution(runs)
        findings = ev.derive_findings(metrics, calibration)
        meta = {
            "mode": "live" if args.live else "offline-scripted",
            "git_commit": _git_commit(),
            "dense_model": settings.dense_model,
            "sparse_model": settings.sparse_model,
            "wide_k": settings.wide_k,
            "final_parents": settings.final_parents,
            "recency_weight": settings.recency_weight,
            "recency_decay_days": settings.recency_decay_days,
            "relevance_floor": settings.relevance_floor,
            "expansion_enabled": settings.query_expansion_enabled,
        }
        report_md = ev.format_report(
            dataset=dataset,
            metrics=metrics,
            calibration=calibration,
            distribution=distribution,
            meta=meta,
            failures=failures,
            findings=findings,
        )
        paths = _write_report(
            args.report_dir, report_md, metrics, calibration, distribution, meta, failures, findings
        )

        print()
        for name, value in ev.metrics_table(metrics):
            print(f"  {name:26s} {value}")
        print()
        for point in calibration.points:
            marker = " <= chosen" if calibration.chosen_floor == point.floor else ""
            print(
                f"  floor {point.floor:<4} recall@5 {point.recall_at_5:6.2%} "
                f"precision {point.precision:6.2%} not-found {point.not_found_correctness:6.2%} "
                f"dropped {point.expected_documents_dropped}{marker}"
            )
        print()
        print(f"DECISION: {calibration.rationale}")
        print(f"report: {paths['markdown']}")
        print(f"report: {paths['json']}")
    finally:
        if not args.keep:
            try:
                client.delete_collection(args.collection)
            except Exception:  # noqa: BLE001
                pass
        try:
            client.close()
        except Exception:  # noqa: BLE001
            pass
        shutil.rmtree(_TMP, ignore_errors=True)

    return 0


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _ingest_dataset(dataset, collection, client, process_document, IngestRequest, verbose) -> None:
    total = 0
    for patient in dataset.patients.values():
        for document in patient.documents:
            payload = {
                "patient_id": patient.patient_id,
                "document_id": document.document_id,
                "uploaded_at": "2026-11-20T09:00:00Z",
                "user_selected_type": document.doc_type,
                "user_selected_date": None,
            }
            if document.session_report_data is not None:
                payload["session_report_data"] = document.session_report_data
                source = "session_agent"
            else:
                payload["ocr_output"] = {
                    "raw_text": "\n".join(document.lines),
                    "lines": list(document.lines),
                    "detected_doc_type": None,
                    "extracted_date": document.doc_date,
                }
                source = "ocr"
            process_document(
                IngestRequest.model_validate(payload),
                document.doc_type,
                document.doc_date,
                source,
                version="v1",
                collection_name=collection,
                client=client,
            )
            total += 1
    if verbose:
        print(f"ingested {total} documents into {collection}")


def _run_case(
    case,
    *,
    clock,
    collection,
    live_chain,
    ScriptedProvider,
    answer_question,
    build_patient_summary,
    retrieve_debug,
    OptionalFilters,
    LlmChain,
    own_document_ids=(),
):
    import app.services.evaluation as ev

    filters = OptionalFilters(**case.optional_filters) if case.optional_filters else None

    if case.kind == "summary":
        provider = ScriptedProvider([case.mock_summary or ""])
        chain = live_chain or LlmChain([provider])
        outcome = build_patient_summary(
            case.patient_id, filters, case.language, None, chain=chain
        )
        return ev.CaseRun(
            case=case,
            mode="summary",
            answer=outcome.message,
            source_ids=tuple(source.document_id for source in outcome.sources),
            summary_status=outcome.status,
            section_keys=tuple(section.key for section in outcome.sections),
            own_document_ids=own_document_ids,
        )

    replies: list[str] = []
    if case.chat_history and case.mock_rewrite:
        replies.append(case.mock_rewrite)
    replies.append(case.mock_answer or "")
    provider = ScriptedProvider(replies)
    provider.replies_default = case.mock_answer or ""
    chain = live_chain or LlmChain([provider])

    captured: dict = {}

    def retrieval(patient_id, query, filters_arg, clock_arg):
        debug = retrieve_debug(patient_id, query, filters_arg, clock_arg, collection_name=collection)
        captured["debug"] = debug
        return debug

    outcome = answer_question(
        case.patient_id,
        case.doctor_query or "",
        list(case.chat_history),
        filters,
        clock,
        chain=chain,
        retrieval=retrieval,
    )

    debug = captured.get("debug")
    retrieved = tuple(
        ev.RetrievedDoc(document_id=parent.document_id, relevance=float(parent.relevance))
        for parent in (getattr(debug, "parents", []) or [])
    )
    return ev.CaseRun(
        case=case,
        retrieved=retrieved,
        mode=str(getattr(debug, "mode", "normal")),
        answer=outcome.answer,
        source_ids=tuple(source.document_id for source in outcome.sources),
        result_type=outcome.result_type,
        own_document_ids=own_document_ids,
    )


def _note_failure(run, failures: list[str]) -> None:
    case = run.case
    if run.error:
        failures.append(f"{case.id}: raised {run.error}")
        return
    retrieved = {doc.document_id for doc in run.retrieved}
    missing = set(case.expected_document_ids) - retrieved
    if missing and not case.expect_not_found and case.kind == "ask":
        failures.append(f"{case.id}: expected document not retrieved ({len(missing)})")
    touched = set(case.forbidden_document_ids) & (retrieved | set(run.source_ids))
    if touched:
        leaked = touched - set(run.own_document_ids)
        if leaked:
            failures.append(f"{case.id}: ISOLATION LEAK ({len(leaked)} document(s))")
        else:
            failures.append(f"{case.id}: same-patient distractor retrieved ({len(touched)})")
    if case.expect_not_found and case.kind == "ask" and retrieved:
        failures.append(f"{case.id}: expected no candidates, got {len(retrieved)}")


def _git_commit() -> str:
    try:
        import subprocess

        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return out.stdout.strip() or "no-git"
    except Exception:  # noqa: BLE001
        return "no-git"


def _write_report(
    report_dir, markdown, metrics, calibration, distribution, meta, failures, findings
) -> dict[str, str]:
    directory = Path(report_dir)
    directory.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    md_path = directory / f"report-{stamp}.md"
    json_path = directory / f"report-{stamp}.json"
    md_path.write_text(markdown, encoding="utf-8")
    json_path.write_text(
        json.dumps(
            {
                "meta": meta,
                "metrics": metrics.__dict__,
                "calibration": {
                    "chosen_floor": calibration.chosen_floor,
                    "rationale": calibration.rationale,
                    "points": [point.__dict__ for point in calibration.points],
                },
                "distribution": distribution,
                "findings": findings,
                "failures": failures,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return {"markdown": str(md_path), "json": str(json_path)}


if __name__ == "__main__":
    sys.exit(main())
