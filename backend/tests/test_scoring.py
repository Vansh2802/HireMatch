"""Regression tests for the deterministic scoring methodology (v2)."""

from fixtures import JOB_DESCRIPTION, RESUME_TEXT

from app.schemas.job import JobProfile, Requirement
from app.schemas.resume import ResumeProfile
from app.services.job_extractor import heuristic_job_profile
from app.services.matching_service import COMPONENTS, MIN_COVERAGE, SCORING_VERSION, match_resume_to_job
from app.services.resume_extractor import extract_resume_profile


def skill(rid: str, name: str, importance: str = 'required', uncertain: bool = False) -> Requirement:
    from app.services.skill_normalizer import normalize_skill

    return Requirement(id=rid, category='skill', importance=importance, text=name, skill=normalize_skill(name), uncertain=uncertain)


def job(*requirements: Requirement) -> JobProfile:
    return JobProfile(requirements=list(requirements))


def statuses(result) -> dict[str, str]:
    return {r.text: r.status for r in result.requirements}


def test_component_weights_sum_to_one():
    assert abs(sum(weight for _, _, weight in COMPONENTS) - 1) < 1e-9


def test_full_overlap_scores_100():
    result = match_resume_to_job(job(skill('r1', 'Python'), skill('r2', 'Docker')), 'I use Python and Docker daily.', ResumeProfile())
    assert result.score == 100
    assert result.verdict == 'Strong alignment'
    assert result.scoring_version == SCORING_VERSION


def test_no_overlap_scores_zero_with_not_found_not_missing():
    result = match_resume_to_job(job(skill('r1', 'Kubernetes'), skill('r2', 'Terraform')), 'Experienced Python developer.', ResumeProfile())
    assert result.score == 0
    assert result.verdict == 'Low alignment'
    assert set(statuses(result).values()) == {'not_found'}
    assert all('does not mean you lack' in r.note for r in result.requirements)


def test_job_without_requirements_produces_no_score():
    result = match_resume_to_job(job(), RESUME_TEXT, ResumeProfile())
    assert result.score is None
    assert result.verdict == 'Insufficient information'
    assert result.confidence == 'low'


def test_empty_resume_is_not_scored_as_qualified():
    profile = JobProfile(requirements=[
        skill('r1', 'Python'),
        Requirement(id='r2', category='experience', text='5+ years', years=5),
    ])
    result = match_resume_to_job(profile, '', ResumeProfile())
    assert result.score == 0
    assert statuses(result)['5+ years'] == 'unverifiable'


def test_aliases_and_case_are_normalised():
    result = match_resume_to_job(job(skill('r1', 'JavaScript'), skill('r2', 'PostgreSQL')), 'Built apps in JS backed by Postgres.', ResumeProfile())
    assert result.score == 100


def test_java_is_not_matched_by_javascript():
    result = match_resume_to_job(job(skill('r1', 'Java')), 'Senior JavaScript developer.', ResumeProfile())
    assert statuses(result)['Java'] == 'not_found'


def test_implied_skill_counts_as_met_with_related_evidence():
    result = match_resume_to_job(job(skill('r1', 'SQL')), 'Tuned PostgreSQL queries for reporting.', ResumeProfile())
    requirement = result.requirements[0]
    assert requirement.status == 'met'
    assert requirement.evidence[0].source == 'related_skill'
    assert 'PostgreSQL' in requirement.evidence[0].excerpt


def test_related_family_skill_is_partial_credit():
    result = match_resume_to_job(job(skill('r1', 'PostgreSQL')), 'Administered MySQL clusters.', ResumeProfile())
    assert result.requirements[0].status == 'partial'
    assert result.score == 50


def test_profile_only_skill_is_partial_and_explained():
    result = match_resume_to_job(job(skill('r1', 'Kubernetes')), 'Backend developer.', ResumeProfile(skills=['Kubernetes']))
    requirement = result.requirements[0]
    assert requirement.status == 'partial'
    assert requirement.evidence[0].source == 'profile'
    assert 'not in the resume document' in requirement.note


def test_partial_experience_gets_proportional_credit():
    profile = JobProfile(requirements=[Requirement(id='r1', category='experience', text='5+ years', years=5)])
    result = match_resume_to_job(profile, 'Engineer', ResumeProfile(total_experience_years=3, experience_years_source='date_ranges'))
    requirement = result.requirements[0]
    assert requirement.status == 'partial'
    assert requirement.credit == 0.6
    assert result.score == 60


def test_unknown_experience_is_excluded_not_zero_or_full():
    profile = JobProfile(requirements=[
        skill('r1', 'Python'),
        Requirement(id='r2', category='experience', text='5+ years', years=5),
    ])
    result = match_resume_to_job(profile, 'Python developer', ResumeProfile(total_experience_years=None))
    experience = next(c for c in result.components if c.key == 'experience')
    assert experience.status == 'unverifiable'
    # Only required skills were verifiable: 0.45 / (0.45 + 0.20) coverage, score from skills alone.
    assert result.score == 100
    assert result.evidence_coverage == round(0.45 / 0.65, 3)
    assert result.confidence == 'medium'  # 69% coverage: usable, but not high confidence


def test_low_coverage_yields_insufficient_evidence():
    profile = JobProfile(requirements=[
        Requirement(id='r1', category='experience', text='5+ years', years=5),
        Requirement(id='r2', category='qualification', text='Valid work authorisation for Canada'),
    ])
    result = match_resume_to_job(profile, 'Python developer', ResumeProfile())
    assert result.evidence_coverage < MIN_COVERAGE
    assert result.score is None
    assert result.verdict == 'Insufficient evidence'


def test_uncertain_requirements_carry_half_weight():
    result = match_resume_to_job(job(skill('r1', 'Python'), skill('r2', 'Rust', uncertain=True)), 'Python developer', ResumeProfile())
    # (1*1 + 0*0.5) / 1.5
    assert result.score == 67


def test_scoring_is_deterministic():
    extraction = extract_resume_profile(RESUME_TEXT)
    profile = heuristic_job_profile('Senior Backend Engineer', JOB_DESCRIPTION)
    first = match_resume_to_job(profile, RESUME_TEXT, extraction.profile)
    second = match_resume_to_job(profile, RESUME_TEXT, extraction.profile)
    assert first.model_dump() == second.model_dump()


def test_realistic_fixture_result_is_explained():
    extraction = extract_resume_profile(RESUME_TEXT)
    profile = heuristic_job_profile('Senior Backend Engineer', JOB_DESCRIPTION)
    result = match_resume_to_job(profile, RESUME_TEXT, extraction.profile)
    assert 70 <= result.score <= 90
    assert statuses(result)['Kubernetes'] == 'not_found'
    assert statuses(result)['Python'] == 'met'
    kubernetes_action = next(a for a in result.action_plan if a.requirement == 'Kubernetes')
    assert kubernetes_action.priority == 'high'
    assert 'do not add skills you do not have' in kubernetes_action.suggestion
    met = [r for r in result.requirements if r.status == 'met' and r.category == 'skill']
    # Evidence excerpts are real substrings of the resume.
    for requirement in met:
        excerpt = requirement.evidence[0].excerpt.strip('…')
        assert excerpt in RESUME_TEXT


def test_duplicate_skill_mentions_are_counted_once():
    profile = heuristic_job_profile('Engineer', 'Requirements\n- Python\n- Strong Python skills\n- python scripting\n' + 'x' * 80)
    assert [r.skill for r in profile.requirements if r.category == 'skill'].count('python') == 1
