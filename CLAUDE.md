# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Card Agent App** — A full-stack card management system with AI agents. The backend uses FastAPI with LangGraph for agentic workflows, and the frontend is React + TypeScript.

```
card-agent-assistant/
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

- **Backend**: FastAPI (async), LangGraph (agent workflows), SQLAlchemy (ORM with async), PostgreSQL + Redis
- **Frontend**: React 18, TypeScript, Vite
- **Package management**: uv (replaces pip/pip-tools)
- **Python version**: >=3.13
- **Code quality**: black (formatter), ruff (linter), mypy (type checker)
- **Testing**: pytest + pytest-asyncio for async test support

## Backend Development

### Setup

```bash
cd apps/backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies with dev tools
pip install -e ".[dev]"
# OR with uv (if installed):
uv sync
```

### Running the Dev Server

```bash
uvicorn src.api.main:app --reload
```

Server runs at `http://localhost:8000` with auto-reload on file changes.

### Common Commands

**Testing:**
```bash
pytest                    # Run all tests
pytest tests/test_api.py  # Run specific test file
pytest -v                 # Verbose output
pytest -k test_name       # Run tests matching name pattern
pytest --cov=src          # Generate coverage report
```

**Code Quality:**
```bash
black src                 # Format code
ruff check src            # Lint code
ruff check --fix src      # Auto-fix linting issues
mypy src                  # Type checking
```

**Full check (recommended before commits):**
```bash
black src && ruff check --fix src && mypy src && pytest
```

### Environment Setup

Copy `.env.example` to `.env` and update these for local development:

```bash
DATABASE_URL=sqlite+aiosqlite:///./test.db  # SQLite for local dev
REDIS_URL=redis://localhost:6379             # Redis connection
OPENAI_API_KEY=your-key                      # LLM provider
LANGCHAIN_API_KEY=your-key                   # For LangChain tracing
VITE_API_URL=http://localhost:8000           # Frontend API endpoint
```

For PostgreSQL + Redis (Docker Compose):
```bash
docker-compose up --build
```

## Architecture

### Backend Structure

**API Layer** (`src/api/main.py`):
- FastAPI app with CORS middleware
- Async endpoint handlers
- Health check: `GET /health`
- Cards CRUD routes: `/cards`, `/cards/{id}`

**Agent Workflows** (`src/agents/graph.py`):
- LangGraph StateGraph-based workflows
- Compile graph with `.compile()` before execution
- TODO: Add nodes and edges for card management

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
