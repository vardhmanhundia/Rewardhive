# eval_cost.py
"""
Standalone runner for the COST operational eval.

Cost is not measured, it is DERIVED: cost = tokens x price. The token
measurement, pricing constants, projection, and budget verdict live in
evals.eval_ops (one source of truth, shared with run_ops). This file is just the
convenience entrypoint to run cost on its own:

    python -m evals.eval_cost
"""

from dotenv import load_dotenv

from evals.eval_ops import run_cost
from evals.pipeline import build_pipeline

load_dotenv()


def main():
    with build_pipeline() as pipeline:
        run_cost(pipeline, verbose=True)


if __name__ == "__main__":
    main()
