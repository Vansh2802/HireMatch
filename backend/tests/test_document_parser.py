from fixtures import RESUME_TEXT, docx_bytes, text_pdf_bytes

from app.services.document_parser import parse_uploaded_document


def test_docx_parsing_keeps_lines_and_reports_metadata():
    parsed = parse_uploaded_document('resume.docx', docx_bytes(RESUME_TEXT))
    assert parsed['text'].startswith('Jordan Rivera\nBackend Engineer')
    assert parsed['extension'] == '.docx'
    assert len(parsed['sha256']) == 64


def test_pdf_parsing_extracts_text():
    parsed = parse_uploaded_document('resume.pdf', text_pdf_bytes(RESUME_TEXT))
    assert 'Northwind Analytics' in parsed['text']
    assert parsed['pages'] == 1
