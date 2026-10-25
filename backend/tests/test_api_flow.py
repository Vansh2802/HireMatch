"""End-to-end API journey with the deterministic extractor (no external services)."""

from fastapi.testclient import TestClient
from fixtures import JOB_DESCRIPTION, RESUME_TEXT, create_job, docx_bytes, register, text_pdf_bytes, upload_resume

from app.main import app


def test_full_job_seeker_journey():
    client = TestClient(app)
    register(client)

    dashboard = client.get('/api/dashboard').json()
    assert dashboard['counts'] == {'resumes': 0, 'jobs': 0, 'analyses': 0}
    assert dashboard['average_best_score'] is None
    assert dashboard['onboarding'] == {'has_resume': False, 'has_job': False, 'has_analysis': False, 'dismissed': False}

    uploaded = upload_resume(client)
    assert uploaded.status_code == 202, uploaded.text
    resume_id = uploaded.json()['id']
    assert uploaded.json()['title'] == 'jordan rivera'
    # Background extraction has run by the time TestClient returns; poll like the browser does.
    resume = client.get(f'/api/resumes/{resume_id}').json()
    version = resume['current_version']
    assert version['status'] == 'ready'
    assert version['profile']['name'] == 'Jordan Rivera'
    assert 'Northwind Analytics' in version['raw_text']

    created = create_job(client)
    assert created.status_code == 202, created.text
    job_id = created.json()['id']
    job = client.get(f'/api/jobs/{job_id}').json()
    assert job['status'] == 'ready'
    assert job['revision'] == 1
    assert any(r['skill'] == 'kubernetes' for r in job['profile']['requirements'])

    analysis = client.post('/api/analyses', json={'resume_id': resume_id, 'job_id': job_id})
    assert analysis.status_code == 201, analysis.text
    first = analysis.json()
    assert first['scoring_version'] == '2.0'
    assert isinstance(first['score'], int)
    assert first['result']['requirements']
    assert first['is_current_resume_version'] and first['is_current_job_revision']

    # Repeating the same request (double click, retry) returns the same analysis.
    repeat = client.post('/api/analyses', json={'resume_id': resume_id, 'job_id': job_id})
    assert repeat.status_code == 200 and repeat.json()['id'] == first['id']

    # History survives a "refresh".
    history = client.get('/api/analyses').json()
    assert history['total'] == 1 and history['items'][0]['id'] == first['id']

    # Editing the job description creates a new revision; the old analysis is unchanged.
    edited_description = JOB_DESCRIPTION.replace('- Terraform\n', '- Terraform\n- Experience with Go\n')
    patched = client.patch(f'/api/jobs/{job_id}', json={'description': edited_description, 'stage': 'applied', 'notes': 'Referred by a former colleague'})
    assert patched.status_code == 200
    job = client.get(f'/api/jobs/{job_id}').json()
    assert job['revision'] == 2 and job['stage'] == 'applied' and job['applied_on'] is not None
    old = client.get(f'/api/analyses/{first["id"]}').json()
    assert old['score'] == first['score'] and old['job_snapshot']['description'] == JOB_DESCRIPTION.strip()
    assert old['is_current_job_revision'] is False

    second = client.post('/api/analyses', json={'resume_id': resume_id, 'job_id': job_id})
    assert second.status_code == 201 and second.json()['id'] != first['id']

    # Correcting the extracted profile creates a new resume version.
    profile = version['profile']
    profile['skills'] = [*profile['skills'], 'Kubernetes']
    saved = client.put(f'/api/resumes/{resume_id}/profile', json={'profile': profile, 'base_version_id': version['id']})
    assert saved.status_code == 201, saved.text
    assert saved.json()['current_version']['version_number'] == 2
    stale = client.put(f'/api/resumes/{resume_id}/profile', json={'profile': profile, 'base_version_id': version['id']})
    assert stale.status_code == 409

    third = client.post('/api/analyses', json={'resume_id': resume_id, 'job_id': job_id}).json()
    kubernetes = next(r for r in third['result']['requirements'] if r['text'] == 'Kubernetes')
    assert kubernetes['status'] == 'partial'  # in the profile, not in the document text
    assert third['resume_version_number'] == 2

    # A specific older version can still be analysed explicitly.
    pinned = client.post('/api/analyses', json={'resume_id': resume_id, 'job_id': job_id, 'resume_version_id': version['id']})
    assert pinned.status_code == 200 and pinned.json()['id'] == second.json()['id']

    dashboard = client.get('/api/dashboard').json()
    assert dashboard['counts'] == {'resumes': 1, 'jobs': 1, 'analyses': 3}
    assert dashboard['average_best_score'] == max(a['score'] for a in client.get('/api/analyses').json()['items'])
    assert dashboard['stages']['applied'] == 1

    filtered = client.get('/api/analyses', params={'job_id': job_id, 'sort': 'score'}).json()
    assert filtered['total'] == 3

    # Deleting the job keeps analyses readable via their snapshot.
    assert client.delete(f'/api/jobs/{job_id}').status_code == 204
    kept = client.get(f'/api/analyses/{first["id"]}').json()
    assert kept['job_id'] is None and kept['job_title'] == 'Senior Backend Engineer'

    # Deleting the resume removes its analyses too (they contain its content).
    assert client.delete(f'/api/resumes/{resume_id}').status_code == 204
    assert client.get('/api/analyses').json()['total'] == 0
    assert client.get(f'/api/analyses/{first["id"]}').status_code == 404


def test_pdf_upload_and_new_version_flow():
    client = TestClient(app)
    register(client)
    response = client.post('/api/resumes', files={'file': ('cv.pdf', text_pdf_bytes(RESUME_TEXT), 'application/pdf')}, data={'title': 'Backend CV'})
    assert response.status_code == 202, response.text
    resume = response.json()
    assert resume['title'] == 'Backend CV'
    assert resume['current_version']['page_count'] == 1

    updated_text = RESUME_TEXT.replace('Linux', 'Linux, Kubernetes')
    new_version = client.post(f'/api/resumes/{resume["id"]}/versions', files={'file': ('cv-v2.docx', docx_bytes(updated_text), 'application/octet-stream')})
    assert new_version.status_code == 202
    detail = client.get(f'/api/resumes/{resume["id"]}').json()
    assert detail['version_count'] == 2
    assert detail['current_version']['version_number'] == 2
    assert 'Kubernetes' in detail['current_version']['profile']['skills']

    renamed = client.patch(f'/api/resumes/{resume["id"]}', json={'title': 'Platform CV'})
    assert renamed.json()['title'] == 'Platform CV'
    listing = client.get('/api/resumes', params={'q': 'platform'}).json()
    assert listing['total'] == 1 and listing['items'][0]['version_count'] == 2


def test_requirement_editing_creates_new_revision():
    client = TestClient(app)
    register(client)
    job = create_job(client).json()
    job = client.get(f'/api/jobs/{job["id"]}').json()
    requirements = job['profile']['requirements']
    keep = [{'id': r['id'], 'importance': 'preferred' if r['skill'] == 'kubernetes' else r['importance']}
            for r in requirements if r['skill'] != 'terraform']
    response = client.put(f'/api/jobs/{job["id"]}/requirements', json={'keep': keep, 'base_revision': job['revision']})
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated['revision'] == 2
    skills = {r['skill']: r for r in updated['profile']['requirements'] if r['category'] == 'skill'}
    assert 'terraform' not in skills
    assert skills['kubernetes']['importance'] == 'preferred'
    conflict = client.put(f'/api/jobs/{job["id"]}/requirements', json={'keep': keep, 'base_revision': 1})
    assert conflict.status_code == 409


def test_job_list_filters_and_validation():
    client = TestClient(app)
    register(client)
    create_job(client, title='Data Engineer', company='Acme')
    create_job(client, title='Platform Engineer', company='Globex')
    jobs = client.get('/api/jobs', params={'q': 'globex'}).json()
    assert jobs['total'] == 1 and jobs['items'][0]['title'] == 'Platform Engineer'
    assert client.get('/api/jobs', params={'stage': 'interested'}).json()['total'] == 2
    assert client.get('/api/jobs', params={'stage': 'bogus'}).status_code == 422
    assert client.get('/api/jobs', params={'limit': 1}).json()['items'].__len__() == 1
    short = client.post('/api/jobs', json={'title': 'X', 'description': 'too short'})
    assert short.status_code == 422
    bad_url = client.post('/api/jobs', json={'title': 'X', 'description': JOB_DESCRIPTION, 'url': 'javascript:alert(1)'})
    assert bad_url.status_code == 422


def test_analysis_requires_processed_inputs():
    client = TestClient(app)
    register(client)
    resume_id = upload_resume(client).json()['id']
    job_id = create_job(client).json()['id']
    from app.core.database import SessionLocal
    from app.models.job import Job

    db = SessionLocal()
    db.get(Job, job_id).status = 'failed'
    db.commit()
    db.close()
    response = client.post('/api/analyses', json={'resume_id': resume_id, 'job_id': job_id})
    assert response.status_code == 409
    assert 'Retry extraction' in response.json()['detail']
    retried = client.post(f'/api/jobs/{job_id}/retry')
    assert retried.status_code == 202
    assert client.get(f'/api/jobs/{job_id}').json()['status'] == 'ready'
    assert client.post('/api/analyses', json={'resume_id': resume_id, 'job_id': job_id}).status_code == 201
