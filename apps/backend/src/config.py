"""Central application configuration, sourced from environment variables.

Nothing here is hardcoded for production: every value falls back to a
local-development default and is overridden by the matching env var.

On import we load ``apps/backend/.env`` (if present) so local runs pick up
configuration without exporting every variable by hand. Variables already set
in the environment (e.g. by Docker Compose or CI) take precedence.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# .env lives at the backend root: this file is apps/backend/src/config.py.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


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

    ALLOWED_ORIGINS: list[str] = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

    SQL_ECHO: bool = os.getenv("SQL_ECHO", "false").lower() == "true"

    # LLM (Meta Muse via the OpenAI-compatible Meta Model API). The chat node
    # answers the user; the extractor node decides what is memory-worthy.
    # MODEL_API_KEY and MUSE_BASE_URL come from the Meta Model API dashboard.
    # Note: Muse Spark always reasons, so never send reasoning_effort="none".
    MODEL_API_KEY: str = os.getenv("MODEL_API_KEY", "")
    MUSE_BASE_URL: str = os.getenv("MUSE_BASE_URL", "")
    PROFILING_CHAT_MODEL: str = os.getenv("PROFILING_CHAT_MODEL", "muse-spark-1.1")
    PROFILING_EXTRACTOR_MODEL: str = os.getenv("PROFILING_EXTRACTOR_MODEL", "muse-spark-1.1")

    # When true, LLM calls replay canned responses instead of hitting the API.
    # Useful for offline/deterministic runs; see src.agents.commons.llm.
    LLM_FAKE_MODE: bool = os.getenv("LLM_FAKE_MODE", "false").lower() == "true"

    # LangSmith tracing. When LANGSMITH_TRACING is true, LangChain/LangGraph
    # runs are logged to the LangSmith project. See src.agents.commons.tracing.
    LANGSMITH_TRACING: bool = os.getenv("LANGSMITH_TRACING", "false").lower() == "true"
    LANGSMITH_API_KEY: str = os.getenv("LANGSMITH_API_KEY", "")
    LANGSMITH_PROJECT: str = os.getenv("LANGSMITH_PROJECT", "card-agent")
    LANGSMITH_ENDPOINT: str = os.getenv("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")

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

    # Recommendation (RAG over the card catalog). Muse generates the answer,
    # grounded in cards retrieved from card_chunks via the embedding seam.
    # TOP_K = distinct cards handed to the model; FETCH_K = chunks scanned by the
    # vector search before de-duping to cards (FETCH_K >= TOP_K).
    RECOMMENDATION_MODEL: str = os.getenv("RECOMMENDATION_MODEL", "muse-spark-1.1")
    RECOMMENDATION_TOP_K: int = int(os.getenv("RECOMMENDATION_TOP_K", "5"))
    RECOMMENDATION_FETCH_K: int = int(os.getenv("RECOMMENDATION_FETCH_K", "40"))


settings = Settings()
