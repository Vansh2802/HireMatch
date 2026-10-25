"""Synthetic test data. All people, companies and contact details are fictional."""

from io import BytesIO

from docx import Document

RESUME_TEXT = """Jordan Rivera
Backend Engineer
jordan.rivera@example.com | +1 (555) 010-2233 | Austin, TX

Summary
Backend engineer with 6 years of experience building data-heavy web services in Python.

Experience
Senior Software Engineer | Northwind Analytics
Mar 2021 – Present
• Designed and built REST APIs in Python and FastAPI serving 2M requests per day
• Migrated reporting workloads from MySQL to PostgreSQL, cutting query latency by 40%
• Containerised services with Docker and deployed them to AWS ECS with GitHub Actions
• Mentored three junior engineers and led code reviews

Software Engineer | Contoso Retail
Jun 2018 – Feb 2021
• Built Django services for order processing and inventory
• Wrote ETL pipelines in Python and SQL feeding the analytics warehouse
• Added unit tests with pytest, raising coverage from 45% to 85%

Education
B.S. in Computer Science
University of Texas at Austin, 2014 – 2018

Skills
Python, FastAPI, Django, PostgreSQL, MySQL, Docker, AWS, Git, pytest, REST APIs, Linux

Certifications
AWS Certified Developer – Associate (2022)
"""

JOB_DESCRIPTION = """Senior Backend Engineer – Payments Platform

About the role
We are looking for a backend engineer to build and scale the APIs behind our payments platform.

Responsibilities
- Design, build and maintain REST APIs in Python
- Own services end to end, from design to deployment on AWS
- Improve the performance and reliability of PostgreSQL-backed services
- Mentor engineers and lead code reviews

Requirements
- 5+ years of professional software engineering experience
- Strong Python and FastAPI or Django experience
- Experience with PostgreSQL and SQL
- Hands-on experience with Docker and Kubernetes
- Bachelor's degree in Computer Science or equivalent experience

Nice to have
- Experience with Kafka or other event streaming systems
- Terraform
- AWS Certified Developer or Solutions Architect certification

Benefits
Health insurance, Python conference budget, remote-friendly.
"""


def docx_bytes(text: str) -> bytes:
    buffer = BytesIO()
    document = Document()
    for line in text.split('\n'):
        document.add_paragraph(line)
    document.save(buffer)
    return buffer.getvalue()


DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'


def text_pdf_bytes(text: str) -> bytes:
    """Build a minimal, valid single-page PDF whose text pypdf can extract."""
    def escape(value: str) -> str:
        return value.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

    lines = [line.encode('latin-1', 'replace').decode('latin-1') for line in text.split('\n')]
    stream = 'BT /F1 9 Tf 11 TL 40 800 Td\n' + '\n'.join(f'({escape(line)}) Tj T*' for line in lines) + '\nET'
    objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        f'<< /Length {len(stream.encode("latin-1"))} >>\nstream\n{stream}\nendstream',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
    out = b'%PDF-1.4\n'
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f'{number} 0 obj\n{body}\nendobj\n'.encode('latin-1')
    xref = len(out)
    out += f'xref\n0 {len(objects) + 1}\n0000000000 65535 f \n'.encode()
    out += ''.join(f'{offset:010d} 00000 n \n' for offset in offsets).encode()
    out += f'trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    return out


def blank_pdf_bytes(*, password: str | None = None) -> bytes:
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    if password:
        writer.encrypt(password)
    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def register(client, email: str | None = None, password: str = 'correct horse battery'):
    from uuid import uuid4

    email = email or f'{uuid4().hex[:12]}@example.com'
    response = client.post('/api/auth/register', json={'email': email, 'password': password})
    assert response.status_code == 201, response.text
    return email


def upload_resume(client, text: str = RESUME_TEXT, name: str = 'jordan_rivera.docx'):
    return client.post('/api/resumes', files={'file': (name, docx_bytes(text), DOCX_MIME)})


def create_job(client, title: str = 'Senior Backend Engineer', description: str = JOB_DESCRIPTION, company: str | None = 'Example Payments'):
    return client.post('/api/jobs', json={'title': title, 'company': company, 'description': description})
