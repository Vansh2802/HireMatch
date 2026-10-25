from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

RequirementCategory = Literal['skill', 'experience', 'education', 'certification', 'responsibility', 'qualification']
Importance = Literal['required', 'preferred']
ApplicationStage = Literal['interested', 'preparing', 'applied', 'interviewing', 'completed', 'archived']
APPLICATION_STAGES: tuple[str, ...] = ('interested', 'preparing', 'applied', 'interviewing', 'completed', 'archived')


class Requirement(BaseModel):
    id: str = Field(..., max_length=20)
    category: RequirementCategory
    importance: Importance = 'required'
    text: str = Field(..., min_length=1, max_length=500)
    skill: str | None = Field(default=None, max_length=120, description='Canonical skill key for skill requirements')
    years: float | None = Field(default=None, ge=0, le=40)
    degree_level: int | None = Field(default=None, ge=0, le=4, description='1 associate, 2 bachelor, 3 master, 4 doctorate')
    source_excerpt: str | None = Field(default=None, max_length=600)
    uncertain: bool = False


class JobProfile(BaseModel):
    seniority: str | None = Field(default=None, max_length=60)
    requirements: list[Requirement] = Field(default_factory=list, max_length=120)
    method: Literal['heuristic', 'llm', 'legacy'] = 'heuristic'
    warnings: list[str] = Field(default_factory=list)


# ---- LLM extraction contract (validated, then normalised into JobProfile) ----


class LLMRequirement(BaseModel):
    category: RequirementCategory
    importance: Importance = 'required'
    text: str = Field(..., min_length=1, max_length=500)
    source_excerpt: str | None = Field(default=None, max_length=600)
    years: float | None = Field(default=None, ge=0, le=40)
    uncertain: bool = False


class LLMJobExtraction(BaseModel):
    seniority: str | None = None
    requirements: list[LLMRequirement] = Field(..., max_length=120)


# ---- API contracts ----


class JobCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    url: str | None = Field(default=None, max_length=1000)
    description: str = Field(..., min_length=80, max_length=20000)

    @field_validator('title', 'company', 'location', 'url', 'description', mode='before')
    @classmethod
    def _strip(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator('url')
    @classmethod
    def _http_only(cls, value: str | None):
        if value and not value.lower().startswith(('http://', 'https://')):
            raise ValueError('The job link must start with http:// or https://')
        return value


class JobUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    url: str | None = Field(default=None, max_length=1000)
    description: str | None = Field(default=None, min_length=80, max_length=20000)
    stage: ApplicationStage | None = None
    notes: str | None = Field(default=None, max_length=10000)
    applied_on: date | None = None
    follow_up_on: date | None = None

    @field_validator('url')
    @classmethod
    def _http_only(cls, value: str | None):
        if value and not value.strip().lower().startswith(('http://', 'https://')):
            raise ValueError('The job link must start with http:// or https://')
        return value


class RequirementEdit(BaseModel):
    id: str = Field(..., max_length=20)
    importance: Importance


class JobRequirementsUpdateRequest(BaseModel):
    """Users may remove false positives or change required/preferred; they cannot invent source text."""

    keep: list[RequirementEdit] = Field(..., max_length=120)
    base_revision: int


class JobOut(BaseModel):
    id: int
    title: str
    company: str | None
    location: str | None
    url: str | None
    description: str
    status: str
    error_message: str | None
    revision: int
    profile: JobProfile | None
    stage: str
    notes: str | None
    applied_on: date | None
    follow_up_on: date | None
    created_at: datetime
    updated_at: datetime
    analysis_count: int = 0
    best_score: int | None = None
    latest_analysis_id: int | None = None


class JobListItem(BaseModel):
    id: int
    title: str
    company: str | None
    location: str | None
    status: str
    stage: str
    requirement_count: int
    created_at: datetime
    updated_at: datetime
    applied_on: date | None
    follow_up_on: date | None
    analysis_count: int = 0
    best_score: int | None = None
    latest_analysis_id: int | None = None
