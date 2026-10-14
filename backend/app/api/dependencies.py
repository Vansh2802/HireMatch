from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.auth import AuthSession, User
from app.services.auth_service import get_session


def get_current_session(request: Request, db: Session = Depends(get_db)) -> AuthSession:
    token = request.cookies.get(settings.session_cookie_name)
    session = get_session(db, token)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Authentication required.')
    return session


def get_current_user(session: AuthSession = Depends(get_current_session)) -> User:
    if not session.user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Authentication required.')
    return session.user
