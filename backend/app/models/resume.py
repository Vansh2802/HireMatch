from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, utcnow

if TYPE_CHECKING:
    from app.models.auth import User


class Resume(Base):
    """A resume the user manages. Content lives in immutable versions."""

    __tablename__ = 'resumes'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    owner: Mapped['User'] = relationship(back_populates='resumes')
    versions: Mapped[list['ResumeVersion']] = relationship(
        back_populates='resume',
        cascade='all, delete-orphan',
        passive_deletes=True,
        order_by='ResumeVersion.version_number',
    )

    @property
    def current_version(self) -> 'ResumeVersion | None':
        """The newest successfully processed version, else the newest version of any status."""
        if not self.versions:
            return None
        ready = [version for version in self.versions if version.status == 'ready']
        return (ready or self.versions)[-1]


class ResumeVersion(Base):
    """One immutable snapshot of a resume: an uploaded file's text or a user correction."""

    __tablename__ = 'resume_versions'
    __table_args__ = (UniqueConstraint('resume_id', 'version_number', name='uq_resume_versions_resume_number'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey('resumes.id', ondelete='CASCADE'), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)  # upload | edit | legacy
    status: Mapped[str] = mapped_column(String(20), nullable=False, default='processing')  # processing | ready | failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False, default='')
    profile: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    warnings: Mapped[list | None] = mapped_column(JSON, nullable=True)
    extraction_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    processing_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    resume: Mapped['Resume'] = relationship(back_populates='versions')
