from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.evaluation import Evaluation


class EvaluationRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, *, job_title: str, job_description: str, structured_job: dict | None, user_id: int | None = None) -> Evaluation:
        evaluation = Evaluation(job_title=job_title, job_description=job_description, structured_job=structured_job, status='pending', user_id=user_id)
        self.db.add(evaluation)
        self.db.commit()
        self.db.refresh(evaluation)
        return evaluation

    def list(self) -> list[Evaluation]:
        return self.db.query(Evaluation).order_by(Evaluation.created_at.desc()).all()

    def get(self, evaluation_id: int) -> Evaluation | None:
        return self.db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()

    def delete(self, evaluation: Evaluation) -> None:
        self.db.delete(evaluation)
        self.db.commit()
