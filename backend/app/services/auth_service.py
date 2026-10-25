from __future__ import annotations

import hashlib
import re
import secrets
from datetime import timedelta

from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import utcnow
from app.models.auth import AuthSession, User

PASSWORD_HASH = PasswordHash.recommended()
EMAIL_RE = re.compile(r'^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$')
# Verifying against a real hash for unknown accounts keeps login timing uniform.
_DUMMY_HASH = PASSWORD_HASH.hash('timing-equaliser-not-a-real-password')


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if not EMAIL_RE.match(normalized):
        raise ValueError('Enter a valid email address.')
    return normalized


def validate_password(password: str) -> None:
    if len(password) < 8:
        raise ValueError('Use at least 8 characters for your password.')
    if password.strip() != password or not password.strip():
        raise ValueError('Passwords cannot start or end with spaces.')


def _token_hash(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()


def create_user(db: Session, email: str, password: str) -> User:
    normalized_email = normalize_email(email)
    validate_password(password)
    if db.query(User).filter(User.email == normalized_email).first():
        raise ValueError('An account with this email already exists.')
    user = User(email=normalized_email, password_hash=PASSWORD_HASH.hash(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    try:
        normalized_email = normalize_email(email)
    except ValueError:
        PASSWORD_HASH.verify(password, _DUMMY_HASH)
        return None
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user:
        PASSWORD_HASH.verify(password, _DUMMY_HASH)
        return None
    if not PASSWORD_HASH.verify(password, user.password_hash):
        return None
    return user


def create_session(db: Session, user: User) -> tuple[str, AuthSession]:
    raw_token = secrets.token_urlsafe(32)
    session = AuthSession(
        user_id=user.id,
        token_hash=_token_hash(raw_token),
        expires_at=utcnow() + timedelta(days=settings.session_ttl_days),
    )
    db.add(session)
    # Opportunistic cleanup of this user's dead sessions.
    db.query(AuthSession).filter(AuthSession.user_id == user.id, AuthSession.expires_at <= utcnow()).delete(synchronize_session=False)
    db.commit()
    db.refresh(session)
    return raw_token, session


def get_session(db: Session, raw_token: str | None) -> AuthSession | None:
    if not raw_token or len(raw_token) > 200:
        return None
    session = db.query(AuthSession).filter(AuthSession.token_hash == _token_hash(raw_token)).first()
    if not session or session.revoked_at is not None or session.expires_at <= utcnow():
        return None
    return session


def revoke_session(db: Session, session: AuthSession) -> None:
    session.revoked_at = utcnow()
    db.commit()


def revoke_all_sessions(db: Session, user: User, *, except_session_id: int | None = None) -> int:
    query = db.query(AuthSession).filter(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
    if except_session_id is not None:
        query = query.filter(AuthSession.id != except_session_id)
    count = query.update({AuthSession.revoked_at: utcnow()}, synchronize_session=False)
    db.commit()
    return count


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not PASSWORD_HASH.verify(current_password, user.password_hash):
        raise PermissionError('Your current password is incorrect.')
    validate_password(new_password)
    if current_password == new_password:
        raise ValueError('Choose a password that is different from your current one.')
    user.password_hash = PASSWORD_HASH.hash(new_password)
    db.commit()


def delete_user(db: Session, user: User, password: str) -> None:
    """Delete the account and, through ON DELETE CASCADE, every resume, job, analysis and session."""
    if not PASSWORD_HASH.verify(password, user.password_hash):
        raise PermissionError('Your password is incorrect.')
    db.delete(user)
    db.commit()
