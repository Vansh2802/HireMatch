from io import BytesIO

import pytest

from app.core.rate_limit import InMemoryRateLimiter
from app.services.resume_extractor import extract_resume_profile
from app.services.file_validation import read_limited_upload, validate_uploaded_file


def test_mock_resume_extraction_does_not_fabricate_qualifications(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, 'mock_llm', True)
    resume = extract_resume_profile('Jordan Example\npython\njordan@example.com')

    assert resume.name == 'Jordan Example'
    assert resume.email == 'jordan@example.com'
    assert resume.total_experience_years is None
    assert resume.experiences == []
    assert resume.education == []
    assert resume.projects == []
    assert resume.certifications == []
    assert resume.notes and 'Mock mode' in resume.notes[0]


def test_bounded_upload_reader_rejects_oversized_stream(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, 'max_upload_size_mb', 1)
    with pytest.raises(ValueError, match='exceeds'):
        read_limited_upload(BytesIO(b'x' * (1024 * 1024 + 1)))


def test_docx_validation_rejects_malformed_zip():
    with pytest.raises(ValueError, match='malformed|valid DOCX'):
        validate_uploaded_file('resume.docx', b'PK\x03\x04not-a-zip')


def test_in_memory_rate_limiter_returns_false_after_limit():
    limiter = InMemoryRateLimiter()

    assert limiter.allow('test-client', 1)
    assert not limiter.allow('test-client', 1)
