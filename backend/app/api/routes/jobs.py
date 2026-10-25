from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.dependencies import Pagination, get_current_user, not_found, pagination
from app.core.config import settings
from app.core.database import get_db, utcnow
from app.models.analysis import Analysis
from app.models.auth import User
from app.models.job import Job
from app.schemas.common import Page
from app.schemas.job import (
    APPLICATION_STAGES,
    JobCreateRequest,
    JobListItem,
    JobOut,
    JobProfile,
    JobRequirementsUpdateRequest,
    JobUpdateRequest,
)
from app.services.processing import process_job

router = APIRouter(prefix='/jobs', tags=['jobs'])


def _analysis_stats(db: Session, user: User, job_ids: list[int]) -> dict[int, tuple[int, int | None, int | None]]:
    if not job_ids:
        return {}
    rows = (
        db.query(Analysis.job_id, func.count(Analysis.id), func.max(Analysis.score), func.max(Analysis.id))
        .filter(Analysis.user_id == user.id, Analysis.job_id.in_(job_ids))
        .group_by(Analysis.job_id)
        .all()
    )
    return {job_id: (count, best, latest) for job_id, count, best, latest in rows}


def get_owned_job(db: Session, user: User, job_id: int) -> Job:
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == user.id).first()
    if not job:
        raise not_found('Job')
    return job


def _job_out(db: Session, user: User, job: Job) -> JobOut:
    count, best, latest = _analysis_stats(db, user, [job.id]).get(job.id, (0, None, None))
    return JobOut(
        id=job.id,
        title=job.title,
        company=job.company,
        location=job.location,
        url=job.url,
        description=job.description,
        status=job.status,
        error_message=job.error_message,
        revision=job.revision,
        profile=JobProfile.model_validate(job.profile) if job.profile else None,
        stage=job.stage,
        notes=job.notes,
        applied_on=job.applied_on,
        follow_up_on=job.follow_up_on,
        created_at=job.created_at,
        updated_at=job.updated_at,
        analysis_count=count,
        best_score=best,
        latest_analysis_id=latest,
    )


def _start_processing(job: Job) -> None:
    job.status, job.error_message, job.processing_started_at = 'processing', None, utcnow()


@router.get('', response_model=Page[JobListItem])
def list_jobs(
    q: str | None = Query(default=None, max_length=200),
    stage: str | None = Query(default=None),
    sort: str = Query(default='updated', pattern='^(updated|created|title|follow_up)$'),
    page: Pagination = Depends(pagination),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Job).filter(Job.user_id == user.id)
    if stage:
        stages = [item for item in stage.split(',') if item in APPLICATION_STAGES]
        if not stages:
            raise HTTPException(status_code=422, detail='Unknown application stage.')
        query = query.filter(Job.stage.in_(stages))
    if q:
        like = f'%{q.strip()}%'
        query = query.filter(or_(Job.title.ilike(like), Job.company.ilike(like), Job.location.ilike(like)))
    total = query.count()
    order = {
        'updated': (Job.updated_at.desc(),),
        'created': (Job.created_at.desc(),),
        'title': (Job.title.asc(),),
        'follow_up': (Job.follow_up_on.is_(None), Job.follow_up_on.asc()),
    }[sort]
    jobs = query.order_by(*order, Job.id.desc()).offset(page.offset).limit(page.limit).all()
    stats = _analysis_stats(db, user, [job.id for job in jobs])
    items = []
    for job in jobs:
        count, best, latest = stats.get(job.id, (0, None, None))
        items.append(JobListItem(
            id=job.id, title=job.title, company=job.company, location=job.location, status=job.status, stage=job.stage,
            requirement_count=len((job.profile or {}).get('requirements', [])), created_at=job.created_at, updated_at=job.updated_at,
            applied_on=job.applied_on, follow_up_on=job.follow_up_on, analysis_count=count, best_score=best, latest_analysis_id=latest,
        ))
    return Page(items=items, total=total, limit=page.limit, offset=page.offset)


@router.post('', response_model=JobOut, status_code=status.HTTP_202_ACCEPTED)
def create_job(payload: JobCreateRequest, background: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if db.query(Job).filter(Job.user_id == user.id).count() >= settings.max_jobs_per_user:
        raise HTTPException(status_code=409, detail=f'You can save up to {settings.max_jobs_per_user} jobs. Delete some to add more.')
    if len(payload.description) > settings.max_job_description_chars:
        raise HTTPException(status_code=422, detail=f'The job description is longer than {settings.max_job_description_chars:,} characters.')
    job = Job(
        user_id=user.id, title=payload.title, company=payload.company, location=payload.location, url=payload.url,
        description=payload.description, revision=1,
    )
    _start_processing(job)
    db.add(job)
    db.commit()
    background.add_task(process_job, job.id, job.revision)
    return _job_out(db, user, job)


@router.get('/{job_id}', response_model=JobOut)
def get_job(job_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _job_out(db, user, get_owned_job(db, user, job_id))


@router.patch('/{job_id}', response_model=JobOut)
def update_job(
    job_id: int,
    payload: JobUpdateRequest,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = get_owned_job(db, user, job_id)
    changes = payload.model_dump(exclude_unset=True)
    if 'title' in changes and not (changes['title'] or '').strip():
        raise HTTPException(status_code=422, detail='The job title cannot be empty.')
    description = changes.pop('description', None)
    for key, value in changes.items():
        setattr(job, key, value.strip() if isinstance(value, str) and key != 'notes' else value)
    if 'stage' in changes and changes['stage'] == 'applied' and job.applied_on is None and 'applied_on' not in changes:
        job.applied_on = utcnow().date()
    reprocess = description is not None and description.strip() != job.description
    if reprocess:
        if len(description) > settings.max_job_description_chars:
            raise HTTPException(status_code=422, detail=f'The job description is longer than {settings.max_job_description_chars:,} characters.')
        job.description = description.strip()
        job.revision += 1
        _start_processing(job)
    job.updated_at = utcnow()
    db.commit()
    if reprocess:
        background.add_task(process_job, job.id, job.revision)
    return _job_out(db, user, job)


@router.put('/{job_id}/requirements', response_model=JobOut)
def update_requirements(
    job_id: int,
    payload: JobRequirementsUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove misidentified requirements or change required/preferred. Creates a new job revision."""
    job = get_owned_job(db, user, job_id)
    if job.status != 'ready' or not job.profile:
        raise HTTPException(status_code=409, detail='Requirements can be edited once extraction has finished.')
    if payload.base_revision != job.revision:
        raise HTTPException(status_code=409, detail='This job changed since you started editing. Reload to see the latest version.')
    profile = JobProfile.model_validate(job.profile)
    existing = {requirement.id: requirement for requirement in profile.requirements}
    unknown = [edit.id for edit in payload.keep if edit.id not in existing]
    if unknown:
        raise HTTPException(status_code=422, detail='Unknown requirement id.')
    kept = []
    for edit in payload.keep:
        requirement = existing[edit.id]
        if requirement.importance != edit.importance:
            requirement = requirement.model_copy(update={'importance': edit.importance, 'uncertain': False})
        kept.append(requirement)
    profile.requirements = kept
    job.profile = profile.model_dump(mode='json')
    job.revision += 1
    job.updated_at = utcnow()
    db.commit()
    return _job_out(db, user, job)


@router.post('/{job_id}/retry', response_model=JobOut, status_code=status.HTTP_202_ACCEPTED)
def retry_job(job_id: int, background: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = get_owned_job(db, user, job_id)
    is_legacy = job.status == 'ready' and (job.profile or {}).get('method') == 'legacy'
    if job.status != 'failed' and not is_legacy:
        raise HTTPException(status_code=409, detail='Only jobs whose extraction failed (or imported jobs) can be re-extracted.')
    if is_legacy:
        job.revision += 1  # requirements will change, so earlier analyses keep the old revision
    _start_processing(job)
    db.commit()
    background.add_task(process_job, job.id, job.revision)
    return _job_out(db, user, job)


@router.delete('/{job_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_job(job_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = get_owned_job(db, user, job_id)
    # Analyses keep their own snapshot of the job, so they remain readable after the job is deleted.
    db.query(Analysis).filter(Analysis.user_id == user.id, Analysis.job_id == job.id).update({Analysis.job_id: None}, synchronize_session=False)
    db.delete(job)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
