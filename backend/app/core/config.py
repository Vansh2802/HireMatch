from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = Field(default='HireMatch', alias='APP_NAME')
    api_prefix: str = Field(default='/api', alias='API_PREFIX')
    allowed_origins: str = Field(default='http://localhost:5173,http://localhost:3000', alias='ALLOWED_ORIGINS')
    database_url: str = Field(default='sqlite:///./hirematch.db', alias='DATABASE_URL')
    openrouter_api_key: str | None = Field(default=None, alias='OPENROUTER_API_KEY')
    openrouter_model: str = Field(default='openai/gpt-4o-mini', alias='OPENROUTER_MODEL')
    openrouter_base_url: str = Field(default='https://openrouter.ai/api/v1', alias='OPENROUTER_BASE_URL')
    openrouter_site_url: str = Field(default='http://localhost:5173', alias='OPENROUTER_SITE_URL')
    llm_provider: str = Field(default='openrouter', alias='LLM_PROVIDER')
    llm_timeout_seconds: float = Field(default=30.0, alias='LLM_TIMEOUT_SECONDS')
    max_upload_size_mb: int = Field(default=10, alias='MAX_UPLOAD_SIZE_MB')
    max_pages_per_document: int = Field(default=80, alias='MAX_PAGES_PER_DOCUMENT')
    upload_dir: str = Field(default='uploads', alias='UPLOAD_DIR')
    temp_dir: str = Field(default='temp', alias='TEMP_DIR')
    mock_llm: bool = Field(default=True, alias='MOCK_LLM')

    @property
    def allowed_origins_list(self) -> list[str]:
        return [item.strip() for item in self.allowed_origins.split(',') if item.strip()]


settings = Settings()
