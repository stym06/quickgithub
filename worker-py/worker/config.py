from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379"
    ANTHROPIC_API_KEY: str | None = None
    WORKER_CONCURRENCY: int = 3
    WORKER_API_PORT: int = 8080
    RESEND_API_KEY: str | None = None
    NOTIFICATION_FROM_EMAIL: str = "QuickGitHub <noreply@quickgithub.com>"
    APP_BASE_URL: str = "https://quickgithub.com"
    CLONE_BASE_DIR: str = "/tmp/quickgithub-repos"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4318"

    AGENT_SDK: Literal["claude", "openai"] = "claude"
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    model_config = {"env_file": ".env"}


settings = Settings()
