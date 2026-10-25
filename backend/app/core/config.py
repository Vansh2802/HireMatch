from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Reads backend/.env if present, else the repository-root .env (later files take priority).
    model_config = SettingsConfigDict(env_file=('../.env', '.env'), env_file_encoding='utf-8', extra='ignore')

    app_name: str = Field(default='HireMatch', alias='APP_NAME')
    environment: str = Field(default='development', alias='ENVIRONMENT')
    api_prefix: str = Field(default='/api', alias='API_PREFIX')
    allowed_origins: str = Field(
        default='http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000',
        alias='ALLOWED_ORIGINS',
    )
    expose_api_docs: bool | None = Field(default=None, alias='EXPOSE_API_DOCS')
    database_url: str = Field(default='sqlite:///./hirematch.db', alias='DATABASE_URL')

    openrouter_api_key: str | None = Field(default=None, alias='OPENROUTER_API_KEY')
    openrouter_model: str = Field(default='openai/gpt-4o-mini', alias='OPENROUTER_MODEL')
    openrouter_base_url: str = Field(default='https://openrouter.ai/api/v1', alias='OPENROUTER_BASE_URL')
    openrouter_site_url: str = Field(default='http://localhost:5173', alias='OPENROUTER_SITE_URL')
    llm_provider: str = Field(default='openrouter', alias='LLM_PROVIDER')
    llm_timeout_seconds: float = Field(default=30.0, alias='LLM_TIMEOUT_SECONDS')
    llm_total_budget_seconds: float = Field(default=90.0, alias='LLM_TOTAL_BUDGET_SECONDS')
    llm_max_input_chars: int = Field(default=20000, alias='LLM_MAX_INPUT_CHARS')
    mock_llm: bool = Field(default=False, alias='MOCK_LLM')

    session_cookie_name: str = Field(default='hirematch_session', alias='SESSION_COOKIE_NAME')
    session_cookie_secure: bool = Field(default=False, alias='SESSION_COOKIE_SECURE')
    session_ttl_days: int = Field(default=7, alias='SESSION_TTL_DAYS')

    max_upload_size_mb: int = Field(default=10, alias='MAX_UPLOAD_SIZE_MB')
    max_files_per_request: int = Field(default=10, alias='MAX_FILES_PER_REQUEST')
    max_pages_per_document: int = Field(default=30, alias='MAX_PAGES_PER_DOCUMENT')
    max_job_description_chars: int = Field(default=20000, alias='MAX_JOB_DESCRIPTION_CHARS')
    max_resume_text_chars: int = Field(default=40000, alias='MAX_RESUME_TEXT_CHARS')
    max_resumes_per_user: int = Field(default=100, alias='MAX_RESUMES_PER_USER')
    max_jobs_per_user: int = Field(default=500, alias='MAX_JOBS_PER_USER')

    rate_limit_per_minute: int = Field(default=20, alias='RATE_LIMIT_PER_MINUTE')
    login_attempts_per_15_minutes: int = Field(default=10, alias='LOGIN_ATTEMPTS_PER_15_MINUTES')
    processing_stale_minutes: int = Field(default=10, alias='PROCESSING_STALE_MINUTES')

    @property
    def allowed_origins_list(self) -> list[str]:
        return [item.strip().rstrip('/') for item in self.allowed_origins.split(',') if item.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {'production', 'prod'}

    @property
    def docs_enabled(self) -> bool:
        return self.expose_api_docs if self.expose_api_docs is not None else not self.is_production

    @property
    def llm_mode(self) -> str:
        if self.mock_llm:
            return 'mock'
        if self.llm_provider.lower() != 'openrouter':
            return 'unsupported_provider'
        if self.openrouter_api_key and self.openrouter_model:
            return 'configured'
        return 'missing_credentials'


settings = Settings()
