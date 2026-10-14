from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from docx import Document as DocxDocument
from pypdf import PdfReader

from app.core.config import settings
from app.services.file_validation import validate_uploaded_file


def normalize_text(raw_text: str) -> str:
    cleaned = raw_text.replace('\x00', ' ')
    cleaned = cleaned.replace('\r', '\n')
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    cleaned = re.sub(r'[\t\u00a0]+', ' ', cleaned)
    cleaned = re.sub(r'\s{2,}', ' ', cleaned)
    return cleaned.strip()


def extract_pdf_text(file_bytes: bytes) -> dict[str, Any]:
    temp_pdf = Path(settings.temp_dir) / 'temp.pdf'
    temp_pdf.write_bytes(file_bytes)
    try:
        reader = PdfReader(str(temp_pdf))
        pages = []
        for page in reader.pages:
            text = page.extract_text() or ''
            pages.append(normalize_text(text))

        text = '\n\n'.join(page for page in pages if page)
        warnings = []
        if not text:
            warnings.append('No selectable text found. OCR may be required for this PDF.')
        return {'text': text, 'pages': len(pages), 'warnings': warnings}
    finally:
        if temp_pdf.exists():
            temp_pdf.unlink(missing_ok=True)


def extract_docx_text(file_bytes: bytes) -> dict[str, Any]:
    temp_docx = Path(settings.temp_dir) / 'temp.docx'
    temp_docx.write_bytes(file_bytes)
    try:
        document = DocxDocument(str(temp_docx))
        paragraphs = []
        for paragraph in document.paragraphs:
            if paragraph.text.strip():
                paragraphs.append(normalize_text(paragraph.text))
        for table in document.tables:
            for row in table.rows:
                text = ' | '.join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if text:
                    paragraphs.append(normalize_text(text))
        text = '\n\n'.join(paragraphs)
        return {'text': text, 'pages': max(1, len(paragraphs) // 20 + 1), 'warnings': [] if text else ['The document is empty or contains no readable text.']}
    finally:
        if temp_docx.exists():
            temp_docx.unlink(missing_ok=True)


def parse_uploaded_document(filename: str, file_bytes: bytes) -> dict[str, Any]:
    metadata = validate_uploaded_file(filename, file_bytes)
    ext = metadata['extension']
    if ext == '.pdf':
        result = extract_pdf_text(file_bytes)
    elif ext == '.docx':
        result = extract_docx_text(file_bytes)
    else:
        raise ValueError('Unsupported file type.')
    result['file_name'] = filename
    result['storage_name'] = metadata['storage_name']
    result['extension'] = ext
    result['size_bytes'] = metadata['size']
    return result
