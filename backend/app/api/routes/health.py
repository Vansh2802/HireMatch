from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine

router = APIRouter()


@router.get('/health')
def health_check() -> dict:
    database_status = 'ok'
    try:
        with engine.connect() as connection:
            connection.execute(text('SELECT 1'))
    except Exception:
        database_status = 'unavailable'

    llm_status = 'mock' if settings.mock_llm else 'configured' if settings.groq_api_key else 'missing_credentials'
    overall_status = 'ok' if database_status == 'ok' else 'degraded'
    return {
        'status': overall_status,
        'app': settings.app_name,
        'dependencies': {'database': database_status, 'llm': llm_status},
    }
