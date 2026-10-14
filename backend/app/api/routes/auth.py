from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_session, get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.auth import AuthSession, User
from app.schemas.auth import AuthRequest, AuthResponse, UserResponse
from app.services.auth_service import authenticate_user, create_session, create_user, revoke_session

router = APIRouter(prefix='/auth', tags=['auth'])


def _user_response(user: User) -> AuthResponse:
    return AuthResponse(user=UserResponse(id=user.id, email=user.email))


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite='lax',
        max_age=7 * 24 * 60 * 60,
        path='/',
    )


@router.post('/register', response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: AuthRequest, response: Response, db: Session = Depends(get_db)):
    try:
        user = create_user(db, payload.email, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    token, _ = create_session(db, user)
    _set_session_cookie(response, token)
    return _user_response(user)


@router.post('/login', response_model=AuthResponse)
def login(payload: AuthRequest, response: Response, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid email or password.')
    token, _ = create_session(db, user)
    _set_session_cookie(response, token)
    return _user_response(user)


@router.post('/logout', status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, session: AuthSession = Depends(get_current_session), db: Session = Depends(get_db)):
    revoke_session(db, session)
    response.delete_cookie(settings.session_cookie_name, path='/')


@router.get('/me', response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return UserResponse(id=user.id, email=user.email)
