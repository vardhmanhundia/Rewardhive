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

    # Embeddings. One EmbeddingService is the shared seam for both ingestion
    # (seed) and retrieval (query time); both sides must use the same provider
    # and model so vectors are comparable. EMBEDDING_DIM must match the
    # Vector(...) size in the card_chunks model and migration.
    #
    # Default provider is sentence-transformers: native wheels on arm64 /
    # Python 3.13, no emulation. SONAR (Meta's model) is selectable via
    # EMBEDDING_PROVIDER=sonar but needs the [sonar] extra on an x86_64,
    # Python<=3.12 host (fairseq2n ships no cp313 or linux-arm64 wheel).
    EMBEDDING_PROVIDER: str = os.getenv("EMBEDDING_PROVIDER", "sentence_transformers")
    EMBEDDING_DIM: int = int(os.getenv("EMBEDDING_DIM", "1024"))
    # sentence-transformers model; must emit EMBEDDING_DIM-sized vectors.
    # bge-large-en-v1.5 is 1024-dim, matching the default EMBEDDING_DIM.
    ST_MODEL: str = os.getenv("ST_MODEL", "BAAI/bge-large-en-v1.5")
    # SONAR settings (used only when EMBEDDING_PROVIDER=sonar).
    SONAR_ENCODER: str = os.getenv("SONAR_ENCODER", "text_sonar_basic_encoder")
    SONAR_SOURCE_LANG: str = os.getenv("SONAR_SOURCE_LANG", "eng_Latn")
    # Card catalog seed file, relative to the backend working directory.
    SEED_PATH: str = os.getenv("SEED_PATH", "seed/cards.json")


settings = Settings()
