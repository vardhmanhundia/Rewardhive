# eval_rag_pipeline.py
"""
Pipeline-level evaluation: the RAG triad on the LIVE retrieve -> generate path.

Unlike eval_generator (which feeds golden context), this runs the real pipeline
end to end per query, so the three triad metrics judge the whole system:

  ContextualRelevancy -- was the RETRIEVED context relevant to the query?
  Faithfulness        -- is the ANSWER grounded in that retrieved context?
  AnswerRelevancy     -- does the ANSWER actually address the query?

    python -m evals.eval_rag_pipeline
"""

from dotenv import load_dotenv

from deepeval import evaluate
from deepeval.test_case import LLMTestCase
from deepeval.metrics import (
    FaithfulnessMetric,
    AnswerRelevancyMetric,
    ContextualRelevancyMetric,
)

from evals import config
from evals.pipeline import build_pipeline
from evals.harness import load_goldens, summarize_by_metric, print_summary

load_dotenv()

GOLDEN_PATH = "goldens/faithfulness_dataset.json"   # reuse the queries


def run(rag=None):
    # 1. LOAD queries (we only need the queries --- context comes from the pipeline now)
    goldens = load_goldens(GOLDEN_PATH)

    # 2. RUN THE INJECTED PIPELINE per query, build a test case from LIVE output
    owns_pipeline = rag is None
    rag = rag or build_pipeline()
    try:
        test_cases = []
        for g in goldens:
            result = rag.invoke(g["query"])          # retrieve -> generate

            test_cases.append(
                LLMTestCase(
                    input=g["query"],
                    actual_output=result["answer"],       # what the generator produced
                    retrieval_context=result["context"],  # what the RETRIEVER returned
                )
            )
    finally:
        if owns_pipeline:
            rag.close()

    # 3. THE THREE TRIAD METRICS
    metrics = [
        ContextualRelevancyMetric(
            threshold=config.PIPELINE_THRESHOLD, model=config.get_judge(), include_reason=True
        ),
        FaithfulnessMetric(
            threshold=config.PIPELINE_THRESHOLD, model=config.get_judge(), include_reason=True
        ),
        AnswerRelevancyMetric(
            threshold=config.PIPELINE_THRESHOLD, model=config.get_judge(), include_reason=True
        ),
    ]

    # 4. EVALUATE
    result = evaluate(test_cases=test_cases, metrics=metrics)
    return summarize_by_metric(result)


if __name__ == "__main__":
    print_summary("rag_pipeline", run())
