from datetime import date

import httpx
import pytest
from fixtures import JOB_DESCRIPTION, RESUME_TEXT

from app.core.config import settings
from app.services import job_extractor, resume_extractor
from app.services.job_extractor import heuristic_job_profile
from app.services.llm_service import OpenRouterClient
from app.services.resume_extractor import extract_resume_profile, find_phone, redact_contact_details
from app.services.text_analysis import degree_level, estimate_experience


def test_resume_heuristic_extracts_contact_skills_and_roles():
    result = extract_resume_profile(RESUME_TEXT)
    profile = result.profile
    assert result.method == 'heuristic'
    assert profile.name == 'Jordan Rivera'
    assert profile.email == 'jordan.rivera@example.com'
    assert profile.phone == '+1 (555) 010-2233'
    assert {'Python', 'FastAPI', 'PostgreSQL', 'Docker', 'AWS'} <= set(profile.skills)
    assert [e.company for e in profile.experiences] == ['Northwind Analytics', 'Contoso Retail']
    assert profile.experiences[0].end == 'Present'
    assert profile.education and 'Computer Science' in profile.education[0].degree
    assert profile.certifications == ['AWS Certified Developer – Associate (2022)']


def test_experience_merges_overlapping_roles_and_ignores_education_dates():
    text = 'Experience\nEngineer, A\nJan 2018 - Dec 2020\nConsultant, B\nJan 2019 - Dec 2019\nEducation\nBSc, Uni\n2010 - 2014'
    result = estimate_experience(text, today=date(2026, 1, 1))
    assert result['years'] == 3.0
    assert result['source'] == 'date_ranges'


def test_experience_falls_back_to_stated_years_and_never_guesses():
    assert estimate_experience('Analyst with 7+ years of experience in finance.')['years'] == 7
    unknown = estimate_experience('Analyst who loves spreadsheets.')
    assert unknown['years'] is None and unknown['source'] is None


def test_stated_and_dated_mismatch_produces_warning():
    text = 'Summary\n10 years of experience\nExperience\nDev, A\nJan 2022 - Jan 2024'
    assert 'add up to about 2 years' in estimate_experience(text)['warning']


def test_phone_detection_ignores_year_ranges():
    assert find_phone('Worked 2019 - 2021 at Contoso') is None
    assert find_phone('Call +44 20 7946 0958 today') == '+44 20 7946 0958'


def test_contact_details_are_redacted_before_llm():
    redacted = redact_contact_details(RESUME_TEXT)
    assert 'jordan.rivera@example.com' not in redacted
    assert '555' not in redacted
    assert '[EMAIL]' in redacted and '[PHONE]' in redacted


def test_scrum_master_is_not_a_masters_degree():
    assert degree_level('Certified Scrum Master') is None
    assert degree_level("Master's degree in Statistics") == 3
    assert degree_level('B.S. in Computer Science') == 2


def test_job_heuristic_separates_required_and_preferred_with_sources():
    profile = heuristic_job_profile('Senior Backend Engineer', JOB_DESCRIPTION)
    by_skill = {r.skill: r for r in profile.requirements if r.category == 'skill'}
    assert by_skill['python'].importance == 'required'
    assert by_skill['kubernetes'].importance == 'required'
    assert by_skill['kafka'].importance == 'preferred'
    assert by_skill['terraform'].importance == 'preferred'
    assert all(r.source_excerpt and r.source_excerpt in JOB_DESCRIPTION for r in profile.requirements)
    experience = next(r for r in profile.requirements if r.category == 'experience')
    assert experience.years == 5
    education = next(r for r in profile.requirements if r.category == 'education')
    assert education.uncertain  # "or equivalent experience"
    assert profile.seniority == 'senior'
    # Benefits mention Python, but the benefits section is never a source of requirements.
    assert not any('conference' in (r.source_excerpt or '') for r in profile.requirements)


def test_job_without_headings_marks_requirements_uncertain():
    profile = heuristic_job_profile('Data Analyst', 'We need someone who knows SQL and Tableau well and can present findings to leadership every week.')
    assert profile.requirements and all(r.uncertain for r in profile.requirements)
    assert any('No "Requirements"' in warning for warning in profile.warnings)


def test_job_heuristic_never_invents_preferred_skills():
    profile = heuristic_job_profile('Writer', 'Responsibilities\n- Write clear weekly newsletters for our community members and partners\n')
    assert not any(r.category == 'skill' for r in profile.requirements)


def _llm(monkeypatch, content: str):
    monkeypatch.setattr(settings, 'mock_llm', False)
    monkeypatch.setattr(settings, 'openrouter_api_key', 'test-key')

    def handler(request):
        return httpx.Response(200, json={'choices': [{'message': {'content': content}}]})

    original = OpenRouterClient.__init__

    def patched(self, **kwargs):
        original(self, http_client=httpx.Client(base_url='https://openrouter.test/api/v1', transport=httpx.MockTransport(handler)), sleep=lambda _: None)

    monkeypatch.setattr(OpenRouterClient, '__init__', patched)


def test_llm_job_requirements_with_untraceable_excerpts_are_marked_uncertain(monkeypatch):
    _llm(monkeypatch, '{"seniority": "senior", "requirements": ['
         '{"category": "skill", "importance": "required", "text": "Python", "source_excerpt": "Strong Python and FastAPI or Django experience"},'
         '{"category": "skill", "importance": "required", "text": "Rust", "source_excerpt": "Must know Rust"}]}')
    profile = job_extractor.extract_job_profile('Senior Backend Engineer', JOB_DESCRIPTION)
    by_skill = {r.skill: r for r in profile.requirements if r.category == 'skill'}
    assert profile.method == 'llm'
    assert not by_skill['python'].uncertain
    assert by_skill['rust'].uncertain and by_skill['rust'].source_excerpt is None
    # Skills the model skipped are recovered from the text.
    assert 'kubernetes' in by_skill


def test_llm_resume_skills_not_in_document_are_dropped(monkeypatch):
    _llm(monkeypatch, '{"name": "Jordan Rivera", "skills": ["Python", "Kubernetes", "COBOL"], "experiences": []}')
    result = resume_extractor.extract_resume_profile(RESUME_TEXT)
    assert result.method == 'llm'
    assert 'Python' in result.profile.skills
    assert 'Kubernetes' not in result.profile.skills
    assert any('not found in the document text' in warning for warning in result.warnings)
    # Contact details come from the document, not from the model.
    assert result.profile.email == 'jordan.rivera@example.com'


def test_llm_garbage_output_raises_safe_error(monkeypatch):
    from app.services.llm_service import LLMResponseParsingError

    _llm(monkeypatch, 'I cannot help with that.')
    with pytest.raises(LLMResponseParsingError) as info:
        job_extractor.extract_job_profile('Engineer', JOB_DESCRIPTION)
    assert 'OPENROUTER' not in info.value.public_message


def test_llm_sentence_skills_are_split_and_unknown_sentences_demoted(monkeypatch):
    _llm(monkeypatch, '{"requirements": ['
         '{"category": "skill", "text": "Hands-on experience with Docker and Kubernetes", "source_excerpt": "Hands-on experience with Docker and Kubernetes"},'
         '{"category": "skill", "text": "Comfortable owning ambiguous problems end to end"}]}')
    profile = job_extractor.extract_job_profile('Senior Backend Engineer', JOB_DESCRIPTION)
    skills = [r.skill for r in profile.requirements if r.category == 'skill']
    assert skills.count('docker') == 1 and skills.count('kubernetes') == 1
    assert not any(r.category == 'skill' and len(r.text.split()) > 4 for r in profile.requirements)
    assert any(r.category == 'qualification' and r.text.startswith('Comfortable') for r in profile.requirements)
    # The model returned no duties, so the posting's responsibilities are used.
    assert any(r.category == 'responsibility' for r in profile.requirements)
