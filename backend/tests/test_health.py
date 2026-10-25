from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_reports_non_secret_state():
    data = TestClient(app).get('/api/health').json()
    assert data['status'] == 'ok'
    assert data['scoring_version'] == '2.0'
    assert data['dependencies']['database'] == 'ok'
    assert data['dependencies']['llm'] == 'mock'
    assert 'key' not in str(data).lower()
