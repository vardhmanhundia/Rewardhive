#!/usr/bin/env bash
# One-time developer setup for the git pre-commit hook (runs ruff before commits,
# matching CI). Safe to re-run — it only does work that's missing.
#
# Usage, from anywhere in the repo:
#     ./scripts/setup-hooks.sh
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

RUFF_VERSION="0.8.4"   # keep in sync with apps/backend/pyproject.toml [dev]

# 1. Isolated tooling venv with ruff (standalone binary; venv Python version is irrelevant).
if [ ! -x ".lint-venv/bin/ruff" ]; then
  echo "setup-hooks: creating .lint-venv and installing ruff==${RUFF_VERSION}"
  python3 -m venv .lint-venv
  ./.lint-venv/bin/pip install --quiet --upgrade pip "ruff==${RUFF_VERSION}"
else
  echo "setup-hooks: .lint-venv/bin/ruff already present ($(./.lint-venv/bin/ruff --version))"
fi

# 2. Point git at the tracked hooks directory.
git config core.hooksPath .githooks
echo "setup-hooks: core.hooksPath -> $(git config core.hooksPath)"

echo "setup-hooks: done. Ruff will now run on every commit."
