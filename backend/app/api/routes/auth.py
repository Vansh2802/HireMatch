from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_session, get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import login_limiter
from app.models.auth import AuthSession, User
from app.schemas.auth import AuthRequest, AuthResponse, ChangePasswordRequest, DeleteAccountRequest, UserResponse
from app.services.auth_service import (
    authenticate_user,
    change_password,
    create_session,
    create_user,
    delete_user,
    get_session,
    revoke_all_sessions,
    revoke_session,
)

router = APIRouter(prefix='/auth', tags=['auth'])


def _user_response(user: User) -> UserResponse:
    return UserResponse(id=user.id, email=user.email, created_at=user.created_at)


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite='lax',
        max_age=settings.session_ttl_days * 24 * 60 * 60,
        path='/',
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(settings.session_cookie_name, path='/', httponly=True, secure=settings.session_cookie_secure, samesite='lax')


@router.post('/register', response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: AuthRequest, response: Response, db: Session = Depends(get_db)):
    try:
        user = create_user(db, payload.email, payload.password)
    except ValueError as exc:
        code = status.HTTP_409_CONFLICT if 'already exists' in str(exc) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(exc)) from exc
    token, _ = create_session(db, user)
    _set_session_cookie(response, token)
    return AuthResponse(user=_user_response(user))


@router.post('/login', response_model=AuthResponse)
def login(payload: AuthRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    # Keyed by client and account so one attacker cannot lock other people out of their accounts.
    client = request.client.host if request.client else 'unknown'
    account_key = f'login:{client}:{payload.email.strip().lower()}'
    if not login_limiter.allow(account_key, settings.login_attempts_per_15_minutes, window_seconds=15 * 60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail='Too many sign-in attempts for this account. Wait 15 minutes and try again.',
            headers={'Retry-After': '900'},
        )
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid email or password.')
    # Rotate: a fresh token on every sign-in; an existing cookie from this browser is revoked.
    previous = request.cookies.get(settings.session_cookie_name)
    if previous:
        old = get_session(db, previous)
        if old:
            revoke_session(db, old)
    token, _ = create_session(db, user)
    _set_session_cookie(response, token)
    return AuthResponse(user=_user_response(user))


@router.post('/logout', status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, session: AuthSession = Depends(get_current_session), db: Session = Depends(get_db)):
    revoke_session(db, session)
    _clear_session_cookie(response)


@router.post('/logout-all', status_code=status.HTTP_204_NO_CONTENT)
def logout_everywhere(response: Response, session: AuthSession = Depends(get_current_session), db: Session = Depends(get_db)):
    revoke_all_sessions(db, session.user)
    _clear_session_cookie(response)


@router.get('/session')
def current_session(request: Request, db: Session = Depends(get_db)) -> dict:
    """Signed-in user or ``null``. Always 200, so public pages can check without logging an error."""
    session = get_session(db, request.cookies.get(settings.session_cookie_name))
    return {'user': _user_response(session.user).model_dump(mode='json') if session and session.user else None}


@router.get('/me', response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return _user_response(user)


@router.post('/change-password', status_code=status.HTTP_204_NO_CONTENT)
def update_password(
    payload: ChangePasswordRequest,
    session: AuthSession = Depends(get_current_session),
    db: Session = Depends(get_db),
):
    try:
        change_password(db, session.user, payload.current_password, payload.new_password)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    # Every other device must sign in again with the new password.
    revoke_all_sessions(db, session.user, except_session_id=session.id)


@router.delete('/account', status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    payload: DeleteAccountRequest,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.confirm != 'DELETE':
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='Type DELETE to confirm account deletion.')
    try:
        delete_user(db, user, payload.password)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    _clear_session_cookie(response)
