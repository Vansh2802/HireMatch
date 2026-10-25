from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, utcnow

if TYPE_CHECKING:
    from app.models.analysis import Analysis
    from app.models.job import Job
    from app.models.resume import Resume


class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    onboarding_dismissed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    sessions: Mapped[list['AuthSession']] = relationship(back_populates='user', cascade='all, delete-orphan', passive_deletes=True)
    resumes: Mapped[list['Resume']] = relationship(back_populates='owner', cascade='all, delete-orphan', passive_deletes=True)
    jobs: Mapped[list['Job']] = relationship(back_populates='owner', cascade='all, delete-orphan', passive_deletes=True)
    analyses: Mapped[list['Analysis']] = relationship(back_populates='owner', cascade='all, delete-orphan', passive_deletes=True)


class AuthSession(Base):
    __tablename__ = 'auth_sessions'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    user: Mapped['User'] = relationship(back_populates='sessions')
