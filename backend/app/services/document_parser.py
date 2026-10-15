from __future__ import annotations

import re
from io import BytesIO
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
    try:
        reader = PdfReader(BytesIO(file_bytes))
    except Exception as exc:
        raise ValueError('The PDF file could not be parsed.') from exc
    if len(reader.pages) > settings.max_pages_per_document:
        raise ValueError(f'Document exceeds the {settings.max_pages_per_document} page limit.')
    pages = []
    for page in reader.pages:
        text = page.extract_text() or ''
        pages.append(normalize_text(text))

    text = '\n\n'.join(page for page in pages if page)
    warnings = []
    if not text:
        warnings.append('No selectable text found. OCR may be required for this PDF.')
    return {'text': text, 'pages': len(pages), 'warnings': warnings}


def extract_docx_text(file_bytes: bytes) -> dict[str, Any]:
    try:
        document = DocxDocument(BytesIO(file_bytes))
    except Exception as exc:
        raise ValueError('The DOCX file could not be parsed.') from exc
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
    estimated_pages = max(1, len(paragraphs) // 20 + 1)
    if estimated_pages > settings.max_pages_per_document:
        raise ValueError(f'Document exceeds the {settings.max_pages_per_document} page limit.')
    return {'text': text, 'pages': estimated_pages, 'warnings': [] if text else ['The document is empty or contains no readable text.']}


def parse_uploaded_document(filename: str, file_bytes: bytes) -> dict[str, Any]:
    metadata = validate_uploaded_file(filename, file_bytes)
    ext = metadata['extension']
    if ext == '.pdf':
        result = extract_pdf_text(file_bytes)
    elif ext == '.docx':
        result = extract_docx_text(file_bytes)
    else:
        raise ValueError('Unsupported file type.')
    if not result['text']:
        raise ValueError('No extractable text was found in the document.')
    result['file_name'] = filename
    result['storage_name'] = metadata['storage_name']
    result['extension'] = ext
    result['size_bytes'] = metadata['size']
    return result
