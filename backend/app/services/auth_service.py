from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.models.auth import AuthSession, User

PASSWORD_HASH = PasswordHash.recommended()
SESSION_TTL = timedelta(days=7)


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if '@' not in normalized or normalized.startswith('@') or normalized.endswith('@'):
        raise ValueError('Enter a valid email address.')
    return normalized


def create_user(db: Session, email: str, password: str) -> User:
    normalized_email = normalize_email(email)
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
        return None
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user or not PASSWORD_HASH.verify(password, user.password_hash):
        return None
    return user


def create_session(db: Session, user: User) -> tuple[str, AuthSession]:
    raw_token = secrets.token_urlsafe(32)
    session = AuthSession(
        user_id=user.id,
        token_hash=hashlib.sha256(raw_token.encode('utf-8')).hexdigest(),
        expires_at=datetime.utcnow() + SESSION_TTL,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return raw_token, session


def get_session(db: Session, raw_token: str | None) -> AuthSession | None:
    if not raw_token:
        return None
    token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
    session = db.query(AuthSession).filter(AuthSession.token_hash == token_hash).first()
    if not session or session.revoked_at is not None or session.expires_at <= datetime.utcnow():
        return None
    return session


def revoke_session(db: Session, session: AuthSession) -> None:
    session.revoked_at = datetime.utcnow()
    db.commit()
