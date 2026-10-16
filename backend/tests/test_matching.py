from app.services.scoring_service import calculate_match_score
from app.services.matching_service import match_candidate_to_job
from app.schemas.job import JobRequirements
from app.schemas.resume import Resume


def test_score_bounds_and_verdict():
    result = calculate_match_score(
        required_skills=['python', 'fastapi'],
        preferred_skills=['sql'],
        candidate_skills=['python', 'fastapi', 'sql'],
        experience_years=4,
        required_experience=3,
        education_ok=True,
        certs_ok=True,
    )
    assert 0 <= result['score'] <= 100
    assert result['verdict'] in {'Strong Match', 'Good Match', 'Partial Match', 'Low Match'}


def test_zero_experience_requirement_does_not_fail():
    result = calculate_match_score(
        required_skills=[],
        preferred_skills=[],
        candidate_skills=['python'],
        experience_years=2,
        required_experience=0,
    )

    assert result['score'] == 0


def test_unverified_qualifications_are_not_assumed():
    result = calculate_match_score(
        required_skills=['python'],
        preferred_skills=[],
        candidate_skills=['python'],
        experience_years=3,
        required_experience=3,
        education_ok=None,
        certs_ok=None,
    )

    assert result['details']['education_verified'] is None
    assert result['details']['certifications_verified'] is None


def test_unknown_experience_receives_no_partial_credit():
    result = calculate_match_score(
        required_skills=['python'],
        preferred_skills=[],
        candidate_skills=['python'],
        experience_years=None,
        required_experience=5,
    )

    assert result['details']['experience_score'] is None
    assert result['score'] == 100


def test_score_normalizes_skill_aliases():
    result = calculate_match_score(
        required_skills=['JavaScript', 'Postgres'],
        preferred_skills=[],
        candidate_skills=['JS', 'PostgreSQL'],
        experience_years=None,
        required_experience=None,
    )

    assert result['details']['skill_ratio'] == 1.0


def test_responsibility_matching_requires_meaningful_token_overlap():
    job = JobRequirements(
        role='Backend Engineer',
        required_skills=[],
        preferred_skills=[],
        minimum_experience=None,
        education_requirements=[],
        responsibilities=['Build REST APIs'],
        required_qualifications=[],
        preferred_qualifications=[],
        relevant_certifications=[],
        seniority=None,
        explicit_experience_requirements=None,
    )
    resume = Resume(name='Alex', experiences=[{'description': 'Built reports for the API team.'}])

    result = match_candidate_to_job(job, resume)

    assert result['details']['responsibility_alignment'] == 0.0
