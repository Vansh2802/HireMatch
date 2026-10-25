from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db, utcnow
from app.models.analysis import Analysis
from app.models.auth import User
from app.models.job import Job
from app.models.resume import Resume
from app.schemas.job import APPLICATION_STAGES
from app.services.matching_service import SCORING_VERSION

router = APIRouter(prefix='/dashboard', tags=['dashboard'])


@router.get('')
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """Overview metrics. Every number is computed from the user's own persisted records."""
    resume_count = db.query(func.count(Resume.id)).filter(Resume.user_id == user.id).scalar() or 0
    job_count = db.query(func.count(Job.id)).filter(Job.user_id == user.id).scalar() or 0
    analysis_count = db.query(func.count(Analysis.id)).filter(Analysis.user_id == user.id).scalar() or 0

    # Average of the best current-methodology score per job, so re-running analyses
    # on improved resume versions does not skew the figure.
    best_per_job = (
        db.query(func.max(Analysis.score).label('best'))
        .filter(Analysis.user_id == user.id, Analysis.scoring_version == SCORING_VERSION, Analysis.score.isnot(None), Analysis.job_id.isnot(None))
        .group_by(Analysis.job_id)
        .subquery()
    )
    average_best, scored_jobs = db.query(func.avg(best_per_job.c.best), func.count(best_per_job.c.best)).one()

    stage_rows = db.query(Job.stage, func.count(Job.id)).filter(Job.user_id == user.id).group_by(Job.stage).all()
    stages = {stage: 0 for stage in APPLICATION_STAGES}
    stages.update({stage: count for stage, count in stage_rows})

    recent = db.query(Analysis).filter(Analysis.user_id == user.id).order_by(Analysis.created_at.desc(), Analysis.id.desc()).limit(5).all()
    today = utcnow().date()
    follow_ups = (
        db.query(Job)
        .filter(Job.user_id == user.id, Job.follow_up_on.isnot(None), Job.stage.notin_(['completed', 'archived']))
        .order_by(Job.follow_up_on.asc())
        .limit(5)
        .all()
    )
    return {
        'counts': {'resumes': resume_count, 'jobs': job_count, 'analyses': analysis_count},
        'average_best_score': round(float(average_best)) if average_best is not None else None,
        'average_best_score_jobs': scored_jobs,
        'average_definition': (
            f'Mean of the highest score each saved job received (scoring v{SCORING_VERSION} only, '
            'analyses without a score excluded).'
        ),
        'stages': stages,
        'recent_analyses': [
            {
                'id': a.id,
                'job_title': (a.job_snapshot or {}).get('title'),
                'job_company': (a.job_snapshot or {}).get('company'),
                'resume_title': a.resume_title,
                'resume_version_number': a.resume_version_number,
                'score': a.score,
                'verdict': a.verdict,
                'created_at': a.created_at,
            }
            for a in recent
        ],
        'follow_ups': [
            {'id': j.id, 'title': j.title, 'company': j.company, 'stage': j.stage, 'follow_up_on': j.follow_up_on,
             'overdue': j.follow_up_on < today}
            for j in follow_ups
        ],
        'onboarding': {
            'has_resume': resume_count > 0,
            'has_job': job_count > 0,
            'has_analysis': analysis_count > 0,
            'dismissed': user.onboarding_dismissed_at is not None,
        },
    }


@router.post('/onboarding/dismiss', status_code=status.HTTP_204_NO_CONTENT)
def dismiss_onboarding(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.onboarding_dismissed_at = utcnow()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
