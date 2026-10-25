from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import Pagination, get_current_user, not_found, pagination
from app.api.routes.jobs import get_owned_job
from app.api.routes.resumes import get_owned_resume
from app.core.database import get_db
from app.models.analysis import Analysis
from app.models.auth import User
from app.models.job import Job
from app.schemas.analysis import AnalysisCreateRequest, AnalysisListItem, AnalysisOut
from app.schemas.common import Page
from app.schemas.job import JobProfile
from app.schemas.resume import ResumeProfile
from app.services.matching_service import SCORING_VERSION, match_resume_to_job

router = APIRouter(prefix='/analyses', tags=['analyses'])


def _list_item(analysis: Analysis) -> dict:
    snapshot = analysis.job_snapshot or {}
    return {
        'id': analysis.id,
        'resume_id': analysis.resume_id,
        'resume_version_id': analysis.resume_version_id,
        'resume_title': analysis.resume_title,
        'resume_version_number': analysis.resume_version_number,
        'job_id': analysis.job_id,
        'job_title': snapshot.get('title') or 'Untitled job',
        'job_company': snapshot.get('company'),
        'score': analysis.score,
        'verdict': analysis.verdict,
        'confidence': analysis.confidence,
        'scoring_version': analysis.scoring_version,
        'created_at': analysis.created_at,
    }


def _analysis_out(analysis: Analysis) -> AnalysisOut:
    resume = analysis.resume
    current = resume.current_version if resume else None
    job = analysis.job
    return AnalysisOut(
        **_list_item(analysis),
        job_revision=analysis.job_revision,
        job_snapshot=analysis.job_snapshot,
        result=analysis.result,
        is_legacy=not analysis.scoring_version.startswith('2.'),
        is_current_resume_version=(current.id == analysis.resume_version_id) if current else None,
        is_current_job_revision=(job.revision == analysis.job_revision) if job else None,
    )


def get_owned_analysis(db: Session, user: User, analysis_id: int) -> Analysis:
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id, Analysis.user_id == user.id).first()
    if not analysis:
        raise not_found('Analysis')
    return analysis


@router.post('', response_model=AnalysisOut, status_code=status.HTTP_201_CREATED)
def create_analysis(payload: AnalysisCreateRequest, response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    resume = get_owned_resume(db, user, payload.resume_id)
    job = get_owned_job(db, user, payload.job_id)
    if payload.resume_version_id is not None:
        version = next((v for v in resume.versions if v.id == payload.resume_version_id), None)
        if version is None:
            raise not_found('Resume version')
    else:
        version = resume.current_version
    if version is None or version.status != 'ready':
        detail = 'This resume is still being processed.' if version and version.status == 'processing' else 'This resume has no successfully processed version.'
        raise HTTPException(status_code=409, detail=detail)
    if job.status != 'ready' or not job.profile:
        detail = 'This job is still being analysed.' if job.status == 'processing' else 'Requirements for this job could not be extracted. Retry extraction first.'
        raise HTTPException(status_code=409, detail=detail)

    existing = db.query(Analysis).filter(
        Analysis.user_id == user.id,
        Analysis.resume_version_id == version.id,
        Analysis.job_id == job.id,
        Analysis.job_revision == job.revision,
        Analysis.scoring_version == SCORING_VERSION,
    ).first()
    if existing:
        # Same inputs and same methodology produce the same result: return it instead of duplicating.
        response.status_code = status.HTTP_200_OK
        return _analysis_out(existing)

    job_profile = JobProfile.model_validate(job.profile)
    result = match_resume_to_job(job_profile, version.raw_text, ResumeProfile.model_validate(version.profile or {}))
    analysis = Analysis(
        user_id=user.id,
        resume_id=resume.id,
        resume_version_id=version.id,
        job_id=job.id,
        job_revision=job.revision,
        job_snapshot={
            'title': job.title,
            'company': job.company,
            'location': job.location,
            'url': job.url,
            'description': job.description,
            'profile': job_profile.model_dump(mode='json'),
        },
        resume_title=resume.title,
        resume_version_number=version.version_number,
        score=result.score,
        verdict=result.verdict,
        confidence=result.confidence,
        scoring_version=result.scoring_version,
        result=result.model_dump(mode='json'),
    )
    db.add(analysis)
    try:
        db.commit()
    except IntegrityError:
        # A concurrent identical request won the race; return its row.
        db.rollback()
        existing = db.query(Analysis).filter(
            Analysis.user_id == user.id, Analysis.resume_version_id == version.id, Analysis.job_id == job.id,
            Analysis.job_revision == job.revision, Analysis.scoring_version == SCORING_VERSION,
        ).first()
        if not existing:
            raise
        response.status_code = status.HTTP_200_OK
        return _analysis_out(existing)
    return _analysis_out(analysis)


@router.get('', response_model=Page[AnalysisListItem])
def list_analyses(
    resume_id: int | None = Query(default=None),
    job_id: int | None = Query(default=None),
    q: str | None = Query(default=None, max_length=200),
    verdict: str | None = Query(default=None, max_length=40),
    sort: str = Query(default='created', pattern='^(created|score)$'),
    page: Pagination = Depends(pagination),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Analysis).filter(Analysis.user_id == user.id)
    if resume_id is not None:
        query = query.filter(Analysis.resume_id == resume_id)
    if job_id is not None:
        query = query.filter(Analysis.job_id == job_id)
    if verdict:
        query = query.filter(Analysis.verdict == verdict)
    if q:
        like = f'%{q.strip()}%'
        # Job titles also live in the JSON snapshot; search the resume title and the live job.
        query = query.outerjoin(Job, Analysis.job_id == Job.id).filter(
            or_(Analysis.resume_title.ilike(like), Job.title.ilike(like), Job.company.ilike(like))
        )
    total = query.count()
    order = (Analysis.score.desc().nulls_last(), Analysis.created_at.desc()) if sort == 'score' else (Analysis.created_at.desc(),)
    rows = query.order_by(*order, Analysis.id.desc()).offset(page.offset).limit(page.limit).all()
    return Page(items=[AnalysisListItem(**_list_item(row)) for row in rows], total=total, limit=page.limit, offset=page.offset)


@router.get('/{analysis_id}', response_model=AnalysisOut)
def get_analysis(analysis_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _analysis_out(get_owned_analysis(db, user, analysis_id))


@router.delete('/{analysis_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(analysis_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(get_owned_analysis(db, user, analysis_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

