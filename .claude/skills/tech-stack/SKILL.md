---
name: tech-stack
description: Project tech stack rules for any new feature. Use when planning, scaffolding, or implementing a feature, adding a dependency, creating an API endpoint, adding a database table, or starting mobile work in card-manager-assistant.
---

# Project tech stack

Follow these choices for all new work. If a task needs something outside this list, say so and ask before adding it.

## Layout

- `apps/web`: React + TypeScript + Vite frontend
- `apps/backend`: FastAPI backend (Python)
- `shared/`: TypeScript code used by web and, later, mobile (`schemas.ts`, `constants/`)
- `docker-compose.yml`: local stack (backend, web, Postgres, Redis)
- Future: `apps/mobile` (Expo / React Native), only when mobile work starts

## Frontend (apps/web)

- React 18+ with TypeScript (stable 5.x, never a preview build), built with Vite.
- Server state: TanStack Query — wrap the app in `QueryClientProvider`, do requests with `useQuery`/`useMutation`. Client state: Zustand, only when needed (plain Context is fine for small state like auth).
- Styling: Tailwind CSS.
- Forms: controlled inputs with `useState` and a plain `validateForm` function per form (no form or schema-validation library — no React Hook Form, no Zod).
- Routing: React Router v6.
- Keep the web app installable as a PWA (manifest + service worker) when it's ready for phone testing.
- No business logic in components. Put API calls in a client module and matching or formatting logic in `shared/` or pure helper functions.

## Backend (apps/backend)

- FastAPI with Pydantic models for request and response schemas. Routes and services are `async def`.
- SQLAlchemy **async** (`create_async_engine` + `async_sessionmaker`) with the **asyncpg** driver — `DATABASE_URL` uses the `postgresql+asyncpg://` scheme. Query with `await session.execute(select(...))`, not the legacy `session.query(...)`.
- Alembic owns the schema. It runs `alembic upgrade head` on container startup; never create tables with `Base.metadata.create_all()`. Database image: `pgvector/pgvector:pg15` (the vector extension is enabled in a migration).
- Services live in `src/services/` (CardService, UserService, RecommendationService, RAGService, MatchingService). Routes in `src/api/routes/` stay thin.
- LLM: Anthropic Claude API for reasoning and explanations. Orchestrate multi-step flows with LangGraph in `src/agents/`.
- Config from environment variables, centralized in `src/config.py` (`settings` object); every module reads config from there. Never hardcode keys or connection strings, and never read `os.getenv` outside `config.py`.
- Hash passwords with the `bcrypt` library directly (not passlib), capping the input at 72 bytes.
- Add tests under `tests/` for each new endpoint and service.

## API contract

- Every endpoint must be defined with Pydantic models so it appears in FastAPI's OpenAPI schema.
- Generate TypeScript types from the OpenAPI schema into `shared/api.d.ts` with `npm run gen:api` (openapi-typescript), run after changing any endpoint. Don't hand-write duplicate API types in the frontend.

## Data and infrastructure

- Schema changes require an Alembic migration, not manual edits to the database.
- Use Redis (already in docker-compose) only for caching or background-job needs. Don't add a separate queue system without asking.
- Vector search uses pgvector first. Don't add Pinecone or another vector store without asking.

## Mobile (future)

- Use Expo (React Native) with TypeScript when mobile work starts.
- The mobile app must call the same FastAPI endpoints and import types and schemas from `shared/`.
- Don't add Flutter or a second backend.

## Adding a dependency

- Pin **exact** versions everywhere — no `^`, `~`, or `>=` ranges. Open ranges have pulled breaking majors into builds (SQLAlchemy 2.1, bcrypt 5.0, a TypeScript 7 preview).
- Backend: pin in `pyproject.toml`. Frontend: pin in `package.json`.
- Prefer the latest stable release; avoid preview/beta versions.
- Frontend: prefer libraries already in this list. Check that the package is maintained before adding it.
- State the reason for any new dependency in the summary so the user can review it.
