# eval_retriever.py
"""
Component-level evaluation of the RETRIEVER, in isolation.

Runs the real pgvector retrieval (src.services.RetrievalService, via the eval
pipeline) over each golden query and scores the retrieved context with two
DeepEval metrics:

  ContextualRecall    -- did we retrieve the cards needed to answer? (misses)
  ContextualPrecision -- are the relevant cards ranked above the noise?

    python -m evals.eval_retriever
"""

from dotenv import load_dotenv

from deepeval import evaluate
from deepeval.test_case import LLMTestCase
from deepeval.metrics import ContextualRecallMetric, ContextualPrecisionMetric

from evals import config
from evals.pipeline import build_pipeline
from evals.harness import load_goldens, summarize_by_metric, print_summary

load_dotenv()

GOLDEN_PATH = "goldens/retriever_goldens.json"


def run(retriever):
    # 1. LOAD the golden set --- the fixed, human-authored truth
    goldens = load_goldens(GOLDEN_PATH)

    # 2. RUN THE INJECTED RETRIEVER on each question to fill retrieval_context,
    #    then build one test case per golden.
    test_cases = []
    for g in goldens:
        retrieved = retriever.invoke(g["query"])
        retrieval_context = [doc.page_content for doc in retrieved]

        test_cases.append(
            LLMTestCase(
                input=g["query"],
                expected_output=g["ideal_answer"],
                retrieval_context=retrieval_context,
                actual_output="(generator not evaluated in this run)",
            )
        )

    # 3. THE METRICS --- recall (did we miss?) and precision (ranked well?)
    metrics = [
        ContextualRecallMetric(
            threshold=config.RETRIEVER_THRESHOLD, model=config.get_judge(), include_reason=True
        ),
        ContextualPrecisionMetric(
            threshold=config.RETRIEVER_THRESHOLD, model=config.get_judge(), include_reason=True
        ),
    ]

    # 4. EVALUATE --- every metric on every case, batched + parallel, printed report.
    #    hyperparameters travel with the run so the report is tagged with the config.
    result = evaluate(
        test_cases=test_cases,
        metrics=metrics,
        hyperparameters={
            "retriever": "pgvector_ann",
            "embedding_model": "bge-large-en-v1.5",
            "top_k": "settings.RECOMMENDATION_TOP_K",
            "fetch_k": "settings.RECOMMENDATION_FETCH_K",
            "judge_model": config.judge_label(),
            "golden_set": GOLDEN_PATH,
        },
    )
    return summarize_by_metric(result)


def run_local():
    """Standalone convenience: build the pipeline, then run against its retriever."""
    with build_pipeline() as pipeline:
        return run(pipeline.retriever)


if __name__ == "__main__":
    print_summary("retriever", run_local())
