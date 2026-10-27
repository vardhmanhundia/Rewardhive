"""Postgres checkpointer lifecycle for persistent chat state.

Compiling the user-profiling graph with an ``AsyncPostgresSaver`` lets us persist
each conversation (keyed by ``thread_id = user_id``) in Postgres, so chats
survive logout/login. The connection pool is opened once at app startup and
closed at shutdown.

Persistence is optional: if the pool can't be opened (e.g. no database in a
test run), the app still starts and chats fall back to non-persistent behavior.

Note: the checkpointer manages its own tables via ``setup()`` — this is the one
part of the schema Alembic does not own, a deliberate trade-off of the LangGraph
checkpointer approach.
"""

import logging

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from src.config import settings

logger = logging.getLogger(__name__)

_pool: AsyncConnectionPool | None = None
_checkpointer: AsyncPostgresSaver | None = None


def psycopg_uri(database_url: str) -> str:
    """Convert the app's async SQLAlchemy URL to a psycopg (libpq) URI."""
    return database_url.replace("+asyncpg", "").replace("+psycopg", "")


async def init_checkpointer() -> AsyncPostgresSaver | None:
    """Open the pool and create the checkpointer tables. Returns None on failure.

    Best-effort: a failure disables persistence rather than crashing the app.
    """
    global _pool, _checkpointer
    if _checkpointer is not None:
        return _checkpointer
    try:
        _pool = AsyncConnectionPool(
            conninfo=psycopg_uri(settings.DATABASE_URL),
            max_size=10,
            open=False,
            kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row},
        )
        await _pool.open(wait=True, timeout=10)
        # row_factory=dict_row is set via kwargs above; mypy can't infer it from
        # the pool's generic type, so the dict-row requirement is satisfied here.
        checkpointer = AsyncPostgresSaver(_pool)  # type: ignore[arg-type]
        await checkpointer.setup()  # creates checkpointer tables if absent
        _checkpointer = checkpointer
        logger.info("LangGraph Postgres checkpointer ready")
    except Exception as exc:  # noqa: BLE001 — persistence is best-effort
        logger.warning("Chat persistence disabled (checkpointer init failed): %s", exc)
        await close_checkpointer()
        _checkpointer = None
    return _checkpointer


async def close_checkpointer() -> None:
    """Close the pool and clear the checkpointer."""
    global _pool, _checkpointer
    if _pool is not None:
        await _pool.close()
        _pool = None
    _checkpointer = None


def get_checkpointer() -> AsyncPostgresSaver | None:
    """Return the live checkpointer, or None if persistence is disabled."""
    return _checkpointer
