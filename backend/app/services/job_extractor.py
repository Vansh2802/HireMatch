from __future__ import annotations

import json
import re

from app.core.config import settings
from app.schemas.job import JobRequirements


def _heuristic_extract_job(job_title: str, job_description: str) -> dict:
    text = job_description.lower()
    required_skills = sorted({word.strip().lower() for word in re.findall(r'[A-Za-z][A-Za-z+.#/ -]{2,}', text) if word.lower() in {
        'python', 'sql', 'fastapi', 'javascript', 'react', 'java', 'aws', 'docker', 'kubernetes', 'postgresql', 'data science', 'machine learning', 'etl', 'tableau', 'power bi', 'typescript', 'node', 'c#', 'azure', 'devops', 'agile', 'ai', 'llm'
    }})
    preferred = ['sql', 'docker']
    minimum_experience = 3 if '3+ years' in text or 'minimum 3 years' in text else 0
    education = ['Bachelor\'s degree in a related field'] if 'bachelor' in text else []
    responsibilities = [seg.strip() for seg in re.split(r'\.|\n', job_description) if 10 < len(seg.strip()) < 220][:5]
    return {
        'role': job_title,
        'required_skills': required_skills,
        'preferred_skills': preferred,
        'minimum_experience': minimum_experience,
        'education_requirements': education,
        'responsibilities': responsibilities,
        'required_qualifications': [],
        'preferred_qualifications': [],
        'relevant_certifications': [],
        'seniority': 'mid-level' if 'senior' not in text else 'senior',
        'explicit_experience_requirements': f'{minimum_experience}+ years' if minimum_experience else None,
    }


def extract_job_requirements(job_title: str, job_description: str) -> JobRequirements:
    if settings.mock_llm:
        return JobRequirements(**_heuristic_extract_job(job_title, job_description))
    if not settings.groq_api_key:
        raise RuntimeError('GROQ_API_KEY is required when MOCK_LLM is false.')

    try:
        from groq import Groq
        client = Groq(api_key=settings.groq_api_key)
        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {'role': 'system', 'content': 'You extract structured hiring requirements from text. Return strict JSON only.'},
                {'role': 'user', 'content': f'Job title: {job_title}\n\nJob description:\n{job_description}'},
            ],
            temperature=0.2,
            response_format={'type': 'json_object'},
        )
        payload = response.choices[0].message.content
        data = json.loads(payload)
        return JobRequirements(**data)
    except Exception as exc:
        raise RuntimeError('Job requirement extraction failed. Enable MOCK_LLM for offline development.') from exc
