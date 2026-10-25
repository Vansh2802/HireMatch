from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RequirementStatus = Literal['met', 'partial', 'not_found', 'unverifiable']
EvidenceSource = Literal['resume_text', 'profile', 'related_skill', 'computed']


class Evidence(BaseModel):
    excerpt: str
    source: EvidenceSource
    line: int | None = None


class RequirementResult(BaseModel):
    id: str
    category: str
    importance: str
    text: str
    source_excerpt: str | None = None
    uncertain: bool = False
    status: RequirementStatus
    credit: float | None = None
    evidence: list[Evidence] = Field(default_factory=list)
    note: str


class ComponentResult(BaseModel):
    key: str
    label: str
    base_weight: float
    effective_weight: float
    score: float | None
    status: Literal['scored', 'not_applicable', 'unverifiable']
    requirement_count: int
    detail: str


class ActionItem(BaseModel):
    requirement_id: str
    requirement: str
    importance: str
    status: RequirementStatus
    priority: Literal['high', 'medium', 'low']
    why: str
    suggestion: str
    section: str | None = None


class AnalysisResult(BaseModel):
    scoring_version: str
    score: int | None
    verdict: str
    confidence: Literal['high', 'medium', 'low']
    evidence_coverage: float
    summary: str
    components: list[ComponentResult]
    requirements: list[RequirementResult]
    strengths: list[str]
    action_plan: list[ActionItem]
    next_steps: list[str]
    counts: dict[str, int]


class AnalysisCreateRequest(BaseModel):
    resume_id: int
    job_id: int
    resume_version_id: int | None = None


class AnalysisListItem(BaseModel):
    id: int
    resume_id: int | None
    resume_version_id: int | None
    resume_title: str
    resume_version_number: int | None
    job_id: int | None
    job_title: str
    job_company: str | None
    score: int | None
    verdict: str
    confidence: str | None
    scoring_version: str
    created_at: datetime


class AnalysisOut(AnalysisListItem):
    job_revision: int | None
    job_snapshot: dict
    result: dict
    is_legacy: bool = False
    is_current_resume_version: bool | None = None
    is_current_job_revision: bool | None = None
