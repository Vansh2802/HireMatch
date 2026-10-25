from __future__ import annotations

import logging
import re
from io import BytesIO
from typing import Any

from docx import Document as DocxDocument
from pypdf import PdfReader

from app.core.config import settings
from app.services.file_validation import validate_uploaded_file

logger = logging.getLogger(__name__)

# A resume with less extractable text than this is almost certainly a scan or an
# image-only export; scoring it would produce misleading "not found" results.
MIN_USEFUL_TEXT_CHARS = 200


class DocumentParseError(ValueError):
    """A user-facing document problem (safe to show to the uploader)."""


def normalize_text(raw_text: str) -> str:
    """Normalise whitespace while keeping line structure (needed for sections and evidence)."""
    cleaned = raw_text.replace('\x00', ' ').replace('\r\n', '\n').replace('\r', '\n')
    cleaned = cleaned.replace(' ', ' ').replace('\t', ' ')
    cleaned = re.sub(r'[•●▪‣⁃]', '•', cleaned)
    cleaned = re.sub(r'[ \f\v]{2,}', ' ', cleaned)
    cleaned = '\n'.join(line.strip() for line in cleaned.split('\n'))
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    return cleaned.strip()


def extract_pdf_text(file_bytes: bytes) -> dict[str, Any]:
    try:
        reader = PdfReader(BytesIO(file_bytes))
    except Exception as exc:
        raise DocumentParseError('The PDF file could not be read. It may be corrupted.') from exc
    if reader.is_encrypted:
        try:
            # Many PDFs are "encrypted" with an empty owner password only.
            if not reader.decrypt(''):
                raise DocumentParseError('This PDF is password-protected. Remove the password and upload it again.')
        except DocumentParseError:
            raise
        except Exception as exc:
            raise DocumentParseError('This PDF is password-protected. Remove the password and upload it again.') from exc
    try:
        page_count = len(reader.pages)
    except Exception as exc:
        raise DocumentParseError('The PDF file could not be read. It may be corrupted.') from exc
    if page_count > settings.max_pages_per_document:
        raise DocumentParseError(f'The document has {page_count} pages; the limit is {settings.max_pages_per_document}.')
    pages: list[str] = []
    failed_pages = 0
    for page in reader.pages:
        try:
            pages.append(normalize_text(page.extract_text() or ''))
        except Exception:
            failed_pages += 1
            logger.warning('PDF page text extraction failed', exc_info=True)
    text = '\n\n'.join(page for page in pages if page)
    warnings = []
    if failed_pages:
        warnings.append(f'{failed_pages} page(s) could not be read and were skipped.')
    return {'text': text, 'pages': page_count, 'warnings': warnings}


def extract_docx_text(file_bytes: bytes) -> dict[str, Any]:
    try:
        document = DocxDocument(BytesIO(file_bytes))
    except Exception as exc:
        raise DocumentParseError('The DOCX file could not be read. It may be corrupted.') from exc
    blocks: list[str] = []
    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if text:
            style = (paragraph.style.name if paragraph.style is not None else '') or ''
            prefix = '• ' if 'List' in style and not text.startswith('•') else ''
            blocks.append(normalize_text(prefix + text))
    for table in document.tables:
        for row in table.rows:
            cells: list[str] = []
            for cell in row.cells:
                value = cell.text.strip()
                if value and value not in cells:
                    cells.append(value)
            if cells:
                blocks.append(normalize_text(' | '.join(cells)))
    text = '\n'.join(blocks)
    estimated_pages = max(1, len(text) // 3000 + 1)
    if estimated_pages > settings.max_pages_per_document:
        raise DocumentParseError(f'The document is longer than the {settings.max_pages_per_document} page limit.')
    return {'text': text, 'pages': estimated_pages, 'warnings': []}


def parse_uploaded_document(filename: str, file_bytes: bytes) -> dict[str, Any]:
    """Validate and extract text. Raises ``ValueError`` with a safe message on any failure."""
    metadata = validate_uploaded_file(filename, file_bytes)
    ext = metadata['extension']
    if ext == '.pdf':
        result = extract_pdf_text(file_bytes)
    elif ext == '.docx':
        result = extract_docx_text(file_bytes)
    else:  # pragma: no cover - validate_uploaded_file already restricts extensions
        raise DocumentParseError('Unsupported file type.')

    text: str = result['text']
    if not text:
        if ext == '.pdf':
            raise DocumentParseError('No selectable text was found. This looks like a scanned PDF; export a text-based PDF or upload a DOCX.')
        raise DocumentParseError('The document is empty or contains no readable text.')
    if len(text) < MIN_USEFUL_TEXT_CHARS:
        raise DocumentParseError('Too little text could be extracted to analyse this document. If it is a scan or an image, upload a text-based PDF or DOCX.')
    if len(text) > settings.max_resume_text_chars:
        result['warnings'].append(
            f'The document is very long; only the first {settings.max_resume_text_chars:,} characters are analysed.'
        )
        text = text[: settings.max_resume_text_chars]

    result['text'] = text
    result['file_name'] = metadata['safe_name']
    result['extension'] = ext
    result['size_bytes'] = metadata['size']
    result['sha256'] = metadata['sha256']
    return result
