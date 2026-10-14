from __future__ import annotations

from app.schemas.job import JobRequirements
from app.schemas.resume import Resume
from app.services.scoring_service import calculate_match_score
from app.services.skill_normalizer import normalize_skill


def match_candidate_to_job(job: JobRequirements, resume: Resume) -> dict:
    candidate_skills = {normalize_skill(skill) for skill in resume.skills if skill}
    required_skills = [normalize_skill(skill) for skill in job.required_skills]
    preferred_skills = [normalize_skill(skill) for skill in job.preferred_skills]
    resume_text = ' '.join(
        [
            *(experience.description or '' for experience in resume.experiences),
            *(project.description or '' for project in resume.projects),
            *(technology for project in resume.projects for technology in project.technologies),
        ]
    ).lower()
    responsibility_hits = sum(
        1 for responsibility in job.responsibilities
        if any(word in resume_text for word in responsibility.lower().split() if len(word) > 3)
    )
    responsibility_alignment = responsibility_hits / len(job.responsibilities) if job.responsibilities else None

    education_ok = None
    if job.education_requirements:
        if resume.education:
            education_text = ' '.join(
                f'{entry.degree or ""} {entry.field or ""}' for entry in resume.education
            ).lower()
            education_ok = any(
                any(word in education_text for word in requirement.lower().split() if len(word) > 3)
                for requirement in job.education_requirements
            )
        else:
            education_ok = None

    certs_ok = None
    if job.relevant_certifications:
        if resume.certifications:
            certifications_text = ' '.join(resume.certifications).lower()
            certs_ok = any(cert.lower() in certifications_text for cert in job.relevant_certifications)
        else:
            certs_ok = None

    match = calculate_match_score(
        required_skills=required_skills,
        preferred_skills=preferred_skills,
        candidate_skills=list(candidate_skills),
        experience_years=resume.total_experience_years,
        required_experience=job.minimum_experience,
        education_ok=education_ok,
        certs_ok=certs_ok,
        responsibility_alignment=responsibility_alignment,
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
        'unverified_requirements': [
            requirement for requirement, verified in (
                ('experience', resume.total_experience_years if job.minimum_experience else True),
                ('education', education_ok),
                ('certifications', certs_ok),
            ) if verified is None and (
                (requirement == 'experience' and job.minimum_experience)
                or (requirement == 'education' and job.education_requirements)
                or (requirement == 'certifications' and job.relevant_certifications)
            )
        ],
        'preferred_skills_found': preferred_found,
        'relevant_experience_evidence': evidence,
        'strengths': [
            item for item in ['Relevant skill coverage', 'Structured experience history', 'Responsibility alignment']
            if (item == 'Relevant skill coverage' and matching_skills) or (item == 'Structured experience history' and resume.experiences) or (item == 'Responsibility alignment' and responsibility_hits)
        ],
        'areas_for_review': [
            'Confirm role-specific nuances with recruiter',
            *(['Experience duration is unavailable.'] if resume.total_experience_years is None and job.minimum_experience else []),
            *(['Education evidence is unavailable.'] if education_ok is None and job.education_requirements else []),
            *(['Certification evidence is unavailable.'] if certs_ok is None and job.relevant_certifications else []),
        ],
        'overall_explanation': f'{match["verdict"]} based on alignment across skills, experience, and role requirements.',
        'details': match['details'],
    }
