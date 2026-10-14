import os

os.environ['DATABASE_URL'] = 'sqlite:///./test_hirematch.db'
os.environ['MOCK_LLM'] = 'true'
os.environ['LLM_PROVIDER'] = 'openrouter'
os.environ.pop('OPENROUTER_API_KEY', None)

from app.core.database import Base, engine
from app.models import AuthSession, Candidate, Evaluation, User  # noqa: F401

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
