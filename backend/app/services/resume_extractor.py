from __future__ import annotations

import json
import re

from app.core.config import settings
from app.schemas.resume import Resume


def _heuristic_extract_resume(resume_text: str) -> dict:
    lower = resume_text.lower()
    skills = []
    for token in ['python', 'sql', 'fastapi', 'react', 'javascript', 'aws', 'docker', 'postgresql', 'java', 'azure', 'kubernetes', 'typescript', 'node', 'machine learning', 'llm']:
        if token in lower:
            skills.append(token)
    email_match = re.search(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', resume_text)
    phone_match = re.search(r'(?:\+?\d[\d\s().-]{7,}\d)', resume_text)
    total_experience_years = 2.0 if '2 years' in lower else 3.0 if '3 years' in lower else 5.0 if '5 years' in lower else 1.0
    return {
        'name': 'Extracted Candidate',
        'email': email_match.group(0) if email_match else None,
        'phone': phone_match.group(0).strip() if phone_match else None,
        'total_experience_years': total_experience_years,
        'skills': skills,
        'experiences': [{'company': 'Previous Employer', 'role': 'Engineer', 'duration': '2+ years', 'description': resume_text[:200], 'skills_used': skills[:5]}],
        'education': [{'institution': 'University', 'degree': 'Bachelor\'s Degree', 'field': 'Relevant Field', 'period': '2015-2019'}],
        'projects': [{'name': 'Project', 'description': 'Demonstrated work', 'technologies': skills[:3]}],
        'certifications': [],
        'notes': [],
    }


def extract_resume_profile(resume_text: str) -> Resume:
    if settings.mock_llm and not settings.groq_api_key:
        return Resume(**_heuristic_extract_resume(resume_text))

    try:
        from groq import Groq
        client = Groq(api_key=settings.groq_api_key)
        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {'role': 'system', 'content': 'Extract a structured candidate profile. Return only valid JSON.'},
                {'role': 'user', 'content': resume_text[:12000]},
            ],
            temperature=0.2,
            response_format={'type': 'json_object'},
        )
        payload = response.choices[0].message.content
        data = json.loads(payload)
        return Resume(**data)
    except Exception:
        return Resume(**_heuristic_extract_resume(resume_text))
