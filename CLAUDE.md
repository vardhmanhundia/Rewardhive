# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RewardHive** — A credit-card recommendation and wallet-optimization platform. The backend uses FastAPI with LangGraph for AI agent workflows, and the frontend is React + TypeScript.

```
card-manager-assistant/
├── apps/backend/          # Python FastAPI + LangGraph
│   ├── src/
│   │   ├── api/main.py    # FastAPI app and routes
│   │   ├── agents/        # LangGraph workflows (StateGraph-based)
│   │   ├── services/      # Business logic (card_service, etc.)
│   │   ├── models/        # Pydantic models and SQLAlchemy ORM
│   │   └── db/            # Database setup and migrations
│   ├── tests/             # pytest tests
│   └── pyproject.toml     # Dependencies, build config, tool settings
├── apps/web/              # React + TypeScript frontend
└── shared/                # Shared types and constants
```

## Key Technologies

- **LLM**: Meta Muse (Muse Spark) via the Meta Model API, reached through its
  OpenAI-compatible protocol (`langchain-openai`'s `ChatOpenAI` pointed at
  `MUSE_BASE_URL` — see `src/agents/commons/llm.py`)
- **Backend**: FastAPI (async), LangGraph (agent workflows), SQLAlchemy (async ORM), PostgreSQL + pgvector, Redis
- **Embeddings/RAG**: sentence-transformers (BGE-large-en-v1.5, 1024-dim) by default; pgvector cosine search
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Package management**: uv (backend), npm (frontend); common tasks wrapped in the root `Makefile`
- **Python version**: >=3.13
- **Code quality**: black (formatter), ruff (linter), mypy (type checker)
- **Testing**: pytest + pytest-asyncio (backend), vitest (frontend)

## Backend Development

### Setup

Common tasks are wrapped in the root `Makefile` (run from the repo root; it uses
`uv run --directory apps/backend` under the hood). `make help` lists everything.

```bash
# Install backend deps (runtime + dev) into apps/backend/.venv
make install
# OR directly: uv sync --directory apps/backend --extra dev

# Frontend deps
npm --prefix apps/web install
```

### Running the Dev Server

```bash
make setup   # first run only: start Docker Postgres + Redis, migrate, seed cards
make dev     # FastAPI dev server with auto-reload (http://localhost:8000)
make web     # Vite frontend dev server (http://localhost:3000)
```

`make setup` depends on Docker (it brings up Postgres + Redis, applies Alembic
migrations, then seeds the card catalog with embeddings).

### Common Commands

```bash
make test        # pytest (backend)
make lint        # ruff --fix
make format      # black
make typecheck   # mypy
make check       # format + lint + typecheck + test (run before commits)

npm --prefix apps/web test   # frontend tests (vitest)
```

To scope backend commands, append args via uv, e.g.
`uv run --directory apps/backend pytest -k test_name`.

### Environment Setup

Copy `.env.example` to `.env` and fill in `MODEL_API_KEY`, `MUSE_BASE_URL`, and
`SECRET_KEY`. Database defaults:

```bash
# PostgreSQL + pgvector (default) — required for the RAG recommender, whose
# vector search (cosine_distance) only works on Postgres. `make setup` starts it.
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/card_db
```

The URL **must** use an async driver scheme (`+asyncpg`). SQLite
(`sqlite+aiosqlite://…`) is for the test suite only — under it the embedding
column degrades to `Text`, so the recommender returns nothing. Don't use it for
local dev.

For the full stack (backend, frontend, Postgres, Redis) in containers:
```bash
docker-compose up --build
```

## Architecture

### Backend Structure

**API Layer** (`src/api/main.py`):
- FastAPI app with CORS middleware
- Async endpoint handlers
- Health check: `GET /health`
- Routers: auth, profile, profiling, cards, optimizer, recommendations, advisor, rewards, multimodal

**Agent Workflows** (`src/agents/graph.py`):
- LangGraph StateGraph-based workflows with conditional fan-out
- A **router** agent classifies each message and fans out to the specialists in
  `src/agents/`: recommendation (RAG), evaluate, advisor, rewards, compare;
  **user_profiling** runs in parallel as a subgraph (writes disjoint state keys)
- Compile graph with `.compile()` before execution

**Services** (`src/services/`):
- Business logic separated from endpoints
- `card_service.py` for card operations
- Database interactions via SQLAlchemy ORM

**Database** (`src/db/`):
- SQLAlchemy async ORM setup
- Models in `src/models/`
- Alembic migrations (when DB schema changes)

**Models** (`src/models/`):
- Pydantic models for request/response validation
- SQLAlchemy ORM models

### Key Design Notes

- **Async/await throughout**: All endpoints and DB queries are async. Use `async def` and `await` consistently.
- **Database access**: Always use SQLAlchemy async sessions; never block the event loop.
- **Agent workflows**: LangGraph graphs must be compiled before use. Nodes receive state dict and return updated state.
- **Type hints**: Use Pydantic for API contracts and SQLAlchemy for ORM models.
- **CORS enabled**: Currently allows all origins (`*`) for development; restrict in production.

## Frontend Development

```bash
cd apps/web

npm install                # Install dependencies
npm run dev                # Start Vite dev server (port 3000)
npm run build              # Build for production
npm run lint               # Lint code
npm test                   # Run tests
```

## Testing Strategy

- Backend: pytest with async test support (`pytest-asyncio`)
- Use `TestClient` from `fastapi.testclient` for endpoint testing
- Fixtures in `tests/conftest.py` (create if needed)
- Database: SQLite in-memory for fast test isolation
- Tests should be independent and not depend on execution order

## Docker Compose Services

```bash
docker-compose up --build
```

Starts:
- Backend (FastAPI): http://localhost:8000
- Frontend (React): http://localhost:3000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## CI/CD & Deployment

- Dockerfile setup in place for containerized deployment
- GitHub Actions workflows can be added for automated testing/deployment
- Environment variables must be set in production environment

## Code Style

- **Line length**: 100 characters (black & ruff)
- **Formatter**: black
- **Linter**: ruff (check rules in `pyproject.toml`)
- **Type checker**: mypy
- Commit before running automated fixes to review changes

## Next Steps for Common Tasks

- **Add new API endpoint**: Create endpoint in `src/api/main.py`, add service logic in `src/services/`, add test in `tests/`
- **Create agent workflow**: Implement in `src/agents/graph.py` using LangGraph StateGraph
- **Add database model**: Define in `src/models/`, run Alembic migration: `alembic revision --autogenerate -m "description"`
- **Add React component**: Create in `apps/web/src/`, fetch from backend using `VITE_API_URL`
