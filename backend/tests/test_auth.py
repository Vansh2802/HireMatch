from uuid import uuid4

from fastapi.testclient import TestClient
from fixtures import create_job, register, upload_resume

from app.core.config import settings
from app.core.database import SessionLocal
from app.main import app
from app.models import Analysis, AuthSession, Job, Resume, ResumeVersion, User

PASSWORD = 'correct horse battery'


def test_registration_session_and_logout():
    client = TestClient(app)
    email = register(client)
    me = client.get('/api/auth/me')
    assert me.status_code == 200 and me.json()['email'] == email
    assert client.post('/api/auth/logout').status_code == 204
    assert client.get('/api/auth/me').status_code == 401


def test_registration_validation():
    client = TestClient(app)
    assert client.post('/api/auth/register', json={'email': 'not-an-email', 'password': PASSWORD}).status_code == 422
    assert client.post('/api/auth/register', json={'email': 'a@example.com', 'password': 'short'}).status_code == 422
    email = register(client)
    duplicate = TestClient(app).post('/api/auth/register', json={'email': email.upper(), 'password': PASSWORD})
    assert duplicate.status_code == 409


def test_session_cookie_is_httponly_and_token_is_hashed_at_rest():
    client = TestClient(app)
    response = client.post('/api/auth/register', json={'email': f'{uuid4().hex}@example.com', 'password': PASSWORD})
    cookie = response.headers['set-cookie']
    assert 'HttpOnly' in cookie and 'SameSite=lax' in cookie
    token = client.cookies.get(settings.session_cookie_name)
    db = SessionLocal()
    try:
        assert db.query(AuthSession).filter(AuthSession.token_hash == token).count() == 0
    finally:
        db.close()


def test_login_failure_is_generic_and_throttled(monkeypatch):
    client = TestClient(app)
    email = register(TestClient(app))
    wrong = client.post('/api/auth/login', json={'email': email, 'password': 'wrong password'})
    unknown = client.post('/api/auth/login', json={'email': 'nobody@example.com', 'password': 'wrong password'})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    monkeypatch.setattr(settings, 'login_attempts_per_15_minutes', 3)
    codes = [client.post('/api/auth/login', json={'email': email, 'password': 'wrong password'}).status_code for _ in range(4)]
    assert codes[-1] == 429


def test_password_change_revokes_other_sessions():
    first = TestClient(app)
    email = register(first)
    second = TestClient(app)
    assert second.post('/api/auth/login', json={'email': email, 'password': PASSWORD}).status_code == 200
    wrong = first.post('/api/auth/change-password', json={'current_password': 'nope nope', 'new_password': 'a new long password'})
    assert wrong.status_code == 403
    changed = first.post('/api/auth/change-password', json={'current_password': PASSWORD, 'new_password': 'a new long password'})
    assert changed.status_code == 204
    assert first.get('/api/auth/me').status_code == 200
    assert second.get('/api/auth/me').status_code == 401
    assert TestClient(app).post('/api/auth/login', json={'email': email, 'password': 'a new long password'}).status_code == 200


def test_logout_everywhere():
    first = TestClient(app)
    email = register(first)
    second = TestClient(app)
    second.post('/api/auth/login', json={'email': email, 'password': PASSWORD})
    assert first.post('/api/auth/logout-all').status_code == 204
    assert first.get('/api/auth/me').status_code == 401
    assert second.get('/api/auth/me').status_code == 401


def test_account_deletion_removes_all_user_data():
    client = TestClient(app)
    email = register(client)
    resume_id = upload_resume(client).json()['id']
    job_id = create_job(client).json()['id']
    assert client.post('/api/analyses', json={'resume_id': resume_id, 'job_id': job_id}).status_code == 201

    assert client.request('DELETE', '/api/auth/account', json={'password': PASSWORD, 'confirm': 'nope'}).status_code == 422
    assert client.request('DELETE', '/api/auth/account', json={'password': 'wrong password', 'confirm': 'DELETE'}).status_code == 403
    assert client.request('DELETE', '/api/auth/account', json={'password': PASSWORD, 'confirm': 'DELETE'}).status_code == 204
    assert client.get('/api/auth/me').status_code == 401

    db = SessionLocal()
    try:
        assert db.query(User).filter(User.email == email).count() == 0
        assert db.get(Resume, resume_id) is None
        assert db.get(Job, job_id) is None
        assert db.query(ResumeVersion).filter(ResumeVersion.resume_id == resume_id).count() == 0
        assert db.query(Analysis).filter(Analysis.resume_id == resume_id).count() == 0
    finally:
        db.close()


def test_cross_site_unsafe_requests_are_blocked():
    client = TestClient(app)
    register(client)
    blocked = client.post('/api/jobs', json={}, headers={'Origin': 'https://evil.example'})
    assert blocked.status_code == 403
    allowed = client.get('/api/jobs', headers={'Origin': 'https://evil.example'})
    assert allowed.status_code == 200
    same_site = client.post('/api/auth/logout', headers={'Origin': 'http://localhost:5173'})
    assert same_site.status_code == 204


def test_security_headers_present():
    response = TestClient(app).get('/api/health')
    assert response.headers['X-Content-Type-Options'] == 'nosniff'
    assert response.headers['X-Frame-Options'] == 'DENY'
    assert response.headers['Cache-Control'] == 'no-store'
    assert "frame-ancestors 'none'" in response.headers['Content-Security-Policy']


def test_session_endpoint_never_errors():
    client = TestClient(app)
    assert client.get('/api/auth/session').json() == {'user': None}
    email = register(client)
    assert client.get('/api/auth/session').json()['user']['email'] == email
