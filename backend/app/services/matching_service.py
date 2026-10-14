from __future__ import annotations

from app.schemas.job import JobRequirements
from app.schemas.resume import Resume
from app.services.scoring_service import calculate_match_score


def match_candidate_to_job(job: JobRequirements, resume: Resume) -> dict:
    candidate_skills = {skill.lower().strip() for skill in resume.skills if skill}
    required_skills = [skill.lower().strip() for skill in job.required_skills]
    preferred_skills = [skill.lower().strip() for skill in job.preferred_skills]
    match = calculate_match_score(
        required_skills=required_skills,
        preferred_skills=preferred_skills,
        candidate_skills=list(candidate_skills),
        experience_years=resume.total_experience_years,
        required_experience=job.minimum_experience,
        education_ok=True if not job.education_requirements else True,
        certs_ok=True,
    )

    matching_skills = sorted({skill for skill in required_skills if skill in candidate_skills}, key=str.lower)
    missing_skills = sorted({skill for skill in required_skills if skill not in candidate_skills}, key=str.lower)
    preferred_found = sorted({skill for skill in preferred_skills if skill in candidate_skills}, key=str.lower)
    evidence = []
    if resume.experiences:
        for experience in resume.experiences:
            if experience.description:
                evidence.append(experience.description[:200])

    return {
        'score': match['score'],
        'verdict': match['verdict'],
        'matching_skills': matching_skills,
        'missing_skills': missing_skills,
        'preferred_skills_found': preferred_found,
        'relevant_experience_evidence': evidence,
        'strengths': ["Relevant skill coverage", "Structured experience history"],
        'areas_for_review': ['Confirm role-specific nuances with recruiter'],
        'overall_explanation': f'{match["verdict"]} based on alignment across skills, experience, and role requirements.',
        'details': match['details'],
    }
