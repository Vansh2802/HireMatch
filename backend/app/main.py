from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.candidates import router as candidates_router
from app.api.routes.evaluations import router as evaluations_router
from app.api.routes.health import router as health_router
from app.core.config import settings
from app.core.database import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name, version='0.1.0', description='AI-powered resume evaluation and job matching platform.')

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(health_router, prefix=settings.api_prefix)
app.include_router(evaluations_router, prefix=settings.api_prefix)
app.include_router(candidates_router, prefix=settings.api_prefix)


@app.get('/')
def root() -> dict:
    return {'app': settings.app_name, 'status': 'online'}
