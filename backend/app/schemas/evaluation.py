from __future__ import annotations

from pydantic import BaseModel, Field


class EvaluationCreateRequest(BaseModel):
    job_title: str = Field(..., min_length=1)
    job_description: str = Field(..., min_length=20, max_length=12000)


class EvaluationResponse(BaseModel):
    id: int
    job_title: str
    status: str
    structured_job: dict | None = None
    created_at: str | None = None
    updated_at: str | None = None


class CandidateSummary(BaseModel):
    id: int
    candidate_name: str
    score: int | None = None
    verdict: str | None = None
    processing_status: str
    email: str | None = None
    file_name: str | None = None


class CandidateDetails(BaseModel):
    id: int
    evaluation_id: int
    candidate_name: str
    email: str | None = None
    phone: str | None = None
    structured_resume: dict | None = None
    match_score: int | None = None
    verdict: str | None = None
    evaluation_details: dict | None = None
    processing_status: str
    error_message: str | None = None


class MatchResult(BaseModel):
    score: int = Field(default=0, ge=0, le=100)
    verdict: str
    details: dict
