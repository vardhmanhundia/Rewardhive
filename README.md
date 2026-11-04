# RewardHive

**RewardHive** is an AI-powered credit card assistant that helps users pick the right card for every purchase, optimize their wallet, and discover new cards tailored to their spending habits. It uses **Meta's Muse LLM** (via the Meta Model API) to power conversational AI agents built with **LangGraph**.

## What It Does

- **Which Card?** — Describe a purchase ("$200 at Costco") and RewardHive ranks your wallet's cards by rewards, explaining which to use and why.
- **Wallet Optimizer** — Evaluates your current card lineup and suggests whether a new card would improve your overall rewards.
- **Card Recommendations** — A RAG-powered recommender searches a catalog of 21 real credit cards and suggests the best match based on your spending profile.
- **Conversational Profiling** — As you chat, the AI builds a spending profile (categories, preferences, goals) so recommendations improve over time.
- **Credit Card News** — Curated feed of card-related news and offers.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM | Meta Muse Spark (via Meta Model API) |
| Agent Framework | LangGraph (StateGraph with conditional fan-out) |
| Backend | FastAPI (async), SQLAlchemy, PostgreSQL + pgvector |
| Embeddings | sentence-transformers (BGE-large-en-v1.5, 1024-dim) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Infra | Docker Compose (Postgres, Redis, backend, frontend) |

## How to Run

### Prerequisites

- **Python 3.13+** and [uv](https://docs.astral.sh/uv/) (recommended) or pip
- **Node.js 20.19+ (or 22+)** — required by Vite 8
- **Docker** (for PostgreSQL + Redis)
- **Meta Model API key** — get one from the Meta Model API dashboard

### 1. Clone and install

```bash
git clone https://github.com/vardhmanhundia/card-manager-assistant.git
cd card-manager-assistant

# Backend deps
make install
# OR manually:
# cd apps/backend && uv sync --extra dev

# Frontend deps
npm --prefix apps/web install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set these required values:

```bash
MODEL_API_KEY=<your-meta-model-api-key>
SECRET_KEY=<generate-with: python -c "import secrets; print(secrets.token_urlsafe(32))">
```

### 3. Start infrastructure, migrate, and seed

> **Make sure Docker is running first.** `make setup` starts PostgreSQL + Redis in Docker, so Docker Desktop (or your Docker daemon) must be open, or this step will fail.

```bash
make setup
```

This starts PostgreSQL + Redis in Docker, runs Alembic migrations, and seeds the card catalog with embeddings.

> **First run is slow.** Seeding downloads the sentence-transformers embedding model (`bge-large-en-v1.5`, ~1GB) the first time, so `make setup` can take a few minutes before it completes. This is a one-time download (cached for later runs).

### 4. Start the app

In two terminals:

```bash
# Terminal 1 — backend (http://localhost:8000)
make dev

# Terminal 2 — frontend (http://localhost:3000)
make web
```

Open **http://localhost:3000** in your browser.

### 5. Try it out

1. **Sign up** with an email and password
2. Go to **Recommend** — chat with the AI to get personalized card recommendations
3. Go to **Which Card** — describe a purchase to see which card in your wallet to use
4. Go to **Evaluate** — check if a new card would improve your wallet
5. Browse **News** for the latest card offers

### Alternative: Full Docker Compose

```bash
docker-compose up --build
```

Starts everything (backend, frontend, Postgres, Redis) — frontend at :3000, backend at :8000.

## Architecture

```
User <-> React Frontend <-> FastAPI Backend <-> LangGraph Agent Orchestrator
                                                      |
                                    ┌─────────────────┼─────────────────┐
                                    |                 |                 |
                              Recommender        Evaluator        Rewards
                              (RAG + Muse)      (Muse)          (Muse)
                                    |                 |                 |
                                    └────── + User Profiling (parallel) ┘
                                                      |
                                              PostgreSQL + pgvector
                                            (cards, embeddings, users)
```

The **router** agent classifies each message and fans out to the right specialist. **User profiling** runs in parallel when the message contains spending info, writing to disjoint state keys so branches join without conflict.

## Project Structure

```
card-manager-assistant/
├── apps/backend/            # FastAPI + LangGraph
│   ├── src/
│   │   ├── api/             # REST endpoints (auth, cards, optimizer, rewards, ...)
│   │   ├── agents/          # LangGraph workflows (router, recommendation, evaluate, rewards, profiling)
│   │   ├── services/        # Business logic
│   │   ├── db/              # SQLAlchemy models, migrations, seed script
│   │   └── config.py        # Settings (env vars)
│   ├── seed/cards.json      # 21 real credit card definitions
│   └── pyproject.toml
├── apps/web/                # React + TypeScript + Tailwind
│   └── src/pages/           # Cards, Recommend, Evaluate, WhichCard, News, Profile, ...
├── docker-compose.yml
└── Makefile                 # make setup / dev / web / test / check
```

## Running Tests

```bash
make test          # backend tests (pytest)
make check         # format + lint + typecheck + test
npm --prefix apps/web test   # frontend tests
```
