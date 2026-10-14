from __future__ import annotations


def calculate_match_score(
    *,
    required_skills: list[str],
    preferred_skills: list[str],
    candidate_skills: list[str],
    experience_years: float | int | None,
    required_experience: int | float | None,
    education_ok: bool | None = None,
    certs_ok: bool | None = None,
) -> dict:
    skill_norm = [s.lower().strip() for s in required_skills if s]
    candidate_norm = {s.lower().strip() for s in candidate_skills if s}
    hit_count = sum(1 for skill in skill_norm if skill in candidate_norm)
    skill_ratio = (hit_count / len(skill_norm)) if skill_norm else 1.0

    experience_score = 1.0
    if required_experience is not None and experience_years is not None:
        experience_score = min(1.0, max(0.0, experience_years / float(required_experience)))
    elif required_experience is not None and experience_years is None:
        experience_score = 0.0

    education_component = 1.0 if education_ok is not None and education_ok else 0.5 if education_ok is None else 0.0
    cert_component = 1.0 if certs_ok is not None and certs_ok else 0.5 if certs_ok is None else 0.0

    required_weight = 0.40
    experience_weight = 0.25
    education_weight = 0.10
    cert_weight = 0.05
    preferred_weight = 0.10
    remaining_weight = 0.10

    score = (
        skill_ratio * required_weight
        + experience_score * experience_weight
        + education_component * education_weight
        + cert_component * cert_weight
        + (sum(1 for skill in preferred_skills if skill.lower() in candidate_norm) / max(1, len(preferred_skills))) * preferred_weight
        + remaining_weight * 0.5
    ) * 100

    score = max(0, min(100, round(score)))

    if score >= 80:
        verdict = 'Strong Match'
    elif score >= 60:
        verdict = 'Good Match'
    elif score >= 40:
        verdict = 'Partial Match'
    else:
        verdict = 'Low Match'

    return {'score': score, 'verdict': verdict, 'details': {'skill_ratio': round(skill_ratio, 3), 'experience_score': round(experience_score, 3)}}
