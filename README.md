# 📇 Card Agent App

A full-stack application for managing cards using FastAPI, LangGraph, React, and AI agents.

## Project Structure

```
card-agent-app/
├── apps/
│   ├── backend/       # FastAPI + LangGraph
│   └── web/           # React + TypeScript
├── shared/            # Shared types and constants
├── docker-compose.yml # Local development setup
└── README.md
```

## Prerequisites

- Docker & Docker Compose (for containerized setup)
- Python 3.13+ (for local backend development)
- Node.js 20+ (for local frontend development)

## Quick Start with Docker Compose

```bash
# Start all services
docker-compose up --build

# Services will be available at:
# - Frontend: http://localhost:3000
# - Backend: http://localhost:8000
# - Database: localhost:5432
# - Redis: localhost:6379
```

## Local Development

### Backend Setup

```bash
cd apps/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Run development server
uvicorn src.api.main:app --reload
```

### Frontend Setup

```bash
cd apps/web

# Install dependencies
npm install

# Start development server
npm run dev
```

## Testing

### Backend

```bash
cd apps/backend
pytest
```

### Frontend

```bash
cd apps/web
npm test
```

## Building for Production

```bash
# Build Docker images
docker-compose build

# Run with production settings
docker-compose -f docker-compose.yml up
```

## Architecture

- **Backend**: FastAPI with async/await, LangGraph for agent workflows, SQLAlchemy ORM, PostgreSQL + Redis
- **Frontend**: React 18 with TypeScript, Vite for build tooling, Fetch API for backend communication
- **Shared**: TypeScript types and API constants for type-safe communication
