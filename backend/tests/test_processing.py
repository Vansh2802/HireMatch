from datetime import timedelta

from fastapi.testclient import TestClient
from fixtures import create_job, register, upload_resume

from app.core.database import SessionLocal, utcnow
from app.main import app
from app.models import Job, ResumeVersion
from app.services import processing
from app.services.llm_service import LLMRateLimitError


def test_provider_failure_marks_version_failed_with_safe_message_and_retry_recovers(monkeypatch):
    client = TestClient(app)
    register(client)

    def boom(_text):
        raise LLMRateLimitError('OpenRouter rate limit reached (internal detail)')

    monkeypatch.setattr(processing, 'extract_resume_profile', boom)
    resume = upload_resume(client).json()
    version = client.get(f'/api/resumes/{resume["id"]}').json()['current_version']
    assert version['status'] == 'failed'
    assert version['error_message'] == LLMRateLimitError.public_message
    assert 'internal' not in version['error_message']

    job_id = create_job(client).json()['id']
    blocked = client.post('/api/analyses', json={'resume_id': resume['id'], 'job_id': job_id})
    assert blocked.status_code == 409

    monkeypatch.undo()
    retried = client.post(f'/api/resumes/{resume["id"]}/versions/{version["id"]}/retry')
    assert retried.status_code == 202
    assert client.get(f'/api/resumes/{resume["id"]}').json()['current_version']['status'] == 'ready'
    assert client.post(f'/api/resumes/{resume["id"]}/versions/{version["id"]}/retry').status_code == 409


def test_unexpected_errors_are_not_exposed(monkeypatch):
    client = TestClient(app)
    register(client)
    monkeypatch.setattr(processing, 'extract_job_profile', lambda *_: (_ for _ in ()).throw(RuntimeError('secret stack detail')))
    job = create_job(client).json()
    detail = client.get(f'/api/jobs/{job["id"]}').json()
    assert detail['status'] == 'failed'
    assert 'secret' not in detail['error_message']


def test_superseded_job_extraction_does_not_overwrite_newer_revision():
    client = TestClient(app)
    register(client)
    job = client.get(f'/api/jobs/{create_job(client).json()["id"]}').json()
    db = SessionLocal()
    try:
        row = db.get(Job, job['id'])
        row.status, row.revision = 'processing', 5
        db.commit()
    finally:
        db.close()
    processing.process_job(job['id'], revision=4)  # an older task finishing late
    assert client.get(f'/api/jobs/{job["id"]}').json()['status'] == 'processing'


def test_stale_processing_is_expired():
    client = TestClient(app)
    register(client)
    resume = upload_resume(client).json()
    db = SessionLocal()
    try:
        version = db.get(ResumeVersion, resume['current_version']['id'])
        version.status, version.processing_started_at = 'processing', utcnow() - timedelta(hours=2)
        db.commit()
        assert processing.expire_stale(db) >= 1
        db.refresh(version)
        assert version.status == 'failed' and 'interrupted' in version.error_message
    finally:
        db.close()
