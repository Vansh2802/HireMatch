from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
from app.services.matching_service import SCORING_VERSION

router = APIRouter()


@router.get('/health')
def health_check() -> dict:
    """Non-secret readiness information. Never calls the paid AI provider."""
    database_status = 'ok'
    try:
        with engine.connect() as connection:
            connection.execute(text('SELECT 1'))
    except Exception:
        database_status = 'unavailable'

    return {
        'status': 'ok' if database_status == 'ok' else 'degraded',
        'app': settings.app_name,
        'scoring_version': SCORING_VERSION,
        'dependencies': {
            'database': database_status,
            'llm': settings.llm_mode,
            'provider': settings.llm_provider,
            'model': settings.openrouter_model or None,
            'provider_connectivity': 'unknown',
        },
        'limits': {
            'max_upload_size_mb': settings.max_upload_size_mb,
            'max_job_description_chars': settings.max_job_description_chars,
        },
    }
