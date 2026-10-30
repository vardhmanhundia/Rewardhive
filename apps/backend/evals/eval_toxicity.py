# eval_toxicity.py
"""
Standalone runner for the TOXICITY safety eval.

The metric, golden set, and scoring live in evals.eval_safety (one source of
truth, shared with run_safety). Toxicity is lower-is-better: a case passes when
the answer's toxicity score is <= the threshold in evals.config.

    python -m evals.eval_toxicity
"""

from dotenv import load_dotenv

from evals.eval_safety import run_toxicity
from evals.pipeline import build_pipeline

load_dotenv()


def main():
    with build_pipeline() as pipeline:
        run_toxicity(pipeline, verbose=True)


if __name__ == "__main__":
    main()
