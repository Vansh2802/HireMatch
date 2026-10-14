from app.services.scoring_service import calculate_match_score


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
