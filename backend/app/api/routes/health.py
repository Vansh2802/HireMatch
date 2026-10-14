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

    if settings.mock_llm:
        llm_status = 'mock'
    elif settings.llm_provider.lower() != 'openrouter':
        llm_status = 'unsupported_provider'
    elif settings.openrouter_api_key and settings.openrouter_model:
        llm_status = 'configured'
    else:
        llm_status = 'missing_credentials'
    overall_status = 'ok' if database_status == 'ok' else 'degraded'
    return {
        'status': overall_status,
        'app': settings.app_name,
        'dependencies': {
            'database': database_status,
            'llm': llm_status,
            'provider': settings.llm_provider,
            'model': settings.openrouter_model if settings.openrouter_model else None,
            'provider_connectivity': 'unknown',
        },
    }
