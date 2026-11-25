"""Frozen cross-team API contract (plan Section 5).

Field names and shapes are copied exactly from the plan and must not change
without owner approval. Extra fields on request models are ignored, except
SessionReportData which allows them (extra sections).
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.errors import empty_text, invalid_request

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


_SESSION_REPORT_TEXT_FIELDS = (
    "full_report_text",
    "chief_complaint",
    "history_of_present_illness",
    "assessment_and_diagnosis",
    "treatment_plan",
)


def _session_report_has_text(data: SessionReportData) -> bool:
    for name in _SESSION_REPORT_TEXT_FIELDS:
        value = getattr(data, name)
        if value is not None and value.strip():
            return True
    # Extra string fields count as sections too (extra="allow").
    for value in (data.model_extra or {}).values():
        if isinstance(value, str) and value.strip():
            return True
    return False


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
