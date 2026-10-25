"""Deterministic, explainable resume-to-job matching (scoring methodology v2).

Methodology (also documented for users on the "How scoring works" page):

1. Every job requirement is checked against the resume text and given a status:
   ``met`` (credit 1), ``partial`` (credit 0.5, or a proportion for experience years),
   ``not_found`` (credit 0 – the resume does not show it; this is *not* proof the
   candidate lacks it) or ``unverifiable`` (the resume does not contain the information
   needed to check; excluded from the score instead of counted as 0 or 100).
2. Requirements are grouped into components with fixed base weights. Inside a
   component, requirements marked uncertain or preferred count half.
3. Components with no requirements are not applicable; the remaining base weights
   are renormalised so they sum to 1.
4. Evidence coverage is the weighted share of applicable requirements that could be
   verified. Below ``MIN_COVERAGE`` no score is produced ("Insufficient evidence").

The score is computed only here, in code. Explanations are derived from the same
results and never change the number.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.schemas.analysis import ActionItem, AnalysisResult, ComponentResult, Evidence, RequirementResult
from app.schemas.job import JobProfile, Requirement
from app.schemas.resume import ResumeProfile
from app.services.skill_normalizer import (
    SKILLS,
    dedupe_skills,
    extract_known_skills,
    find_skill_in_text,
    implied_skills,
    normalize_skill,
    skill_family,
    skill_label,
)
from app.services.text_analysis import (
    DEGREE_LABELS,
    RESUME_SECTIONS,
    best_matching_line,
    content_tokens,
    degree_level,
    excerpt_around,
    highest_degree,
    section_text,
    split_sections,
)

SCORING_VERSION = '2.0'
MIN_COVERAGE = 0.4
CREDIT = {'met': 1.0, 'partial': 0.5, 'not_found': 0.0}
REDUCED_WEIGHT = 0.5

COMPONENTS: list[tuple[str, str, float]] = [
    ('required_skills', 'Required skills', 0.45),
    ('experience', 'Experience', 0.20),
    ('responsibilities', 'Responsibilities', 0.15),
    ('qualifications', 'Education & certifications', 0.10),
    ('preferred_skills', 'Preferred skills', 0.10),
]
assert abs(sum(weight for _, _, weight in COMPONENTS) - 1.0) < 1e-9

VERDICT_THRESHOLDS = ((75, 'Strong alignment'), (50, 'Partial alignment'), (0, 'Low alignment'))
GENERIC_CERT_WORDS = {'certification', 'certifications', 'certified', 'certificate', 'license', 'licence', 'licensed',
                      'required', 'preferred', 'relevant', 'industry', 'professional', 'such', 'valid', 'current', 'equivalent',
                      'hold', 'holding', 'obtain', 'have', 'recognized', 'recognised', 'appropriate'}


@dataclass
class _Context:
    text: str
    lines: list[str]
    profile: ResumeProfile
    text_skills: list[str]
    profile_skills: set[str]
    work_lines: list[str]
    work_tokens: set[str]
    education_text: str
    certification_lines: list[str]
    all_tokens: set[str] = field(default_factory=set)


def _build_context(text: str, profile: ResumeProfile) -> _Context:
    lines, sections = split_sections(text, RESUME_SECTIONS)
    work_text = '\n'.join(
        filter(None, [section_text(lines, sections, key) for key in ('experience', 'projects', 'summary')])
    )
    if not work_text.strip():
        work_text = text
    profile_text = '\n'.join(
        [e.description or '' for e in profile.experiences] + [p.description or '' for p in profile.projects] + [profile.summary or '']
    )
    work_lines = [line for line in (work_text + '\n' + profile_text).split('\n') if line.strip()]
    certification_lines = [line for line in section_text(lines, sections, 'certifications').split('\n') if line.strip()]
    certification_lines += [c for c in profile.certifications if c not in certification_lines]
    return _Context(
        text=text,
        lines=lines,
        profile=profile,
        text_skills=extract_known_skills(text, include_short=True) if text else [],
        profile_skills=set(dedupe_skills(profile.skills)),
        work_lines=work_lines,
        work_tokens=content_tokens(work_text + '\n' + profile_text),
        education_text=section_text(lines, sections, 'education') or text,
        certification_lines=certification_lines,
        all_tokens=content_tokens(text),
    )


def _text_evidence(key: str, ctx: _Context) -> Evidence | None:
    match = find_skill_in_text(key, ctx.text, include_short=True) if ctx.text else None
    if not match:
        return None
    excerpt, line = excerpt_around(ctx.text, match.start(), match.end())
    return Evidence(excerpt=excerpt, source='resume_text', line=line)


def _evaluate_skill(req: Requirement, ctx: _Context) -> tuple[str, list[Evidence], str]:
    key = req.skill or normalize_skill(req.text)
    label = skill_label(key) if key in SKILLS else req.text
    evidence = _text_evidence(key, ctx)
    if evidence:
        return 'met', [evidence], f'{label} appears in your resume.'

    for other in ctx.text_skills:
        if key in implied_skills(other):
            other_evidence = _text_evidence(other, ctx)
            if other_evidence:
                return 'met', [other_evidence.model_copy(update={'source': 'related_skill'})], (
                    f'Evidenced through {skill_label(other)}, which involves {label}. Consider naming {label} explicitly too.'
                )

    if key in ctx.profile_skills:
        return 'partial', [Evidence(excerpt=f'"{label}" is listed in your saved profile.', source='profile')], (
            f'{label} is in your edited profile but not in the resume document text. Make sure it appears in the file you submit.'
        )

    family = skill_family(key)
    if family:
        related = [other for other in ctx.text_skills if other != key and skill_family(other) == family]
        if related:
            related_evidence = _text_evidence(related[0], ctx)
            names = ', '.join(skill_label(item) for item in related[:3])
            return 'partial', [related_evidence.model_copy(update={'source': 'related_skill'})] if related_evidence else [], (
                f'{label} was not found, but closely related experience was: {names}.'
            )

    return 'not_found', [], (
        f'{label} was not found in your resume. This does not mean you lack it — only that the resume does not show it.'
    )


def _evaluate_experience(req: Requirement, ctx: _Context) -> tuple[str, list[Evidence], str, float | None]:
    required = req.years or 0
    years = ctx.profile.total_experience_years
    if not required:
        return 'unverifiable', [], 'The number of years required could not be determined.', None
    if years is None:
        return 'unverifiable', [], (
            'Your resume does not show dated roles or a stated total, so years of experience could not be checked.'
        ), None
    source = {
        'date_ranges': 'calculated from the dated roles in your resume',
        'stated': 'as stated in your resume',
        'user': 'as entered in your profile',
    }.get(ctx.profile.experience_years_source or '', 'from your resume')
    evidence = [Evidence(excerpt=f'About {years:g} years of experience, {source}.', source='computed')]
    ratio = years / required
    credit = min(1.0, ratio)
    if ratio >= 1:
        return 'met', evidence, f'Meets the stated {required:g}+ years (about {years:g} years found).', credit
    status = 'partial' if ratio >= 0.5 else 'not_found'
    return status, evidence, (
        f'The role asks for {required:g}+ years; about {years:g} years were found. '
        'Total years count all dated roles, not only directly relevant ones.'
    ), credit


def _evaluate_responsibility(req: Requirement, ctx: _Context) -> tuple[str, list[Evidence], str]:
    tokens = content_tokens(req.text)
    if len(tokens) < 2:
        return 'unverifiable', [], 'This responsibility is too general to check against the resume.'
    coverage = len(tokens & ctx.work_tokens) / len(tokens)
    best = best_matching_line(tokens, ctx.work_lines)
    evidence = [Evidence(excerpt=best[0], source='resume_text')] if best else []
    if coverage >= 0.6 and best:
        return 'met', evidence, 'Your experience describes closely similar work.'
    if coverage >= 0.3 and best:
        return 'partial', evidence, 'Your experience covers part of this responsibility.'
    return 'not_found', [], 'No clearly similar work was found in your experience or projects.'


def _evaluate_education(req: Requirement, ctx: _Context) -> tuple[str, list[Evidence], str]:
    required_level = req.degree_level or degree_level(req.text)
    if not required_level:
        return _evaluate_qualification(req, ctx)
    found = highest_degree(ctx.education_text) if ctx.education_text else None
    if not found:
        degrees = [entry.degree for entry in ctx.profile.education if entry.degree]
        level = max((degree_level(degree) or 0 for degree in degrees), default=0)
        if level:
            found = (level, degrees[0])
    if not found:
        return 'unverifiable', [], 'No degree information was found in your resume, so this could not be checked.'
    level, line = found
    evidence = [Evidence(excerpt=line, source='resume_text')]
    if level >= required_level:
        return 'met', evidence, f'{DEGREE_LABELS[level]} found; the role asks for {DEGREE_LABELS[required_level].lower()}.'
    note = f'Highest degree found is {DEGREE_LABELS[level].lower()}; the role asks for {DEGREE_LABELS[required_level].lower()}.'
    if req.uncertain:
        note += ' The posting may accept equivalent experience.'
    return 'partial', evidence, note


def _evaluate_certification(req: Requirement, ctx: _Context) -> tuple[str, list[Evidence], str]:
    tokens = content_tokens(req.text) - GENERIC_CERT_WORDS
    if not tokens:
        return 'unverifiable', [], 'The posting does not name a specific certification to check.'
    candidates = ctx.certification_lines or [line for line in ctx.lines if 'certif' in line.lower()]
    best = best_matching_line(tokens, candidates, min_overlap=1)
    if best and best[2] / len(tokens) >= 0.6:
        return 'met', [Evidence(excerpt=best[0], source='resume_text')], 'A matching certification appears in your resume.'
    if best and best[2] / len(tokens) >= 0.3:
        return 'partial', [Evidence(excerpt=best[0], source='resume_text')], 'A related certification appears in your resume.'
    return 'not_found', [], 'This certification was not found in your resume.'


def _evaluate_qualification(req: Requirement, ctx: _Context) -> tuple[str, list[Evidence], str]:
    tokens = content_tokens(req.text)
    if not tokens:
        return 'unverifiable', [], 'This requirement could not be checked against a resume.'
    best = best_matching_line(tokens, ctx.lines, min_overlap=max(1, round(len(tokens) * 0.6)))
    if best:
        return 'met', [Evidence(excerpt=best[0], source='resume_text')], 'Your resume addresses this requirement.'
    return 'unverifiable', [], 'Resumes usually do not state this; confirm it in your application if it applies.'


def _component_for(req: Requirement) -> str:
    if req.category == 'skill':
        return 'required_skills' if req.importance == 'required' else 'preferred_skills'
    if req.category == 'experience':
        return 'experience'
    if req.category == 'responsibility':
        return 'responsibilities'
    return 'qualifications'


def _weight_for(req: Requirement) -> float:
    weight = 1.0
    if req.uncertain:
        weight *= REDUCED_WEIGHT
    if req.importance == 'preferred' and req.category != 'skill':
        weight *= REDUCED_WEIGHT
    return weight


def evaluate_requirement(req: Requirement, ctx: _Context) -> RequirementResult:
    credit: float | None = None
    if req.category == 'skill':
        status, evidence, note = _evaluate_skill(req, ctx)
    elif req.category == 'experience':
        status, evidence, note, credit = _evaluate_experience(req, ctx)
    elif req.category == 'responsibility':
        status, evidence, note = _evaluate_responsibility(req, ctx)
    elif req.category == 'education':
        status, evidence, note = _evaluate_education(req, ctx)
    elif req.category == 'certification':
        status, evidence, note = _evaluate_certification(req, ctx)
    else:
        status, evidence, note = _evaluate_qualification(req, ctx)
    if credit is None and status != 'unverifiable':
        credit = CREDIT[status]
    return RequirementResult(
        id=req.id,
        category=req.category,
        importance=req.importance,
        text=req.text,
        source_excerpt=req.source_excerpt,
        uncertain=req.uncertain,
        status=status,
        credit=round(credit, 3) if credit is not None else None,
        evidence=evidence,
        note=note,
    )


def _verdict(score: int) -> str:
    for threshold, label in VERDICT_THRESHOLDS:
        if score >= threshold:
            return label
    return VERDICT_THRESHOLDS[-1][1]


# ---------------------------------------------------------------- explanations


def _action_for(result: RequirementResult) -> ActionItem | None:
    if result.status == 'met':
        return None
    required = result.importance == 'required'
    if result.status == 'not_found' and required:
        priority = 'high'
    elif required and not result.uncertain:
        priority = 'medium'
    else:
        priority = 'low'
    why = (
        f'Listed as {"a required" if required else "a preferred"} '
        f'{"skill" if result.category == "skill" else result.category} in this job description'
        + (' (the posting is not explicit about this).' if result.uncertain else '.')
    )
    section: str | None
    if result.category == 'skill':
        section = 'Skills and Experience'
        if result.status == 'partial' and result.evidence and result.evidence[0].source == 'profile':
            suggestion = f'Add {result.text} to the resume file itself — it is only in your edited profile.'
        elif result.status == 'partial':
            suggestion = (
                f'If you have used {result.text} directly, name it explicitly and describe where you used it. '
                'If you have not, highlight the related experience and how quickly it transfers.'
            )
        else:
            suggestion = (
                f'If you have used {result.text}, add it to your Skills section and mention a specific role or project where you applied it. '
                'If you have not, treat it as a learning gap — do not add skills you do not have.'
            )
    elif result.category == 'experience':
        section = 'Experience'
        if result.status == 'unverifiable':
            suggestion = 'Add start and end dates (e.g. "Jan 2021 – Present") to every role so your total experience is clear.'
        else:
            suggestion = (
                'Emphasise the depth and scope of your most relevant work (ownership, scale, outcomes). '
                'Include relevant internships or freelance roles with dates if you left any out.'
            )
    elif result.category == 'responsibility':
        section = 'Experience or Projects'
        suggestion = (
            'If you have done similar work, describe one concrete example in a bullet: what you did, the tools used, and the outcome.'
        )
    elif result.category == 'education':
        section = 'Education'
        suggestion = (
            'Add an Education section with degree, field and institution.' if result.status == 'unverifiable'
            else 'If the posting accepts equivalent experience, make sure your experience section shows it clearly.'
        )
    elif result.category == 'certification':
        section = 'Certifications'
        suggestion = 'If you hold this certification, list it with the issuing body and year. If not, consider whether it is worth pursuing.'
    else:
        section = None
        suggestion = 'If this applies to you, state it in your resume or cover letter.'
    if result.status == 'unverifiable' and result.category in {'qualification'}:
        priority = 'low'
    return ActionItem(
        requirement_id=result.id,
        requirement=result.text,
        importance=result.importance,
        status=result.status,
        priority=priority,
        why=why,
        suggestion=suggestion,
        section=section,
    )


def _summary(score: int | None, verdict: str, results: list[RequirementResult], coverage: float, experience: RequirementResult | None) -> str:
    required_skills = [r for r in results if r.category == 'skill' and r.importance == 'required']
    parts: list[str] = []
    if required_skills:
        met = sum(r.status == 'met' for r in required_skills)
        partial = sum(r.status == 'partial' for r in required_skills)
        sentence = f'Your resume shows clear evidence for {met} of {len(required_skills)} required skills'
        sentence += f' and partial evidence for {partial} more.' if partial else '.'
        parts.append(sentence)
    if experience is not None:
        parts.append(experience.note)
    missing = [r.text for r in required_skills if r.status == 'not_found']
    if missing:
        listed = ', '.join(missing[:4]) + (f' and {len(missing) - 4} more' if len(missing) > 4 else '')
        parts.append(f'Not found in the resume: {listed}.')
    if score is None:
        parts.append(
            'There was not enough verifiable information to calculate a reliable score; see the requirements that could not be checked.'
        )
    elif coverage < 0.7:
        parts.append('A substantial part of the job requirements could not be verified from the resume, so treat this score with caution.')
    return ' '.join(parts) or f'{verdict}.'


def match_resume_to_job(job: JobProfile, resume_text: str, profile: ResumeProfile) -> AnalysisResult:
    ctx = _build_context(resume_text or '', profile)
    results = [evaluate_requirement(req, ctx) for req in job.requirements]
    by_id = {req.id: req for req in job.requirements}

    components: list[ComponentResult] = []
    applicable_weight = 0.0
    verified_weight = 0.0
    scored: list[tuple[str, float, float]] = []
    for key, label, base_weight in COMPONENTS:
        members = [(r, _weight_for(by_id[r.id])) for r in results if _component_for(by_id[r.id]) == key]
        if not members:
            components.append(ComponentResult(key=key, label=label, base_weight=base_weight, effective_weight=0, score=None,
                                              status='not_applicable', requirement_count=0,
                                              detail='The job description states no requirements of this type.'))
            continue
        applicable_weight += base_weight
        total_member_weight = sum(weight for _, weight in members)
        verified = [(r, weight) for r, weight in members if r.status != 'unverifiable']
        verified_member_weight = sum(weight for _, weight in verified)
        verified_weight += base_weight * (verified_member_weight / total_member_weight)
        if not verified:
            components.append(ComponentResult(key=key, label=label, base_weight=base_weight, effective_weight=0, score=None,
                                              status='unverifiable', requirement_count=len(members),
                                              detail='The resume does not contain the information needed to check this.'))
            continue
        component_score = sum((r.credit or 0) * weight for r, weight in verified) / verified_member_weight
        scored.append((key, base_weight, component_score))
        met = sum(r.status == 'met' for r, _ in members)
        components.append(ComponentResult(key=key, label=label, base_weight=base_weight, effective_weight=0,
                                          score=round(component_score, 3), status='scored', requirement_count=len(members),
                                          detail=f'{met} of {len(members)} met'
                                          + (f'; {len(members) - len(verified)} could not be checked' if len(verified) < len(members) else '')))

    coverage = verified_weight / applicable_weight if applicable_weight else 0.0
    scored_weight = sum(weight for _, weight, _ in scored)
    for component in components:
        if component.status == 'scored':
            component.effective_weight = round(component.base_weight / scored_weight, 3)

    if not job.requirements:
        score, verdict = None, 'Insufficient information'
    elif not scored or coverage < MIN_COVERAGE:
        score, verdict = None, 'Insufficient evidence'
    else:
        raw = sum(weight * value for _, weight, value in scored) / scored_weight * 100
        score = max(0, min(100, int(raw + 0.5)))
        verdict = _verdict(score)

    if score is None or coverage < 0.6 or not resume_text:
        confidence = 'low'
    elif coverage >= 0.85 and len(job.requirements) >= 5 and sum(r.uncertain for r in job.requirements) <= len(job.requirements) / 2:
        confidence = 'high'
    else:
        confidence = 'medium'

    counts = {
        'total': len(results),
        'met': sum(r.status == 'met' for r in results),
        'partial': sum(r.status == 'partial' for r in results),
        'not_found': sum(r.status == 'not_found' for r in results),
        'unverifiable': sum(r.status == 'unverifiable' for r in results),
        'required_total': sum(r.importance == 'required' for r in results),
        'required_met': sum(r.importance == 'required' and r.status == 'met' for r in results),
    }

    experience = next((r for r in results if r.category == 'experience'), None)
    strengths: list[str] = []
    met_required_skills = [r.text for r in results if r.category == 'skill' and r.importance == 'required' and r.status == 'met']
    if met_required_skills:
        strengths.append('Clear evidence of required skills: ' + ', '.join(met_required_skills[:8]) + ('…' if len(met_required_skills) > 8 else ''))
    if experience and experience.status == 'met':
        strengths.append(experience.note)
    for r in results:
        if r.status == 'met' and r.category in {'education', 'certification'}:
            strengths.append(r.note)
    matched_resp = sum(r.category == 'responsibility' and r.status == 'met' for r in results)
    if matched_resp:
        strengths.append(f'Your experience describes work similar to {matched_resp} of the listed responsibilities.')
    met_preferred = [r.text for r in results if r.category == 'skill' and r.importance == 'preferred' and r.status == 'met']
    if met_preferred:
        strengths.append('Preferred skills shown: ' + ', '.join(met_preferred[:6]))

    priority_rank = {'high': 0, 'medium': 1, 'low': 2}
    actions = [action for action in (_action_for(r) for r in results) if action]
    actions.sort(key=lambda a: (priority_rank[a.priority], 0 if a.importance == 'required' else 1))

    next_steps: list[str] = []
    high = sum(a.priority == 'high' for a in actions)
    if high:
        next_steps.append(f'Work through the {high} high-priority gap{"s" if high != 1 else ""} below. Only add skills and experience you genuinely have.')
    if experience and experience.status == 'unverifiable':
        next_steps.append('Add start and end dates to each role so your experience can be measured.')
    if score is not None and score >= 75:
        next_steps.append('Your resume aligns well. Tailor your summary to lead with the strongest matching requirements.')
    next_steps.append('After updating your resume, upload the new version and re-run this analysis to compare the results.')

    return AnalysisResult(
        scoring_version=SCORING_VERSION,
        score=score,
        verdict=verdict,
        confidence=confidence,
        evidence_coverage=round(coverage, 3),
        summary=_summary(score, verdict, results, coverage, experience),
        components=components,
        requirements=results,
        strengths=strengths[:8],
        action_plan=actions[:20],
        next_steps=next_steps,
        counts=counts,
    )
