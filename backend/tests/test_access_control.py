"""Every private resource must be invisible to other users (404, never 403, to avoid id probing)."""

from fastapi.testclient import TestClient
from fixtures import create_job, docx_bytes, register, upload_resume, RESUME_TEXT, DOCX_MIME

from app.main import app


def _setup_owner():
    owner = TestClient(app)
    register(owner)
    resume = upload_resume(owner).json()
    job = create_job(owner).json()
    analysis = owner.post('/api/analyses', json={'resume_id': resume['id'], 'job_id': job['id']}).json()
    return owner, resume, job, analysis


def test_unauthenticated_requests_are_rejected():
    client = TestClient(app)
    for method, path in [
        ('get', '/api/resumes'), ('get', '/api/jobs'), ('get', '/api/analyses'), ('get', '/api/dashboard'),
        ('post', '/api/jobs'), ('post', '/api/analyses'), ('delete', '/api/resumes/1'),
    ]:
        assert getattr(client, method)(path).status_code == 401, path


def test_other_users_cannot_read_modify_or_use_private_records():
    owner, resume, job, analysis = _setup_owner()
    version_id = resume['current_version']['id']
    intruder = TestClient(app)
    register(intruder)

    attempts = [
        intruder.get(f'/api/resumes/{resume["id"]}'),
        intruder.patch(f'/api/resumes/{resume["id"]}', json={'title': 'mine'}),
        intruder.get(f'/api/resumes/{resume["id"]}/versions/{version_id}'),
        intruder.post(f'/api/resumes/{resume["id"]}/versions/{version_id}/retry'),
        intruder.put(f'/api/resumes/{resume["id"]}/profile', json={'profile': {}}),
        intruder.post(f'/api/resumes/{resume["id"]}/versions', files={'file': ('x.docx', docx_bytes(RESUME_TEXT + ' extra'), DOCX_MIME)}),
        intruder.delete(f'/api/resumes/{resume["id"]}'),
        intruder.get(f'/api/jobs/{job["id"]}'),
        intruder.patch(f'/api/jobs/{job["id"]}', json={'stage': 'archived'}),
        intruder.put(f'/api/jobs/{job["id"]}/requirements', json={'keep': [], 'base_revision': 1}),
        intruder.post(f'/api/jobs/{job["id"]}/retry'),
        intruder.delete(f'/api/jobs/{job["id"]}'),
        intruder.get(f'/api/analyses/{analysis["id"]}'),
        intruder.delete(f'/api/analyses/{analysis["id"]}'),
        intruder.post('/api/analyses', json={'resume_id': resume['id'], 'job_id': job['id']}),
    ]
    assert [r.status_code for r in attempts] == [404] * len(attempts)

    # Listing endpoints never leak other users' rows, even with explicit filters.
    assert intruder.get('/api/resumes').json()['total'] == 0
    assert intruder.get('/api/jobs').json()['total'] == 0
    assert intruder.get('/api/analyses', params={'resume_id': resume['id']}).json()['total'] == 0
    assert intruder.get('/api/dashboard').json()['counts'] == {'resumes': 0, 'jobs': 0, 'analyses': 0}

    # Mixing one's own job with someone else's resume is also rejected.
    own_job = create_job(intruder).json()
    assert intruder.post('/api/analyses', json={'resume_id': resume['id'], 'job_id': own_job['id']}).status_code == 404

    # The owner's data is intact.
    assert owner.get(f'/api/resumes/{resume["id"]}').json()['title'] == resume['title']
    assert owner.get(f'/api/jobs/{job["id"]}').json()['stage'] == 'interested'
    assert owner.get(f'/api/analyses/{analysis["id"]}').status_code == 200


def test_duplicate_uploads_are_per_user():
    owner = TestClient(app)
    register(owner)
    assert upload_resume(owner).status_code == 202
    duplicate = upload_resume(owner)
    assert duplicate.status_code == 409
    assert 'already uploaded' in duplicate.json()['detail']['message']
    other = TestClient(app)
    register(other)
    assert upload_resume(other).status_code == 202
