import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.analyses import router as analyses_router
from app.api.routes.auth import router as auth_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.health import router as health_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.resumes import router as resumes_router
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.rate_limit import rate_limiter
from app.services.processing import expire_stale

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s [%(name)s] %(message)s')
logger = logging.getLogger(__name__)

UNSAFE_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}
# Multipart overhead allowance on top of the file size limit.
MAX_UPLOAD_BODY_BYTES = settings.max_upload_size_mb * 1024 * 1024 + 256 * 1024
MAX_JSON_BODY_BYTES = 256 * 1024


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db = SessionLocal()
    try:
        expired = expire_stale(db)
        if expired:
            logger.info('Marked %s interrupted processing item(s) as failed', expired)
    except Exception:  # the table may not exist yet before migrations run
        logger.warning('Could not check for interrupted processing work', exc_info=True)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    version='2.0.0',
    description='Explainable resume-to-job matching for job seekers.',
    lifespan=lifespan,
    docs_url='/docs' if settings.docs_enabled else None,
    redoc_url=None,
    openapi_url='/openapi.json' if settings.docs_enabled else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allow_headers=['Content-Type'],
    max_age=600,
)


def _rate_limit_key(request: Request) -> str | None:
    path = request.url.path
    prefix = settings.api_prefix
    if request.method != 'POST':
        return None
    if path in {f'{prefix}/auth/login', f'{prefix}/auth/register'}:
        return 'auth'
    if path == f'{prefix}/resumes' or (path.startswith(f'{prefix}/resumes/') and (path.endswith('/versions') or path.endswith('/retry'))):
        return 'upload'
    if path == f'{prefix}/jobs' or (path.startswith(f'{prefix}/jobs/') and path.endswith('/retry')):
        return 'extract'
    if path == f'{prefix}/analyses':
        return 'analyse'
    return None


def _error(status_code: int, detail: str, headers: dict | None = None) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={'detail': detail}, headers=headers)


@app.middleware('http')
async def protect_requests(request: Request, call_next):
    if request.method in UNSAFE_METHODS:
        # CSRF defence in depth (cookies are already SameSite=Lax): browsers always send
        # Origin on cross-site unsafe requests, so reject any origin we do not serve.
        origin = request.headers.get('origin')
        if origin and origin.rstrip('/') not in settings.allowed_origins_list and origin.rstrip('/') != str(request.base_url).rstrip('/'):
            return _error(403, 'Cross-site request blocked.')

        content_length = request.headers.get('content-length')
        limit = MAX_UPLOAD_BODY_BYTES if 'multipart/form-data' in request.headers.get('content-type', '') else MAX_JSON_BODY_BYTES
        if content_length:
            try:
                too_large = int(content_length) > limit
            except ValueError:
                return _error(400, 'Invalid Content-Length header.')
            if too_large:
                return _error(413, f'The request is too large. Files must be under {settings.max_upload_size_mb} MB.')

        bucket = _rate_limit_key(request)
        if bucket:
            client_host = request.client.host if request.client else 'unknown'
            if not rate_limiter.allow(f'{bucket}:{client_host}', settings.rate_limit_per_minute):
                return _error(429, 'Too many requests. Please wait a minute and try again.', {'Retry-After': '60'})

    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
    if request.url.path.startswith(settings.api_prefix):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Content-Security-Policy'] = "default-src 'none'; frame-ancestors 'none'"
    if settings.session_cookie_secure:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_request: Request, exc: RequestValidationError):
    messages = []
    for error in exc.errors()[:5]:
        location = '.'.join(str(part) for part in error.get('loc', ()) if part not in ('body', 'query', 'path'))
        message = str(error.get('msg', 'Invalid value')).removeprefix('Value error, ')
        messages.append(f'{location}: {message}' if location else message)
    return _error(422, '; '.join(messages) or 'Invalid request.')


@app.exception_handler(HTTPException)
async def handle_http_error(_request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={'detail': exc.detail}, headers=getattr(exc, 'headers', None))


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception):
    logger.exception('Unhandled application error for %s %s', request.method, request.url.path)
    return _error(500, 'An unexpected server error occurred. Please try again.')


app.include_router(health_router, prefix=settings.api_prefix)
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(dashboard_router, prefix=settings.api_prefix)
app.include_router(resumes_router, prefix=settings.api_prefix)
app.include_router(jobs_router, prefix=settings.api_prefix)
app.include_router(analyses_router, prefix=settings.api_prefix)


@app.get('/')
def root() -> dict:
    return {'app': settings.app_name, 'status': 'online'}
