# eval_scope_safety.py
"""
Standalone runner for the SCOPE safety eval.

The metric, golden set, and scoring live in evals.eval_safety (one source of
truth, shared with run_safety). This file is just the convenience entrypoint to
run scope on its own:

    python -m evals.eval_scope_safety
"""

from dotenv import load_dotenv

from evals.eval_safety import run_scope
from evals.pipeline import build_pipeline

load_dotenv()


def main():
    with build_pipeline() as pipeline:
        run_scope(pipeline, verbose=True)


if __name__ == "__main__":
    main()
