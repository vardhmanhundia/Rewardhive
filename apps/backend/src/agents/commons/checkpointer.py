"""Checkpointer lifecycle for persistent chat state.

Compiling the user-profiling graph with a LangGraph checkpointer lets us persist
each conversation (keyed by ``thread_id = user_id``), so chats survive
logout/login. The saver is chosen from ``DATABASE_URL``'s dialect:

- **Postgres** (prod / docker-compose): ``AsyncPostgresSaver`` over a psycopg
  connection pool, opened once at startup and closed at shutdown.
- **SQLite** (local dev, e.g. ``sqlite:///./test.db``): ``AsyncSqliteSaver`` over
  an ``aiosqlite`` connection. Without this branch the Postgres saver can't open
  a SQLite DSN, so persistence silently stayed disabled in local dev.

Persistence is optional: if the saver can't be opened (e.g. no database in a
test run, or the SQLite extra isn't installed), the app still starts and chats
fall back to non-persistent behavior.

Note: the checkpointer manages its own tables via ``setup()`` — this is the one
part of the schema Alembic does not own, a deliberate trade-off of the LangGraph
checkpointer approach.
"""

import logging
from typing import Any

from langgraph.checkpoint.base import BaseCheckpointSaver
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from sqlalchemy.engine import make_url

from src.config import settings

logger = logging.getLogger(__name__)

_pool: AsyncConnectionPool | None = None
_sqlite_conn: Any = None  # aiosqlite.Connection, kept open for the saver's lifetime
_checkpointer: BaseCheckpointSaver | None = None


def psycopg_uri(database_url: str) -> str:
    """Convert the app's async SQLAlchemy URL to a psycopg (libpq) URI."""
    return database_url.replace("+asyncpg", "").replace("+psycopg", "")


async def _init_postgres() -> BaseCheckpointSaver:
    """Open the psycopg pool and return a Postgres-backed saver."""
    global _pool
    _pool = AsyncConnectionPool(
        conninfo=psycopg_uri(settings.DATABASE_URL),
        max_size=10,
        open=False,
        kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row},
    )
    await _pool.open(wait=True, timeout=10)
    # Imported lazily so a SQLite-only setup never needs the Postgres extra.
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

    # row_factory=dict_row is set via kwargs above; mypy can't infer it from the
    # pool's generic type, so the dict-row requirement is satisfied here.
    checkpointer = AsyncPostgresSaver(_pool)  # type: ignore[arg-type]
    await checkpointer.setup()  # creates checkpointer tables if absent
    logger.info("LangGraph Postgres checkpointer ready")
    return checkpointer


async def _init_sqlite(database: str | None) -> BaseCheckpointSaver:
    """Open an aiosqlite connection and return a SQLite-backed saver.

    ``database`` is the file path from the URL (``None``/empty means in-memory).
    """
    global _sqlite_conn
    # Imported lazily so a Postgres-only deployment never needs the SQLite extra.
    import aiosqlite
    from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

    path = database or ":memory:"
    _sqlite_conn = await aiosqlite.connect(path)
    checkpointer = AsyncSqliteSaver(_sqlite_conn)
    await checkpointer.setup()  # creates checkpointer tables if absent
    logger.info("LangGraph SQLite checkpointer ready (%s)", path)
    return checkpointer


async def init_checkpointer() -> BaseCheckpointSaver | None:
    """Open the checkpointer for the configured database. Returns None on failure.

    Picks a Postgres or SQLite saver from ``DATABASE_URL``. Best-effort: a failure
    disables persistence rather than crashing the app.
    """
    global _checkpointer
    if _checkpointer is not None:
        return _checkpointer
    try:
        url = make_url(settings.DATABASE_URL)
        if url.get_backend_name() == "sqlite":
            _checkpointer = await _init_sqlite(url.database)
        else:
            _checkpointer = await _init_postgres()
    except Exception as exc:  # noqa: BLE001 — persistence is best-effort
        logger.warning("Chat persistence disabled (checkpointer init failed): %s", exc)
        await close_checkpointer()
        _checkpointer = None
    return _checkpointer


async def close_checkpointer() -> None:
    """Close the pool / connection and clear the checkpointer."""
    global _pool, _sqlite_conn, _checkpointer
    if _pool is not None:
        await _pool.close()
        _pool = None
    if _sqlite_conn is not None:
        await _sqlite_conn.close()
        _sqlite_conn = None
    _checkpointer = None


def get_checkpointer() -> BaseCheckpointSaver | None:
    """Return the live checkpointer, or None if persistence is disabled."""
    return _checkpointer
