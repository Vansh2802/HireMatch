import pytest

from app.services.file_validation import validate_uploaded_file


def test_validate_upload_rejects_invalid_format():
    with pytest.raises(ValueError):
        validate_uploaded_file('bad.txt', b'hello')
