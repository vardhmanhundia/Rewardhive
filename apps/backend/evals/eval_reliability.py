# eval_reliability.py
"""
Standalone runner for the RELIABILITY operational eval.

Reliability measures whether the app can serve requests without failing:
success / error / retry rates, with an exponential-backoff retry wrapper. The
tracker, retry wrapper, and report live in evals.eval_ops (one source of truth,
shared with run_ops). This file is just the convenience entrypoint to run
reliability on its own:

    python -m evals.eval_reliability
"""

from dotenv import load_dotenv

from evals.eval_ops import run_reliability
from evals.pipeline import build_pipeline

load_dotenv()


def main():
    with build_pipeline() as pipeline:
        run_reliability(pipeline, verbose=True)


if __name__ == "__main__":
    main()
