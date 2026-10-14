from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.auth import User
from app.models.evaluation import Evaluation


def test_registration_session_and_logout():
    client = TestClient(app)
    email = f'{uuid4().hex}@example.com'

    registered = client.post('/api/auth/register', json={'email': email, 'password': 'correct horse battery'})
    assert registered.status_code == 201
    assert registered.json()['user']['email'] == email
    assert client.get('/api/auth/me').status_code == 200

    logged_out = client.post('/api/auth/logout')
    assert logged_out.status_code == 204
    assert client.get('/api/auth/me').status_code == 401


def test_private_evaluations_require_authentication():
    client = TestClient(app)

    assert client.get('/api/evaluations').status_code == 401
    assert client.post('/api/evaluations', json={'job_title': 'Engineer', 'job_description': 'Build APIs with Python and FastAPI.'}).status_code == 401


def test_evaluation_access_is_scoped_to_owner():
    owner_client = TestClient(app)
    other_client = TestClient(app)
    owner_email = f'{uuid4().hex}@example.com'
    other_email = f'{uuid4().hex}@example.com'
    password = 'correct horse battery'

    assert owner_client.post('/api/auth/register', json={'email': owner_email, 'password': password}).status_code == 201
    assert other_client.post('/api/auth/register', json={'email': other_email, 'password': password}).status_code == 201

    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.email == owner_email).one()
        evaluation = Evaluation(
            user_id=owner.id,
            job_title='Private role',
            job_description='Private job description',
            structured_job={},
            status='pending',
        )
        db.add(evaluation)
        db.commit()
        db.refresh(evaluation)
        evaluation_id = evaluation.id
    finally:
        db.close()

    assert owner_client.get(f'/api/evaluations/{evaluation_id}').status_code == 200
    assert other_client.get(f'/api/evaluations/{evaluation_id}').status_code == 404
