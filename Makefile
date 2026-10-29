# Run backend tasks from the repo root — no need to cd into apps/backend.
# uv's --directory flag points uv at the backend project while you stay here.
#
# Examples:
#     make install      # install/sync all deps (incl. dev tools)
#     make dev          # run the FastAPI dev server
#     make test         # run pytest
#     make check        # format + lint + typecheck + test

BACKEND := apps/backend
UV := uv run --directory $(BACKEND)

.DEFAULT_GOAL := help

.PHONY: help install dev web test lint format typecheck check \
	infra infra-down migrate seed setup

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  make %-10s %s\n", $$1, $$2}'

install:  ## Install/sync backend deps (runtime + dev) into apps/backend/.venv
	uv sync --directory $(BACKEND) --extra dev

# --- Hybrid dev: Postgres + Redis in Docker, backend + web on the host --------

infra:  ## Start only Postgres + Redis in Docker (detached)
	docker compose up -d db redis

infra-down:  ## Stop the Docker Postgres + Redis (keeps their data volumes)
	docker compose stop db redis

migrate:  ## Apply Alembic migrations to the running database
	$(UV) alembic upgrade head

seed:  ## Seed the card catalog + embeddings
	$(UV) python -m src.db.seed_cards

setup: infra migrate seed  ## Bring up infra, then migrate + seed (first-run)

dev:  ## Run the FastAPI dev server on the host with auto-reload
	$(UV) uvicorn src.api.main:app --reload

web:  ## Run the Vite frontend dev server on the host
	npm --prefix apps/web run dev

test:  ## Run the test suite
	$(UV) pytest

lint:  ## Lint with ruff (auto-fix)
	$(UV) ruff check --fix src

format:  ## Format with black
	$(UV) black src

typecheck:  ## Type-check with mypy
	$(UV) mypy src

check: format lint typecheck test  ## Run the full pre-commit check
