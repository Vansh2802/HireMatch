from __future__ import annotations

from pydantic import BaseModel, Field


class JobRequirements(BaseModel):
    role: str | None = None
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    minimum_experience: int | None = None
    education_requirements: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    required_qualifications: list[str] = Field(default_factory=list)
    preferred_qualifications: list[str] = Field(default_factory=list)
    relevant_certifications: list[str] = Field(default_factory=list)
    seniority: str | None = None
    explicit_experience_requirements: str | None = None


class JobExtractionRequest(BaseModel):
    job_title: str = Field(..., min_length=1)
    job_description: str = Field(..., min_length=20)
