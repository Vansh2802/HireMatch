from __future__ import annotations

import re
from pathlib import PurePath

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import Pagination, get_current_user, not_found, pagination
from app.core.config import settings
from app.core.database import get_db, utcnow
from app.models.analysis import Analysis
from app.models.auth import User
from app.models.resume import Resume, ResumeVersion
from app.schemas.common import Page
from app.schemas.resume import (
    ResumeDetailOut,
    ResumeProfile,
    ResumeProfileUpdateRequest,
    ResumeSummaryOut,
    ResumeUpdateRequest,
    ResumeVersionDetail,
    ResumeVersionOut,
)
from app.services.document_parser import parse_uploaded_document
from app.services.file_validation import read_limited_upload
from app.services.processing import process_resume_version

router = APIRouter(prefix='/resumes', tags=['resumes'])


def _version_out(version: ResumeVersion, *, detail: bool = False) -> ResumeVersionOut:
    data = {
        'id': version.id,
        'version_number': version.version_number,
        'source': version.source,
        'status': version.status,
        'error_message': version.error_message,
        'file_name': version.file_name,
        'file_size': version.file_size,
        'page_count': version.page_count,
        'extraction_method': version.extraction_method,
        'warnings': version.warnings or [],
        'profile': ResumeProfile.model_validate(version.profile) if version.profile else None,
        'text_length': len(version.raw_text or ''),
        'created_at': version.created_at,
    }
    if detail:
        return ResumeVersionDetail(**data, raw_text=version.raw_text or '')
    return ResumeVersionOut(**data)


def _analysis_stats(db: Session, user: User, resume_ids: list[int]) -> dict[int, tuple[int, int | None]]:
    if not resume_ids:
        return {}
    rows = (
        db.query(Analysis.resume_id, func.count(Analysis.id), func.max(Analysis.score))
        .filter(Analysis.user_id == user.id, Analysis.resume_id.in_(resume_ids))
        .group_by(Analysis.resume_id)
        .all()
    )
    return {resume_id: (count, best) for resume_id, count, best in rows}


def _summary(resume: Resume, stats: tuple[int, int | None]) -> dict:
    current = resume.current_version
    return {
        'id': resume.id,
        'title': resume.title,
        'created_at': resume.created_at,
        'updated_at': resume.updated_at,
        'version_count': len(resume.versions),
        'analysis_count': stats[0],
        'best_score': stats[1],
        'current_version': current,
    }


def get_owned_resume(db: Session, user: User, resume_id: int) -> Resume:
    resume = (
        db.query(Resume)
        .options(selectinload(Resume.versions))
        .filter(Resume.id == resume_id, Resume.user_id == user.id)
        .first()
    )
    if not resume:
        raise not_found('Resume')
    return resume


def _detail(db: Session, user: User, resume: Resume) -> ResumeDetailOut:
    stats = _analysis_stats(db, user, [resume.id]).get(resume.id, (0, None))
    data = _summary(resume, stats)
    current = data.pop('current_version')
    return ResumeDetailOut(
        **data,
        current_version=_version_out(current, detail=True) if current else None,
        versions=[_version_out(version) for version in reversed(resume.versions)],
    )


async def _read_and_parse(file: UploadFile) -> dict:
    try:
        file_bytes = read_limited_upload(file.file)
        return parse_uploaded_document(file.filename or '', file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


def _duplicate_check(db: Session, user: User, sha256: str) -> None:
    existing = (
        db.query(ResumeVersion, Resume)
        .join(Resume, ResumeVersion.resume_id == Resume.id)
        .filter(Resume.user_id == user.id, ResumeVersion.file_sha256 == sha256, ResumeVersion.status != 'failed')
        .first()
    )
    if existing:
        version, resume = existing
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                'message': f'You already uploaded this exact file as "{resume.title}" (version {version.version_number}).',
                'resume_id': resume.id,
            },
        )


def _new_version(resume: Resume, parsed: dict, number: int) -> ResumeVersion:
    return ResumeVersion(
        resume=resume,
        version_number=number,
        source='upload',
        status='processing',
        file_name=parsed['file_name'],
        file_size=parsed['size_bytes'],
        file_sha256=parsed['sha256'],
        page_count=parsed['pages'],
        raw_text=parsed['text'],
        warnings=parsed['warnings'],
        processing_started_at=utcnow(),
    )


@router.get('', response_model=Page[ResumeSummaryOut])
def list_resumes(
    q: str | None = Query(default=None, max_length=200),
    sort: str = Query(default='updated', pattern='^(updated|created|title)$'),
    page: Pagination = Depends(pagination),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Resume).filter(Resume.user_id == user.id)
    if q:
        like = f'%{q.strip()}%'
        query = query.filter(or_(Resume.title.ilike(like)))
    total = query.count()
    order = {'updated': Resume.updated_at.desc(), 'created': Resume.created_at.desc(), 'title': Resume.title.asc()}[sort]
    resumes = query.options(selectinload(Resume.versions)).order_by(order, Resume.id.desc()).offset(page.offset).limit(page.limit).all()
    stats = _analysis_stats(db, user, [resume.id for resume in resumes])
    items = []
    for resume in resumes:
        data = _summary(resume, stats.get(resume.id, (0, None)))
        current = data.pop('current_version')
        items.append(ResumeSummaryOut(**data, current_version=_version_out(current) if current else None))
    return Page(items=items, total=total, limit=page.limit, offset=page.offset)


@router.post('', response_model=ResumeDetailOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_resume(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    title: str | None = Form(default=None, max_length=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if db.query(Resume).filter(Resume.user_id == user.id).count() >= settings.max_resumes_per_user:
        raise HTTPException(status_code=409, detail=f'You can keep up to {settings.max_resumes_per_user} resumes. Delete one to upload another.')
    parsed = await _read_and_parse(file)
    _duplicate_check(db, user, parsed['sha256'])
    clean_title = (title or '').strip() or re.sub(r'[_\-.]+', ' ', PurePath(parsed['file_name']).stem).strip()[:200] or 'My resume'
    resume = Resume(user_id=user.id, title=clean_title)
    version = _new_version(resume, parsed, 1)
    db.add_all([resume, version])
    db.commit()
    background.add_task(process_resume_version, version.id)
    return _detail(db, user, get_owned_resume(db, user, resume.id))


@router.get('/{resume_id}', response_model=ResumeDetailOut)
def get_resume(resume_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _detail(db, user, get_owned_resume(db, user, resume_id))


@router.patch('/{resume_id}', response_model=ResumeDetailOut)
def rename_resume(resume_id: int, payload: ResumeUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    resume = get_owned_resume(db, user, resume_id)
    resume.title = payload.title.strip()
    db.commit()
    return _detail(db, user, resume)


@router.delete('/{resume_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_resume(resume_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    resume = get_owned_resume(db, user, resume_id)
    # Analyses of this resume contain its extracted content, so they are removed with it.
    db.query(Analysis).filter(Analysis.user_id == user.id, Analysis.resume_id == resume.id).delete(synchronize_session=False)
    db.delete(resume)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post('/{resume_id}/versions', response_model=ResumeDetailOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_new_version(
    resume_id: int,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resume = get_owned_resume(db, user, resume_id)
    if len(resume.versions) >= 50:
        raise HTTPException(status_code=409, detail='This resume has reached the 50-version limit. Upload it as a new resume instead.')
    parsed = await _read_and_parse(file)
    _duplicate_check(db, user, parsed['sha256'])
    version = _new_version(resume, parsed, max(v.version_number for v in resume.versions) + 1)
    resume.updated_at = utcnow()
    db.add(version)
    db.commit()
    background.add_task(process_resume_version, version.id)
    db.refresh(resume)
    return _detail(db, user, get_owned_resume(db, user, resume.id))


@router.put('/{resume_id}/profile', response_model=ResumeDetailOut, status_code=status.HTTP_201_CREATED)
def save_profile_corrections(
    resume_id: int,
    payload: ResumeProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save user corrections as a new version; earlier versions and their analyses are unchanged."""
    resume = get_owned_resume(db, user, resume_id)
    current = resume.current_version
    if current is None or current.status != 'ready':
        raise HTTPException(status_code=409, detail='This resume has no processed version to correct yet.')
    if payload.base_version_id is not None and payload.base_version_id != current.id:
        raise HTTPException(status_code=409, detail='This resume changed since you started editing. Reload to see the latest version.')
    profile = payload.profile
    original_years = (current.profile or {}).get('total_experience_years')
    if profile.total_experience_years != original_years:
        profile.experience_years_source = 'user' if profile.total_experience_years is not None else None
    version = ResumeVersion(
        resume=resume,
        version_number=max(v.version_number for v in resume.versions) + 1,
        source='edit',
        status='ready',
        file_name=current.file_name,
        file_size=current.file_size,
        file_sha256=None,
        page_count=current.page_count,
        raw_text=current.raw_text,
        profile=profile.model_dump(mode='json'),
        warnings=[f'Edited from version {current.version_number}. The document text is unchanged; corrections apply to the extracted profile.'],
        extraction_method='user',
        processed_at=utcnow(),
    )
    resume.updated_at = utcnow()
    db.add(version)
    db.commit()
    return _detail(db, user, get_owned_resume(db, user, resume.id))


@router.get('/{resume_id}/versions/{version_id}', response_model=ResumeVersionDetail)
def get_version(resume_id: int, version_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    resume = get_owned_resume(db, user, resume_id)
    version = next((v for v in resume.versions if v.id == version_id), None)
    if not version:
        raise not_found('Resume version')
    return _version_out(version, detail=True)


@router.post('/{resume_id}/versions/{version_id}/retry', response_model=ResumeDetailOut, status_code=status.HTTP_202_ACCEPTED)
def retry_version(
    resume_id: int,
    version_id: int,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resume = get_owned_resume(db, user, resume_id)
    version = next((v for v in resume.versions if v.id == version_id), None)
    if not version:
        raise not_found('Resume version')
    if version.status != 'failed':
        raise HTTPException(status_code=409, detail='Only failed versions can be retried.')
    version.status, version.error_message, version.processing_started_at = 'processing', None, utcnow()
    db.commit()
    background.add_task(process_resume_version, version.id)
    return _detail(db, user, resume)
