from __future__ import annotations

import asyncio
import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.database import SessionLocal, get_db
from app.models.auth import User
from app.models.evaluation import Evaluation
from app.repositories.candidate_repository import CandidateRepository
from app.repositories.evaluation_repository import EvaluationRepository
from app.schemas.evaluation import EvaluationCreateRequest
from app.schemas.job import JobRequirements
from app.services.document_parser import parse_uploaded_document
from app.services.file_validation import read_limited_upload, safe_delete_file
from app.services.job_extractor import extract_job_requirements
from app.services.llm_service import LLMError
from app.services.matching_service import match_candidate_to_job
from app.services.resume_extractor import extract_resume_profile

router = APIRouter(prefix='/evaluations', tags=['evaluations'])


def _process_resume_upload(
    *,
    evaluation_id: int,
    filename: str | None,
    file_bytes: bytes,
    job_payload: dict,
) -> dict:
    job = JobRequirements.model_validate(job_payload)
    db = SessionLocal()
    try:
        candidate_repo = CandidateRepository(db)
        try:
            parsed = parse_uploaded_document(filename or 'resume.pdf', file_bytes)
            if len(parsed['text']) > settings.max_resume_text_chars:
                raise ValueError('Resume text exceeds the processing limit.')
            resume = extract_resume_profile(parsed['text'])
            match_result = match_candidate_to_job(job, resume)
            candidate = candidate_repo.create(
                evaluation_id=evaluation_id,
                candidate_name=resume.name or 'Candidate',
                email=resume.email,
                phone=resume.phone,
                structured_resume=resume.model_dump(mode='json'),
                match_score=match_result['score'],
                verdict=match_result['verdict'],
                evaluation_details=match_result,
                processing_status='completed',
                file_name=filename,
                stored_file_path=None,
            )
            return {'id': candidate.id, 'status': 'completed', 'name': candidate.candidate_name, 'score': candidate.match_score}
        except (ValueError, RuntimeError, LLMError) as exc:
            candidate = candidate_repo.create(
                evaluation_id=evaluation_id,
                candidate_name='Unparsed Candidate',
                structured_resume={},
                processing_status='failed',
                error_message=str(exc),
                file_name=filename,
                stored_file_path=None,
            )
            return {'id': candidate.id, 'status': 'failed', 'name': candidate.candidate_name, 'error': str(exc)}
    finally:
        db.close()


@router.post('')
def create_evaluation(payload: EvaluationCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    repo = EvaluationRepository(db)
    try:
        job = extract_job_requirements(payload.job_title, payload.job_description)
    except LLMError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    evaluation = repo.create(
        job_title=payload.job_title,
        job_description=payload.job_description,
        structured_job=job.model_dump(mode='json'),
        user_id=user.id,
    )
    return {
        'id': evaluation.id,
        'job_title': evaluation.job_title,
        'status': evaluation.status,
        'structured_job': evaluation.structured_job,
    }


@router.get('')
def list_evaluations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    evaluations = db.query(Evaluation).filter(Evaluation.user_id == user.id).order_by(Evaluation.created_at.desc()).all()
    result = []
    for item in evaluations:
        scores = [candidate.match_score for candidate in item.candidates if candidate.match_score is not None]
        average_score = round(sum(scores) / len(scores), 2) if scores else None
        result.append({
            'id': item.id,
            'job_title': item.job_title,
            'status': item.status,
            'created_at': item.created_at.isoformat(),
            'updated_at': item.updated_at.isoformat(),
            'candidate_count': len(item.candidates),
            'average_score': average_score,
        })
    return result


@router.get('/{evaluation_id}')
def get_evaluation_details(evaluation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id, Evaluation.user_id == user.id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail='Evaluation not found.')
    return {
        'id': evaluation.id,
        'job_title': evaluation.job_title,
        'job_description': evaluation.job_description,
        'structured_job': evaluation.structured_job,
        'status': evaluation.status,
        'created_at': evaluation.created_at.isoformat(),
        'updated_at': evaluation.updated_at.isoformat(),
        'candidates': [
            {
                'id': candidate.id,
                'candidate_name': candidate.candidate_name,
                'match_score': candidate.match_score,
                'verdict': candidate.verdict,
                'processing_status': candidate.processing_status,
                'error_message': candidate.error_message,
            }
            for candidate in evaluation.candidates
        ],
    }


@router.post('/{evaluation_id}/resumes')
async def upload_resumes(evaluation_id: int, files: list[UploadFile] = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if len(files) > settings.max_files_per_request:
        raise HTTPException(status_code=413, detail=f'Too many files. Upload no more than {settings.max_files_per_request} resumes at a time.')
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id, Evaluation.user_id == user.id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail='Evaluation not found.')

    try:
        job = JobRequirements.model_validate(evaluation.structured_job or {})
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Evaluation requirements are unavailable.') from exc

    job_payload = job.model_dump(mode='json')
    results = []
    for upload in files or []:
        file_bytes = read_limited_upload(upload.file)
        result = await asyncio.to_thread(
            _process_resume_upload,
            evaluation_id=evaluation.id,
            filename=upload.filename,
            file_bytes=file_bytes,
            job_payload=job_payload,
        )
        results.append(result)

    evaluation.status = 'completed' if results else 'pending'
    db.commit()
    return {'evaluation_id': evaluation.id, 'results': results}


@router.get('/{evaluation_id}/candidates')
def list_candidates(
    evaluation_id: int,
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id, Evaluation.user_id == user.id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail='Evaluation not found.')
    candidates = CandidateRepository(db).list_for_evaluation(evaluation_id, status=status, search=search)
    return [
        {
            'id': candidate.id,
            'candidate_name': candidate.candidate_name,
            'email': candidate.email,
            'match_score': candidate.match_score,
            'verdict': candidate.verdict,
            'processing_status': candidate.processing_status,
            'error_message': candidate.error_message,
        }
        for candidate in candidates
    ]


@router.get('/{evaluation_id}/export')
def export_evaluation_csv(evaluation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id, Evaluation.user_id == user.id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail='Evaluation not found.')

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['candidate_name', 'match_score', 'verdict', 'email'])
    for candidate in evaluation.candidates:
        writer.writerow([candidate.candidate_name, candidate.match_score or '', candidate.verdict or '', candidate.email or ''])
    return {'csv': output.getvalue()}


@router.delete('/{evaluation_id}')
def delete_evaluation(evaluation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id, Evaluation.user_id == user.id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail='Evaluation not found.')
    for candidate in evaluation.candidates:
        safe_delete_file(candidate.stored_file_path)
    db.delete(evaluation)
    db.commit()
    return {'deleted': True, 'evaluation_id': evaluation_id}
