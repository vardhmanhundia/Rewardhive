"""
evals/eval_generator.py
=======================
Component-level evaluation of the GENERATOR, in isolation.

Faithfulness: of the claims in the generated answer, how many are supported
by the context it was given? (Did the generator make things up?)

ISOLATION: we feed the generator the GOLDEN context (the known-good card facts
from the faithfulness dataset), NOT the retriever's output. So a low score is
purely the generator's fault --- the context was already correct.

    python -m evals.eval_generator
"""

from dotenv import load_dotenv

from deepeval import evaluate
from deepeval.test_case import LLMTestCase
from deepeval.metrics import FaithfulnessMetric, AnswerRelevancyMetric

from evals import config
from evals.pipeline import build_pipeline
from evals.harness import load_goldens, summarize_by_metric, print_summary

load_dotenv()

GOLDEN_PATH = "goldens/faithfulness_dataset.json"


def run(pipeline=None):
    # 1. LOAD the faithfulness golden set (query + ideal_context)
    goldens = load_goldens(GOLDEN_PATH)

    # 2. RUN THE GENERATOR on the GOLDEN context (isolation), build one test case each.
    #    The pipeline is injected so the whole suite shares one; built here if standalone.
    owns_pipeline = pipeline is None
    pipeline = pipeline or build_pipeline()
    try:
        test_cases = []
        for g in goldens:
            context = g["ideal_context"]                 # known-good context (list of strings)
            answer = pipeline.generate(g["query"], context)  # RUN the generator -> actual_output

            test_cases.append(
                LLMTestCase(
                    input=g["query"],
                    actual_output=answer,             # the generated answer we're judging
                    retrieval_context=context,        # faithfulness checks the answer against THIS
                    # no expected_output --- faithfulness never reads it
                )
            )
    finally:
        if owns_pipeline:
            pipeline.close()

    # 3. THE METRICS --- decompose actual_output into claims, attribute each to context
    metrics = [
        FaithfulnessMetric(
            threshold=config.GENERATOR_THRESHOLD,
            model=config.get_judge(),
            include_reason=True,   # prints WHY each score --- shows which claims were unsupported
        ),
        AnswerRelevancyMetric(
            threshold=config.GENERATOR_THRESHOLD,
            model=config.get_judge(),
            include_reason=True,
        ),
    ]

    # 4. EVALUATE --- runs the metrics on every case, prints a report
    result = evaluate(test_cases=test_cases, metrics=metrics)
    return summarize_by_metric(result)


if __name__ == "__main__":
    print_summary("generator", run())
