import os
import tempfile
from pathlib import Path

# Tests always run against a throwaway SQLite file and the deterministic extractor,
# never against a developer or production database or the paid AI provider.
_TEST_DB = Path(tempfile.gettempdir()) / f'hirematch_test_{os.getpid()}.db'
os.environ['DATABASE_URL'] = f'sqlite:///{_TEST_DB.as_posix()}'
os.environ['MOCK_LLM'] = 'true'
os.environ['LLM_PROVIDER'] = 'openrouter'
os.environ['OPENROUTER_API_KEY'] = ''
os.environ['ENVIRONMENT'] = 'test'

import pytest  # noqa: E402

from app.core.config import settings  # noqa: E402

settings.openrouter_api_key = None
settings.mock_llm = True
settings.database_url = os.environ['DATABASE_URL']

from app.core.database import Base, engine  # noqa: E402
from app.core.rate_limit import login_limiter, rate_limiter  # noqa: E402
from app.models import Analysis, AuthSession, Job, Resume, ResumeVersion, User  # noqa: E402,F401

assert 'hirematch_test_' in str(engine.url), 'Refusing to run tests against a non-test database'
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    rate_limiter.reset()
    login_limiter.reset()
    yield


def pytest_sessionfinish(session, exitstatus):
    engine.dispose()
    try:
        _TEST_DB.unlink(missing_ok=True)
    except OSError:
        pass
