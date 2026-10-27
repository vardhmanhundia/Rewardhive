FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY pyproject.toml pyproject.toml
COPY src/ src/
COPY tests/ tests/
COPY alembic.ini alembic.ini
COPY alembic/ alembic/

# Install Python dependencies
RUN pip install --no-cache-dir -e .

# Expose port
EXPOSE 8000

# Apply migrations, then run the application
CMD ["sh", "-c", "alembic upgrade head && uvicorn src.api.main:app --host 0.0.0.0 --port 8000"]
