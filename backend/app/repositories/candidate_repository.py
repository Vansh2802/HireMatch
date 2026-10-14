from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.evaluation import Candidate


class CandidateRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, **kwargs) -> Candidate:
        candidate = Candidate(**kwargs)
        self.db.add(candidate)
        self.db.commit()
        self.db.refresh(candidate)
        return candidate

    def list_for_evaluation(self, evaluation_id: int, *, status: str | None = None, search: str | None = None) -> list[Candidate]:
        query = self.db.query(Candidate).filter(Candidate.evaluation_id == evaluation_id)
        if status:
            query = query.filter(Candidate.processing_status == status)
        if search:
            query = query.filter(Candidate.candidate_name.ilike(f'%{search}%'))
        return query.order_by(Candidate.match_score.desc().nullslast(), Candidate.created_at.desc()).all()

    def get(self, candidate_id: int) -> Candidate | None:
        return self.db.query(Candidate).filter(Candidate.id == candidate_id).first()

    def delete(self, candidate: Candidate) -> None:
        self.db.delete(candidate)
        self.db.commit()
