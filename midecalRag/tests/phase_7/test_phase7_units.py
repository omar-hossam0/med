"""Offline unit tests for Phase 7 (patient summary / doctor brief).

No network: the LLM chain is a scripted fake and the record collector is
injected. Live behaviour is covered by ``scripts/verify_phase_7.py``.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.config import get_settings
from app.schemas.errors import ApiError, DependencyUnavailable
from app.services.llm.base import LlmChain, LlmResult
from app.services.patient_summary import (
    SummaryRecord,
    build_patient_summary,
    collect_recent_records,
    parse_sections,
)
from app.services.prompt import (
    NO_RECORDS_AR,
    NO_RECORDS_EN,
    SUMMARY_SYSTEM_TEMPLATE,
    SUMMARY_UNVERIFIED_AR,
    SUMMARY_UNVERIFIED_EN,
    resolve_language,
    section_title,
)

# --------------------------------------------------------------------------- #
# fakes
# --------------------------------------------------------------------------- #


class ScriptedProvider:
    name = "scripted"
    model = "scripted-model"

    def __init__(
        self, replies: list[object] | None = None, default: str = "", truncate: bool = False
    ) -> None:
        self.replies = list(replies or [])
        self.default = default
        self.truncate = truncate
        self.calls: list[dict] = []

    def available(self) -> bool:
        return True

    def generate(self, messages, *, temperature=None, max_tokens=None, timeout=None):
        self.calls.append(
            {
                "messages": list(messages),
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
        )
        reply = self.replies.pop(0) if self.replies else self.default
        if isinstance(reply, BaseException):
            raise reply
        return LlmResult(
            text=reply,
            provider=self.name,
            model=self.model,
            latency_ms=1.0,
            prompt_tokens=42,
            completion_tokens=17,
            finish_reason="length" if self.truncate else "stop",
        )


def record(
    parent_id: str,
    document_id: str,
    doc_type: str,
    doc_date: str,
    text: str,
    snippet: str | None = None,
) -> SummaryRecord:
    return SummaryRecord(
        parent_id=parent_id,
        document_id=document_id,
        doc_type=doc_type,
        doc_date=doc_date,
        parent_text=text,
        snippet=snippet or text,
    )


RECORDS = [
    record("rx#p0", "doc_rx", "prescription", "2026-11-01", "Amlodipine 5 mg once daily"),
    record(
        "lab#p0",
        "doc_lab",
        "lab_result",
        "2026-10-15",
        "Renal Function:\nCreatinine: 1.8 mg/dL (0.6 - 1.2)",
    ),
    record("visit#p0", "doc_visit", "session_report", "2026-09-01", "Follow-up visit: stable"),
]

GOOD_BRIEF = """MEDICATIONS:
- Amlodipine 5 mg once daily [1]
LABS:
- Creatinine 1.8 mg/dL on 2026-10-15 [2]
REPORTS:
None documented.
VISITS:
- Follow-up visit on 2026-09-01 [3]
"""


def run(replies, records=None, *, language=None, collector=None, truncate=False):
    provider = ScriptedProvider(replies, truncate=truncate)
    seen: list = []

    def default_collector(patient_id, filters, max_documents=None):
        seen.append((patient_id, filters, max_documents))
        return list(RECORDS if records is None else records)

    outcome = build_patient_summary(
        "p1",
        None,
        language,
        None,
        chain=LlmChain([provider]),
        collector=collector or default_collector,
    )
    return outcome, provider, seen


# --------------------------------------------------------------------------- #
# parsing
# --------------------------------------------------------------------------- #
def test_parse_sections_basic():
    parsed = parse_sections(GOOD_BRIEF)
    assert set(parsed) == {"medications", "labs", "visits"}
    assert parsed["medications"] == "Amlodipine 5 mg once daily [1]"
    assert "None documented" not in parsed.get("reports", "")


def test_parse_sections_tolerates_markdown_and_duplicates():
    text = (
        "**MEDICATIONS:**\n- A [1]\n\n### LABS:\n- B [2]\n\n**MEDICATIONS:**\n- C [3]\n"
    )
    parsed = parse_sections(text)
    assert parsed["medications"] == "A [1]\nC [3]"
    assert parsed["labs"] == "B [2]"


def test_parse_sections_without_headings_returns_empty():
    assert parse_sections("Just some prose about the patient.") == {}


# --------------------------------------------------------------------------- #
# empty patient
# --------------------------------------------------------------------------- #
def test_empty_patient_returns_message_without_llm_call():
    outcome, provider, _ = run([], records=[])
    assert outcome.status == "no_records"
    assert outcome.sections == []
    assert outcome.sources == []
    assert provider.calls == []


def test_empty_patient_message_is_localized():
    arabic, _, _ = run([], records=[], language="ar")
    english, _, _ = run([], records=[], language="en")
    assert arabic.message == NO_RECORDS_AR
    assert english.message == NO_RECORDS_EN


# --------------------------------------------------------------------------- #
# language
# --------------------------------------------------------------------------- #
def test_language_defaults_to_the_clinic_setting():
    assert resolve_language(None) == get_settings().clinic_default_language
    assert resolve_language("en") == "en"
    assert resolve_language("fr") == get_settings().clinic_default_language


def test_section_titles_follow_the_language():
    assert section_title("labs", "ar") == "أحدث التحاليل"
    assert section_title("labs", "en") == "Recent labs"


def test_prompt_uses_the_requested_language_and_fixed_headings():
    _, provider, _ = run([GOOD_BRIEF], language="en")
    system = provider.calls[0]["messages"][0].content
    user = provider.calls[0]["messages"][1].content
    assert "Write in English" in system
    for heading in ("MEDICATIONS:", "LABS:", "REPORTS:", "VISITS:"):
        assert heading in user
    assert "Write in Arabic" not in system
    assert SUMMARY_SYSTEM_TEMPLATE.split("{language}")[0] in system


# --------------------------------------------------------------------------- #
# happy path
# --------------------------------------------------------------------------- #
def test_brief_is_parsed_into_sections_with_sources():
    outcome, provider, _ = run([GOOD_BRIEF])
    assert outcome.status == "ok"
    assert len(provider.calls) == 1
    keys = [section.key for section in outcome.sections]
    assert keys == ["medications", "labs", "visits"]
    assert outcome.sections[0].title == "الأدوية الحالية"
    assert "[" not in outcome.sections[0].content
    assert [s.document_id for s in outcome.sections[0].sources] == ["doc_rx"]
    assert [s.document_id for s in outcome.sections[1].sources] == ["doc_lab"]
    assert outcome.document_count == 3
    assert outcome.record_count == 3


def test_top_level_sources_are_deduplicated_by_document():
    outcome, _, _ = run([GOOD_BRIEF])
    ids = [source.document_id for source in outcome.sources]
    assert ids == ["doc_rx", "doc_lab", "doc_visit"]
    assert len(ids) == len(set(ids))


def test_sources_carry_type_date_and_snippet():
    outcome, _, _ = run([GOOD_BRIEF])
    source = outcome.sources[0]
    assert source.doc_type == "prescription"
    assert source.doc_date == "2026-11-01"
    assert "Amlodipine" in source.reference_snippet


def test_section_without_citation_falls_back_to_its_doc_type():
    brief = "MEDICATIONS:\n- Amlodipine 5 mg once daily\n"
    outcome, _, _ = run([brief])
    assert outcome.status == "ok"
    assert [s.document_id for s in outcome.sections[0].sources] == ["doc_rx"]


def test_hallucinated_citation_is_dropped_and_counted():
    brief = "MEDICATIONS:\n- Amlodipine 5 mg once daily [9]\n"
    outcome, _, _ = run([brief])
    assert outcome.hallucinated_citations == 1
    assert "[9]" not in outcome.sections[0].content
    assert [s.document_id for s in outcome.sections[0].sources] == ["doc_rx"]


def test_outcome_serializes_to_the_response_schema():
    outcome, _, _ = run([GOOD_BRIEF])
    body = outcome.to_response().model_dump()
    assert set(body) == {"status", "message", "sections", "sources"}
    assert set(body["sections"][0]) == {"key", "title", "content", "sources"}
    assert body["status"] == "ok"


# --------------------------------------------------------------------------- #
# verification
# --------------------------------------------------------------------------- #
def test_invented_value_triggers_retry_then_withholds():
    bad = "LABS:\n- Creatinine 9.9 mg/dL [2]\n"
    outcome, provider, _ = run([bad, bad])
    assert outcome.status == "verification_failed"
    assert outcome.sections == []
    assert outcome.sources  # the doctor can still open the documents
    assert outcome.regenerated is True
    assert len(provider.calls) == 2
    assert provider.calls[1]["temperature"] == 0.0
    assert "9.9" in provider.calls[1]["messages"][0].content


def test_corrected_retry_is_accepted():
    bad = "LABS:\n- Creatinine 9.9 mg/dL [2]\n"
    outcome, provider, _ = run([bad, GOOD_BRIEF])
    assert outcome.status == "ok"
    assert outcome.regenerated is True
    assert len(provider.calls) == 2


def test_verification_failure_message_is_localized():
    arabic, _, _ = run(["LABS:\n- Creatinine 9.9 mg/dL [2]\n"], language="ar")
    english, _, _ = run(["LABS:\n- Creatinine 9.9 mg/dL [2]\n"], language="en")
    assert arabic.message == SUMMARY_UNVERIFIED_AR
    assert english.message == SUMMARY_UNVERIFIED_EN


def test_unstructured_output_is_not_accepted_as_a_brief():
    outcome, provider, _ = run(["The patient seems fine overall.", "Still prose."])
    assert outcome.status == "verification_failed"
    assert outcome.sections == []
    assert len(provider.calls) == 2


def test_provider_failure_propagates_as_503():
    with pytest.raises(DependencyUnavailable) as excinfo:
        run([DependencyUnavailable("llm")])
    assert excinfo.value.status_code == 503


def test_truncated_brief_is_withheld():
    """A brief cut at max_tokens can pass the number check but is not complete."""
    outcome, provider, _ = run([GOOD_BRIEF, GOOD_BRIEF], truncate=True)
    assert outcome.status == "verification_failed"
    assert outcome.sections == []
    assert len(provider.calls) == 2


# --------------------------------------------------------------------------- #
# context handling
# --------------------------------------------------------------------------- #
def test_context_is_deidentified_before_the_call():
    records = [
        record(
            "rx#p0",
            "doc_rx",
            "prescription",
            "2026-11-01",
            "Amlodipine 5 mg once daily, call 01012345678",
        )
    ]
    _, provider, _ = run(
        ["MEDICATIONS:\n- Amlodipine 5 mg once daily [1]\n"], records=records
    )
    user = provider.calls[0]["messages"][1].content
    assert "01012345678" not in user
    assert "[REDACTED_PHONE]" in user
    assert "Amlodipine 5 mg" in user


def test_context_respects_the_total_budget():
    records = [
        record("a#p0", "doc_a", "lab_result", "2026-11-01", "x" * 9000),
        record("b#p0", "doc_b", "lab_result", "2026-10-01", "y" * 9000),
    ]
    _, provider, _ = run(["LABS:\n- Creatinine 1.8 mg/dL\n"], records=records)
    user = provider.calls[0]["messages"][1].content
    budget = get_settings().summary_max_chars
    assert len(user) < budget + 400


def test_invalid_patient_id_is_rejected():
    with pytest.raises(ApiError):
        build_patient_summary("   ", None, None, None)


# --------------------------------------------------------------------------- #
# record collection
# --------------------------------------------------------------------------- #
def _point(patient, document_id, doc_type, doc_date, parent_id, text, raw=None):
    return SimpleNamespace(
        payload={
            "patient_id": patient,
            "document_id": document_id,
            "parent_id": parent_id,
            "doc_type": doc_type,
            "doc_date": doc_date,
            "parent_text": text,
            "raw_snippet": raw or text,
        }
    )


def test_collector_caps_documents_per_type(monkeypatch):
    from app.services import vectorstore

    def fake_search(patient_id, doc_type=None, date_from=None, limit=50, client=None):
        if doc_type != "prescription":
            return []
        return [
            _point(patient_id, f"doc_{i}", "prescription", f"2026-1{i % 9}-01", f"p{i}", "Amlodipine 5 mg")
            for i in range(5)
        ]

    monkeypatch.setattr(vectorstore, "search_by_date", fake_search)
    records = collect_recent_records("p1", None, per_type=2, max_documents=9)
    assert len({r.document_id for r in records}) == 2


def test_collector_caps_total_documents(monkeypatch):
    from app.services import vectorstore

    def fake_search(patient_id, doc_type=None, date_from=None, limit=50, client=None):
        return [
            _point(patient_id, f"{doc_type}_doc", doc_type, "2026-10-01", f"{doc_type}#p0", "value 1.0 mg")
        ]

    monkeypatch.setattr(vectorstore, "search_by_date", fake_search)
    records = collect_recent_records("p1", None, per_type=3, max_documents=2)
    assert len({r.document_id for r in records}) == 2


def test_collector_drops_foreign_patient_points(monkeypatch):
    from app.services import vectorstore

    def fake_search(patient_id, doc_type=None, date_from=None, limit=50, client=None):
        if doc_type != "prescription":
            return []
        return [_point("someone_else", "doc_x", "prescription", "2026-10-01", "x#p0", "secret 9 mg")]

    monkeypatch.setattr(vectorstore, "search_by_date", fake_search)
    assert collect_recent_records("p1", None) == []


def test_collector_applies_the_date_filter(monkeypatch):
    from app.services import vectorstore

    seen: list[str | None] = []

    def fake_search(patient_id, doc_type=None, date_from=None, limit=50, client=None):
        seen.append(date_from)
        return []

    monkeypatch.setattr(vectorstore, "search_by_date", fake_search)
    collect_recent_records("p1", {"date_from": "2026-09-01"})
    assert set(seen) == {"2026-09-01"}


def test_collector_keeps_the_richest_parent_text(monkeypatch):
    from app.services import vectorstore

    def fake_search(patient_id, doc_type=None, date_from=None, limit=50, client=None):
        if doc_type != "lab_result":
            return []
        return [
            _point(patient_id, "doc_l", "lab_result", "2026-10-01", "doc_l#p0", "short"),
            _point(patient_id, "doc_l", "lab_result", "2026-10-01", "doc_l#p0", "a much longer parent text"),
        ]

    monkeypatch.setattr(vectorstore, "search_by_date", fake_search)
    records = collect_recent_records("p1", None)
    assert len(records) == 1
    assert records[0].parent_text == "a much longer parent text"
