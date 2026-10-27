"""Central application configuration, sourced from environment variables.

Nothing here is hardcoded for production: every value falls back to a
local-development default and is overridden by the matching env var.
"""
import os


class Settings:
    # Async SQLAlchemy URL (asyncpg driver).
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://user:password@localhost:5432/card_db",
    )
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

    # Auth. The default is a dev-only placeholder; set SECRET_KEY in every
    # real environment.
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-only-secret-change-me")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_DAYS: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_DAYS", "30"))

    ALLOWED_ORIGINS: list[str] = os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:3000"
    ).split(",")

    SQL_ECHO: bool = os.getenv("SQL_ECHO", "false").lower() == "true"


settings = Settings()
