from __future__ import annotations

import hashlib
import re
import unicodedata
from io import BytesIO
from pathlib import PurePath
from typing import BinaryIO
from zipfile import BadZipFile, ZipFile

from app.core.config import settings

ALLOWED_EXTENSIONS = {'.pdf', '.docx'}
READ_CHUNK_SIZE = 64 * 1024
MAX_DOCX_ENTRIES = 500


def safe_display_name(filename: str) -> str:
    """Strip any path components and control characters from a client-supplied filename."""
    name = PurePath(filename.replace('\\', '/')).name
    name = unicodedata.normalize('NFKC', name)
    name = re.sub(r'[\x00-\x1f\x7f<>:"|?*]', '', name).strip(' .')
    return name[:200] or 'resume'


def validate_uploaded_file(filename: str, file_bytes: bytes) -> dict:
    """Validate extension, size and actual file content. Never trusts the client MIME type."""
    if not filename:
        raise ValueError('A filename is required.')

    safe_name = safe_display_name(filename)
    ext = PurePath(safe_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError('Unsupported file type. Please upload a PDF or DOCX file.')

    if len(file_bytes) == 0:
        raise ValueError('The uploaded file is empty.')

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise ValueError(f'File exceeds the {settings.max_upload_size_mb} MB upload limit.')

    if ext == '.pdf' and not file_bytes[:1024].lstrip().startswith(b'%PDF'):
        raise ValueError('The file does not appear to be a valid PDF.')
    if ext == '.docx' and not file_bytes.startswith(b'PK\x03\x04'):
        raise ValueError('The file does not appear to be a valid DOCX file.')
    if ext == '.docx':
        try:
            with ZipFile(BytesIO(file_bytes)) as archive:
                infos = archive.infolist()
                names = [info.filename for info in infos]
                if len(names) > MAX_DOCX_ENTRIES or '[Content_Types].xml' not in names or 'word/document.xml' not in names:
                    raise ValueError('The file does not contain a valid DOCX document.')
                if any(name.startswith('/') or '..' in PurePath(name).parts for name in names):
                    raise ValueError('The DOCX archive contains an unsafe path.')
                if sum(info.file_size for info in infos) > max_bytes * 10:
                    raise ValueError('The DOCX document expands beyond the processing limit.')
                if any(info.compress_size and info.file_size / info.compress_size > 200 for info in infos):
                    raise ValueError('The DOCX document has an unsafe compression ratio.')
        except BadZipFile as exc:
            raise ValueError('The DOCX file is malformed.') from exc

    return {
        'extension': ext,
        'safe_name': safe_name,
        'size': len(file_bytes),
        'sha256': hashlib.sha256(file_bytes).hexdigest(),
    }


def read_limited_upload(file_obj: BinaryIO) -> bytes:
    """Read an upload in chunks and stop as soon as the configured limit is exceeded."""
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = file_obj.read(min(READ_CHUNK_SIZE, max_bytes + 1 - total))
        if not chunk:
            break
        chunks.append(chunk)
        total += len(chunk)
        if total > max_bytes:
            raise ValueError(f'File exceeds the {settings.max_upload_size_mb} MB upload limit.')
    return b''.join(chunks)
