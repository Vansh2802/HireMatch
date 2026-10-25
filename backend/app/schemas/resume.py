from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator



class ExperienceEntry(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    company: str | None = Field(default=None, max_length=300)
    location: str | None = Field(default=None, max_length=200)
    start: str | None = Field(default=None, max_length=40, description='Start date as written, e.g. "Jan 2021"')
    end: str | None = Field(default=None, max_length=40, description='End date as written, or "Present"')
    description: str | None = Field(default=None, max_length=6000)


class EducationEntry(BaseModel):
    degree: str | None = Field(default=None, max_length=300)
    field: str | None = Field(default=None, max_length=300)
    institution: str | None = Field(default=None, max_length=300)
    start: str | None = Field(default=None, max_length=40)
    end: str | None = Field(default=None, max_length=40)


class ProjectEntry(BaseModel):
    name: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=4000)
    technologies: list[str] = Field(default_factory=list, max_length=50)


class ResumeProfile(BaseModel):
    """Structured resume data. Every field is optional because resumes vary widely."""

    name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=60)
    location: str | None = Field(default=None, max_length=200)
    headline: str | None = Field(default=None, max_length=300)
    summary: str | None = Field(default=None, max_length=4000)
    skills: list[str] = Field(default_factory=list, max_length=200)
    experiences: list[ExperienceEntry] = Field(default_factory=list, max_length=60)
    education: list[EducationEntry] = Field(default_factory=list, max_length=20)
    projects: list[ProjectEntry] = Field(default_factory=list, max_length=40)
    certifications: list[str] = Field(default_factory=list, max_length=60)
    total_experience_years: float | None = Field(default=None, ge=0, le=60)
    experience_years_source: Literal['date_ranges', 'stated', 'user'] | None = None

    @field_validator('skills', 'certifications', mode='before')
    @classmethod
    def _drop_blank(cls, value):
        if isinstance(value, list):
            return [str(item).strip()[:120] for item in value if item is not None and str(item).strip()]
        return value


class ResumeSection(BaseModel):
    key: str
    heading: str
    line_start: int
    line_end: int


class ResumeVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    version_number: int
    source: str
    status: str
    error_message: str | None = None
    file_name: str | None = None
    file_size: int | None = None
    page_count: int | None = None
    extraction_method: str | None = None
    warnings: list[str] = Field(default_factory=list)
    profile: ResumeProfile | None = None
    text_length: int = 0
    created_at: datetime


class ResumeVersionDetail(ResumeVersionOut):
    raw_text: str = ''


class ResumeSummaryOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    current_version: ResumeVersionOut | None
    version_count: int
    analysis_count: int
    best_score: int | None = None


class ResumeDetailOut(ResumeSummaryOut):
    current_version: ResumeVersionDetail | None
    versions: list[ResumeVersionOut]


class ResumeUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class ResumeProfileUpdateRequest(BaseModel):
    profile: ResumeProfile
    base_version_id: int | None = Field(default=None, description='The version the edits were made on (optimistic concurrency).')
