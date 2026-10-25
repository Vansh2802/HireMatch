from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, utcnow

if TYPE_CHECKING:
    from app.models.auth import User
    from app.models.job import Job
    from app.models.resume import Resume, ResumeVersion


class Analysis(Base):
    """A persisted, immutable match between one resume version and one job revision.

    ``job_snapshot`` stores the job text and requirements used, so editing or deleting
    the job later never changes what this analysis shows.
    """

    __tablename__ = 'analyses'
    __table_args__ = (
        UniqueConstraint('user_id', 'resume_version_id', 'job_id', 'job_revision', 'scoring_version', name='uq_analyses_inputs'),
        Index('ix_analyses_user_created', 'user_id', 'created_at'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey('resumes.id', ondelete='CASCADE'), nullable=False, index=True)
    resume_version_id: Mapped[int] = mapped_column(ForeignKey('resume_versions.id', ondelete='CASCADE'), nullable=False, index=True)
    job_id: Mapped[int | None] = mapped_column(ForeignKey('jobs.id', ondelete='SET NULL'), nullable=True, index=True)
    job_revision: Mapped[int | None] = mapped_column(Integer, nullable=True)
    job_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    resume_title: Mapped[str] = mapped_column(String(200), nullable=False)
    resume_version_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verdict: Mapped[str] = mapped_column(String(40), nullable=False)
    confidence: Mapped[str | None] = mapped_column(String(10), nullable=True)
    scoring_version: Mapped[str] = mapped_column(String(20), nullable=False)
    result: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    owner: Mapped['User'] = relationship(back_populates='analyses')
    resume: Mapped['Resume'] = relationship()
    resume_version: Mapped['ResumeVersion'] = relationship()
    job: Mapped['Job | None'] = relationship()
