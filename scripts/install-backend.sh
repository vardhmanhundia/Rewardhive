#!/usr/bin/env bash
# Install all backend Python dependencies into a single uv-managed .venv.
# Uses the pinned versions in apps/backend/pyproject.toml and uv.lock, so
# everyone gets an identical environment. Safe to re-run.
#
# Usage, from anywhere in the repo:
#     ./scripts/install-backend.sh
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root/apps/backend"

if ! command -v uv >/dev/null 2>&1; then
  echo "install-backend: 'uv' not found. Install it first:" >&2
  echo "    curl -LsSf https://astral.sh/uv/install.sh | sh" >&2
  exit 1
fi

echo "install-backend: using $(uv --version)"
echo "install-backend: syncing dependencies (incl. dev tools) into .venv"

# --extra dev pulls in pytest, black, ruff, mypy, etc.
uv sync --extra dev

echo "install-backend: done."
echo "Run commands with 'uv run', e.g.:"
echo "    cd apps/backend"
echo "    uv run uvicorn src.api.main:app --reload"
echo "    uv run pytest"
