FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY apps/backend/pyproject.toml pyproject.toml
COPY apps/backend/src/ src/
COPY apps/backend/tests/ tests/
COPY apps/backend/alembic.ini alembic.ini
COPY apps/backend/alembic/ alembic/
COPY shared/ shared/

# Install Python dependencies
RUN pip install --no-cache-dir -e .

# Expose port
EXPOSE 8000

# Apply migrations, seed the card catalog + embeddings, then run the app.
CMD ["sh", "-c", "alembic upgrade head && python -m src.db.seed_cards && uvicorn src.api.main:app --host 0.0.0.0 --port 8000"]
