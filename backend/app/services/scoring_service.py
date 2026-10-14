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
    responsibility_alignment: float | None = None,
) -> dict:
    skill_norm = [s.lower().strip() for s in required_skills if s]
    candidate_norm = {s.lower().strip() for s in candidate_skills if s}
    hit_count = sum(1 for skill in skill_norm if skill in candidate_norm)
    skill_ratio = (hit_count / len(skill_norm)) if skill_norm else None

    experience_score = None
    if required_experience is not None and required_experience > 0 and experience_years is not None:
        experience_score = min(1.0, max(0.0, experience_years / float(required_experience)))
    elif required_experience is not None and required_experience > 0 and experience_years is None:
        experience_score = 0.5

    preferred_ratio = sum(1 for skill in preferred_skills if skill.lower().strip() in candidate_norm) / max(1, len(preferred_skills)) if preferred_skills else None
    components: list[tuple[float, float, str]] = []
    if skill_ratio is not None:
        components.append((skill_ratio, 0.40, 'required_skills'))
    if preferred_skills:
        components.append((preferred_ratio or 0.0, 0.05, 'preferred_skills'))
    if required_experience is not None and required_experience > 0:
        components.append((experience_score if experience_score is not None else 0.5, 0.25, 'experience'))
    qualification_values = [value for value in (education_ok, certs_ok) if value is not None]
    if qualification_values:
        components.append((sum(1.0 if value else 0.0 for value in qualification_values) / len(qualification_values), 0.10, 'qualifications'))
    if responsibility_alignment is not None:
        components.append((max(0.0, min(1.0, responsibility_alignment)), 0.20, 'responsibility_alignment'))

    total_weight = sum(weight for _, weight, _ in components)
    score = sum(value * weight for value, weight, _ in components) / total_weight * 100 if total_weight else 0

    score = max(0, min(100, round(score)))

    if score >= 80:
        verdict = 'Strong Match'
    elif score >= 60:
        verdict = 'Good Match'
    elif score >= 40:
        verdict = 'Partial Match'
    else:
        verdict = 'Low Match'

    return {
        'score': score,
        'verdict': verdict,
        'details': {
            'skill_ratio': round(skill_ratio, 3) if skill_ratio is not None else None,
            'preferred_ratio': round(preferred_ratio, 3) if preferred_ratio is not None else None,
            'experience_score': round(experience_score, 3) if experience_score is not None else None,
            'education_verified': education_ok,
            'certifications_verified': certs_ok,
            'responsibility_alignment': round(responsibility_alignment, 3) if responsibility_alignment is not None else None,
            'applied_weight_total': round(total_weight, 3),
            'weighting': {'required_skills': 0.40, 'preferred_skills': 0.05, 'experience': 0.25, 'qualifications': 0.10, 'responsibility_alignment': 0.20},
        },
    }
