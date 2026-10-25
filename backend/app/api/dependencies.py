from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.auth import AuthSession, User
from app.services.auth_service import get_session


def get_current_session(request: Request, db: Session = Depends(get_db)) -> AuthSession:
    token = request.cookies.get(settings.session_cookie_name)
    session = get_session(db, token)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Your session has expired. Please sign in again.')
    return session


def get_current_user(session: AuthSession = Depends(get_current_session)) -> User:
    if not session.user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Your session has expired. Please sign in again.')
    return session.user


@dataclass
class Pagination:
    limit: int
    offset: int


def pagination(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=100_000),
) -> Pagination:
    return Pagination(limit=limit, offset=offset)


def not_found(kind: str) -> HTTPException:
    # Same response for "does not exist" and "belongs to someone else" to avoid leaking ids.
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f'{kind} not found.')
