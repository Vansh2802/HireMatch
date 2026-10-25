import pytest
from fastapi.testclient import TestClient
from fixtures import DOCX_MIME, RESUME_TEXT, blank_pdf_bytes, docx_bytes, register, text_pdf_bytes

from app.core.config import settings
from app.main import app
from app.services.document_parser import normalize_text, parse_uploaded_document
from app.services.file_validation import read_limited_upload, safe_display_name, validate_uploaded_file


@pytest.fixture
def client():
    client = TestClient(app)
    register(client)
    return client


def post(client, name, content, mime='application/octet-stream'):
    return client.post('/api/resumes', files={'file': (name, content, mime)})


def test_rejects_unsupported_extension(client):
    response = post(client, 'resume.txt', b'hello', 'text/plain')
    assert response.status_code == 422
    assert 'PDF or DOCX' in response.json()['detail']


def test_does_not_trust_client_mime_type(client):
    response = post(client, 'resume.pdf', b'MZ\x90\x00 not a pdf at all', 'application/pdf')
    assert response.status_code == 422
    assert 'valid PDF' in response.json()['detail']


def test_rejects_empty_file(client):
    assert 'empty' in post(client, 'resume.pdf', b'').json()['detail']


def test_rejects_scanned_pdf_without_text(client):
    response = post(client, 'scan.pdf', blank_pdf_bytes())
    assert response.status_code == 422
    assert 'scanned PDF' in response.json()['detail']


def test_rejects_password_protected_pdf(client):
    response = post(client, 'locked.pdf', blank_pdf_bytes(password='secret'))
    assert response.status_code == 422
    assert 'password-protected' in response.json()['detail']


def test_rejects_document_with_too_little_text(client):
    response = post(client, 'short.docx', docx_bytes('Jane Doe\nPython'), DOCX_MIME)
    assert response.status_code == 422
    assert 'Too little text' in response.json()['detail']


def test_rejects_malformed_docx(client):
    assert post(client, 'resume.docx', b'PK\x03\x04not-a-zip').status_code == 422


def test_oversized_request_is_rejected_before_parsing(client, monkeypatch):
    monkeypatch.setattr('app.main.MAX_UPLOAD_BODY_BYTES', 1024)
    response = post(client, 'resume.pdf', b'%PDF' + b'x' * 4096, 'application/pdf')
    assert response.status_code == 413


def test_bounded_reader_rejects_oversized_stream(monkeypatch):
    from io import BytesIO

    monkeypatch.setattr(settings, 'max_upload_size_mb', 1)
    with pytest.raises(ValueError, match='exceeds'):
        read_limited_upload(BytesIO(b'x' * (1024 * 1024 + 1)))


def test_failed_upload_creates_no_records(client):
    post(client, 'scan.pdf', blank_pdf_bytes())
    assert client.get('/api/resumes').json()['total'] == 0


def test_filenames_are_sanitised():
    assert safe_display_name('../../etc/passwd.pdf') == 'passwd.pdf'
    assert safe_display_name('C:\\Users\\me\\cv<script>.docx') == 'cvscript.docx'
    assert validate_uploaded_file('..\\..\\cv.pdf', text_pdf_bytes(RESUME_TEXT))['safe_name'] == 'cv.pdf'


def test_text_normalisation_keeps_line_structure():
    assert normalize_text('Experience\r\n\tSenior   Engineer\u00a0 \n\n\n\nSkills') == 'Experience\nSenior Engineer\n\nSkills'


def test_long_documents_are_truncated_with_warning(monkeypatch):
    monkeypatch.setattr(settings, 'max_resume_text_chars', 500)
    parsed = parse_uploaded_document('cv.docx', docx_bytes(RESUME_TEXT * 3))
    assert len(parsed['text']) == 500
    assert any('very long' in warning for warning in parsed['warnings'])
