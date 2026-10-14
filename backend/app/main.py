import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.auth import router as auth_router
from app.api.routes.candidates import router as candidates_router
from app.api.routes.evaluations import router as evaluations_router
from app.api.routes.health import router as health_router
from app.core.config import settings
from app.core.rate_limit import rate_limiter

logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name, version='0.1.0', description='AI-powered resume evaluation and job matching platform.')

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.middleware('http')
async def protect_requests(request: Request, call_next):
    path = request.url.path
    expensive = (
        request.method == 'POST' and (
            path == f'{settings.api_prefix}/evaluations'
            or path.endswith('/resumes')
            or path in {f'{settings.api_prefix}/auth/login', f'{settings.api_prefix}/auth/register'}
        )
    )
    if expensive:
        client_host = request.client.host if request.client else 'unknown'
        key = f'{client_host}:{path}'
        if not rate_limiter.allow(key, settings.rate_limit_per_minute):
            return JSONResponse(
                status_code=429,
                content={'detail': 'Too many requests. Please try again later.'},
                headers={'Retry-After': '60'},
            )

    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'same-origin'
    return response


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception):
    logger.exception('Unhandled application error for %s %s', request.method, request.url.path)
    return JSONResponse(status_code=500, content={'detail': 'An internal server error occurred.'})

app.include_router(health_router, prefix=settings.api_prefix)
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(evaluations_router, prefix=settings.api_prefix)
app.include_router(candidates_router, prefix=settings.api_prefix)


@app.get('/')
def root() -> dict:
    return {'app': settings.app_name, 'status': 'online'}
