"""Background extraction for resumes and jobs.

Uploads are parsed synchronously (fast, and invalid files are rejected immediately);
the slower structured extraction (an LLM call in production) runs in a FastAPI
background task. Status is persisted on the row, so the client polls the resource
and a crash or restart can never leave work silently "in progress" forever.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal, utcnow
from app.models.job import Job
from app.models.resume import ResumeVersion
from app.services.job_extractor import extract_job_profile
from app.services.llm_service import LLMError
from app.services.resume_extractor import extract_resume_profile

logger = logging.getLogger(__name__)

GENERIC_FAILURE = 'Something went wrong while analysing this. Please retry.'
INTERRUPTED = 'Processing was interrupted before it finished. Please retry.'


def process_resume_version(version_id: int) -> None:
    db = SessionLocal()
    try:
        version = db.get(ResumeVersion, version_id)
        if version is None or version.status != 'processing':
            return
        try:
            result = extract_resume_profile(version.raw_text)
        except LLMError as exc:
            logger.warning('Resume extraction failed for version %s: %s', version_id, exc)
            version.status, version.error_message = 'failed', exc.public_message
        except Exception:
            logger.exception('Unexpected resume extraction failure for version %s', version_id)
            version.status, version.error_message = 'failed', GENERIC_FAILURE
        else:
            version.profile = result.profile.model_dump(mode='json')
            version.extraction_method = result.method
            version.warnings = [*(version.warnings or []), *result.warnings]
            version.status, version.error_message = 'ready', None
        version.processed_at = utcnow()
        db.commit()
    finally:
        db.close()


def process_job(job_id: int, revision: int) -> None:
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if job is None or job.status != 'processing' or job.revision != revision:
            return  # deleted, already handled, or superseded by a newer edit
        title, description = job.title, job.description
        try:
            profile = extract_job_profile(title, description)
        except LLMError as exc:
            logger.warning('Job extraction failed for job %s: %s', job_id, exc)
            outcome = {'status': 'failed', 'error_message': exc.public_message}
        except Exception:
            logger.exception('Unexpected job extraction failure for job %s', job_id)
            outcome = {'status': 'failed', 'error_message': GENERIC_FAILURE}
        else:
            outcome = {'status': 'ready', 'error_message': None, 'profile': profile.model_dump(mode='json')}
        db.refresh(job)
        if job.revision != revision or job.status != 'processing':
            return  # edited while we were extracting; the newer task owns the result
        for key, value in outcome.items():
            setattr(job, key, value)
        db.commit()
    finally:
        db.close()


def expire_stale(db: Session) -> int:
    """Mark processing work that has been running far too long as failed (retryable)."""
    cutoff = utcnow() - timedelta(minutes=settings.processing_stale_minutes)
    count = 0
    for version in db.query(ResumeVersion).filter(ResumeVersion.status == 'processing', ResumeVersion.processing_started_at < cutoff):
        version.status, version.error_message, version.processed_at = 'failed', INTERRUPTED, utcnow()
        count += 1
    for job in db.query(Job).filter(Job.status == 'processing', Job.processing_started_at < cutoff):
        job.status, job.error_message = 'failed', INTERRUPTED
        count += 1
    if count:
        db.commit()
    return count
