from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.auth import User
from app.models.evaluation import Candidate, Evaluation
from app.services.file_validation import safe_delete_file

router = APIRouter(prefix='/candidates', tags=['candidates'])


@router.get('/{candidate_id}')
def get_candidate(candidate_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    candidate = db.query(Candidate).join(Evaluation).filter(Candidate.id == candidate_id, Evaluation.user_id == user.id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail='Candidate not found.')
    return {
        'id': candidate.id,
        'evaluation_id': candidate.evaluation_id,
        'candidate_name': candidate.candidate_name,
        'email': candidate.email,
        'phone': candidate.phone,
        'structured_resume': candidate.structured_resume,
        'match_score': candidate.match_score,
        'verdict': candidate.verdict,
        'evaluation_details': candidate.evaluation_details,
        'processing_status': candidate.processing_status,
        'error_message': candidate.error_message,
    }


@router.delete('/{candidate_id}')
def delete_candidate(candidate_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    candidate = db.query(Candidate).join(Evaluation).filter(Candidate.id == candidate_id, Evaluation.user_id == user.id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail='Candidate not found.')
    safe_delete_file(candidate.stored_file_path)
    db.delete(candidate)
    db.commit()
    return {'deleted': True, 'candidate_id': candidate_id}
