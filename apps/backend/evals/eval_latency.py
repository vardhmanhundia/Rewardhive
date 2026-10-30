# eval_latency.py
"""
Standalone runner for the LATENCY operational eval (with time-to-first-token).

The benchmark loop, percentiles, stage decomposition, and SLO verdicts live in
evals.eval_ops (one source of truth, shared with run_ops). Latency needs no
golden dataset and no judge -- it is a deterministic measurement against an SLO.
This file is just the convenience entrypoint to run latency on its own:

    python -m evals.eval_latency
"""

from dotenv import load_dotenv

from evals.eval_ops import run_latency
from evals.pipeline import build_pipeline

load_dotenv()


def main():
    with build_pipeline() as pipeline:
        run_latency(pipeline, verbose=True)


if __name__ == "__main__":
    main()
