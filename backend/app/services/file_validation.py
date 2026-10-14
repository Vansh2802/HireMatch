from __future__ import annotations

import uuid
from io import BytesIO
from pathlib import Path
from typing import BinaryIO
from zipfile import BadZipFile, ZipFile

from app.core.config import settings

ALLOWED_EXTENSIONS = {'.pdf', '.docx'}
READ_CHUNK_SIZE = 64 * 1024


def validate_uploaded_file(filename: str, file_bytes: bytes) -> dict:
    if not filename:
        raise ValueError('A filename is required.')

    file_path = Path(filename)
    ext = file_path.suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError('Unsupported file type. Please upload a PDF or DOCX file.')

    if len(file_bytes) == 0:
        raise ValueError('The uploaded file is empty.')

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise ValueError(f'File exceeds the {settings.max_upload_size_mb} MB upload limit.')

    if ext == '.pdf' and not file_bytes.startswith(b'%PDF'):
        raise ValueError('The file does not appear to be a valid PDF.')
    if ext == '.docx' and not file_bytes.startswith(b'PK\x03\x04'):
        raise ValueError('The file does not appear to be a valid DOCX file.')
    if ext == '.docx':
        try:
            with ZipFile(BytesIO(file_bytes)) as archive:
                names = archive.namelist()
                if len(names) > 200 or '[Content_Types].xml' not in names or 'word/document.xml' not in names:
                    raise ValueError('The file does not contain a valid DOCX document.')
                if any(Path(name).is_absolute() or '..' in Path(name).parts for name in names):
                    raise ValueError('The DOCX archive contains an unsafe path.')
                if sum(item.file_size for item in archive.infolist()) > max_bytes * 4:
                    raise ValueError('The DOCX document expands beyond the processing limit.')
        except BadZipFile as exc:
            raise ValueError('The DOCX file is malformed.') from exc

    storage_name = f'{uuid.uuid4().hex}{ext}'
    return {'extension': ext, 'storage_name': storage_name, 'size': len(file_bytes)}


def read_limited_upload(file_obj: BinaryIO) -> bytes:
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


def ensure_storage_dirs() -> None:
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.temp_dir).mkdir(parents=True, exist_ok=True)


def safe_write_bytes(file_name: str, file_bytes: bytes) -> str:
    ensure_storage_dirs()
    safe_name = Path(file_name).name
    target = Path(settings.upload_dir) / safe_name
    target.write_bytes(file_bytes)
    return str(target)


def safe_delete_file(file_path: str | None) -> None:
    if not file_path:
        return
    try:
        path = Path(file_path)
        if path.exists():
            path.unlink()
    except OSError:
        pass
