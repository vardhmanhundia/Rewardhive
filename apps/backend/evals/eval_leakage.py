# eval_leakage.py
"""
Standalone runner for the LEAKAGE safety eval (protected info + PII).

The metrics, golden set, subtype split, and scoring live in evals.eval_safety
(one source of truth, shared with run_safety). This file is just the convenience
entrypoint to run leakage on its own:

    python -m evals.eval_leakage
"""

from dotenv import load_dotenv

from evals.eval_safety import run_leakage
from evals.pipeline import build_pipeline

load_dotenv()


def main():
    with build_pipeline() as pipeline:
        run_leakage(pipeline, verbose=True)


if __name__ == "__main__":
    main()
