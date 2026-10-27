"""Pytest configuration and fixtures"""
import asyncio
import os

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from fastapi.testclient import TestClient

from src.db.database import Base, get_db
from src.api.main import app

# The app uses async SQLAlchemy sessions, so tests must too. A file-based
# SQLite DB (not :memory:) is used so the schema created in the fixture's
# event loop is visible to the separate loop the TestClient runs requests on.
# NullPool prevents reusing a connection across event loops, which aiosqlite
# forbids.
TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test_ci.db")
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_PATH}"


@pytest.fixture
def test_db():
    """Create a fresh async test database and override the get_db dependency."""
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    TestSessionLocal = async_sessionmaker(
        bind=engine, expire_on_commit=False, autoflush=False
    )

    async def _create_schema():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def _drop_schema():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()

    asyncio.run(_create_schema())

    async def override_get_db():
        async with TestSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    yield TestSessionLocal

    app.dependency_overrides.pop(get_db, None)
    asyncio.run(_drop_schema())
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)


@pytest.fixture
def client(test_db):
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def test_user_data():
    """Test user data"""
    return {
        "email": "test@example.com",
        "first_name": "Test",
        "last_name": "User",
        "password": "securepassword123",
    }
