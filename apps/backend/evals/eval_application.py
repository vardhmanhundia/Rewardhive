# eval_application.py
"""
Application-level quality: how good is the finished recommendation to a user?

Runs the live pipeline per golden question and scores the answer on three
reference-aware GEval metrics:

  Correctness  -- are the stated card facts true (no contradictions)?
  Completeness -- does it cover the key points of the ideal answer?
  Style        -- does it read like a helpful, plain-spoken card advisor?

    python -m evals.eval_application
"""

from dotenv import load_dotenv

from deepeval import evaluate
from deepeval.test_case import LLMTestCase, LLMTestCaseParams
from deepeval.metrics import GEval
from deepeval.metrics.g_eval import Rubric

from evals import config
from evals.pipeline import build_pipeline
from evals.harness import load_goldens, summarize_by_metric, print_summary

load_dotenv()

GOLDEN_PATH = "goldens/correctness_goldens.json"


def run(rag=None):
    # 1. LOAD queries + ideal answers
    goldens = load_goldens(GOLDEN_PATH)

    # 2. RUN THE INJECTED PIPELINE per query, build a test case from LIVE output
    owns_pipeline = rag is None
    rag = rag or build_pipeline()
    try:
        test_cases = []
        for g in goldens:
            result = rag.invoke(g["question"])          # retrieve -> generate

            test_cases.append(
                LLMTestCase(
                    input=g["question"],
                    actual_output=result["answer"],
                    expected_output=g["ideal_answer"],
                )
            )
    finally:
        if owns_pipeline:
            rag.close()

    # 3. THREE APPLICATION-LEVEL QUALITY METRICS

    # 3a. CORRECTNESS --- reference-based, judges TRUTH (not coverage or length)
    correctness = GEval(
        name="Correctness",
        evaluation_steps=[
            "Compare only the factual claims in the actual output against the expected output.",
            "A claim is wrong only if it CONTRADICTS the expected output or is factually false (e.g. a wrong annual fee, rewards rate, or card name). Judge truth, not completeness.",
            "A factually accurate answer must score at least 0.9 even if it is shorter or covers fewer points than the expected output.",
            "Do NOT deduct for brevity, missing elaboration, or omitted points --- omissions are not errors here.",
            "Additional correct information must NEVER lower the score.",
        ],
        rubric=[
            Rubric(score_range=(9, 10), expected_outcome="All stated card facts are correct and consistent. No contradictions. Brevity is fine."),
            Rubric(score_range=(5, 8),  expected_outcome="Mostly correct but one minor inaccuracy."),
            Rubric(score_range=(0, 4),  expected_outcome="Contains a clear factual error (wrong fee, rate, or card) or a claim that contradicts the expected output."),
        ],
        evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT],
        threshold=config.APPLICATION_THRESHOLD,
        model=config.get_judge(),
        strict_mode=False,
    )

    # 3b. COMPLETENESS --- reference-based, judges COVERAGE (not correctness)
    completeness = GEval(
        name="Completeness",
        evaluation_steps=[
            "Identify the key points contained in the expected output.",
            "Check how many of those key points are addressed in the actual output.",
            "Penalize the actual output for each key point from the expected output that it omits or only partially covers.",
            "Judge coverage only. Do NOT lower the score because a covered point is stated incorrectly --- factual correctness is judged separately.",
            "Do NOT penalize the actual output for adding extra information beyond the expected output.",
        ],
        rubric=[
            Rubric(score_range=(9, 10), expected_outcome="Addresses essentially all key points in the expected output."),
            Rubric(score_range=(5, 8),  expected_outcome="Covers the main key points but misses one or more."),
            Rubric(score_range=(0, 4),  expected_outcome="Misses several key points; only partially covers the expected output."),
        ],
        evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT],
        threshold=config.APPLICATION_THRESHOLD,
        model=config.get_judge(),
        strict_mode=False,
    )

    # 3c. STYLE --- reference-free, judges TONE only (note: no EXPECTED_OUTPUT)
    style = GEval(
        name="Style",
        evaluation_steps=[
            "Judge only the tone and readability of the actual output, not whether it is factually correct or complete.",
            "Reward a helpful, plain-spoken advisor voice: leads with a clear best-fit pick, explains WHY it fits the user's request in everyday language, and ties the choice to concrete card facts (fees, rewards categories, credit level).",
            "Reward a direct, conversational register written in short prose paragraphs, as a knowledgeable friend recommending a card would say it, rather than a dry field-by-field data dump or a wall of bullet points.",
            "A brief comparison or one strong alternative is a BONUS when it helps the decision, but a clear, direct, single recommendation is fully acceptable and must NOT be penalized for being focused.",
            "Penalize answers that are stiff and bureaucratic, that dump every field of every card as raw bullets with no guidance, or that read like JSON or a spec sheet.",
            "Do NOT reward or penalize based on correctness, completeness, or length --- only on tone and readability.",
        ],
        rubric=[
            Rubric(score_range=(9, 10), expected_outcome="Clearly a helpful advisor voice: conversational prose that leads with a pick and explains why it fits."),
            Rubric(score_range=(7, 8),  expected_outcome="Clear, conversational, and well-explained in prose. Fully acceptable even as a single focused recommendation."),
            Rubric(score_range=(4, 6),  expected_outcome="Understandable but somewhat flat, formal, or bullet-heavy in places."),
            Rubric(score_range=(0, 3),  expected_outcome="Dry, stiff, a raw field dump, or robotic; does not read like a recommendation to a person."),
        ],
        evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
        threshold=config.APPLICATION_THRESHOLD,
        model=config.get_judge(),
        strict_mode=False,
    )

    # 4. EVALUATE --- all three together
    result = evaluate(test_cases=test_cases, metrics=[correctness, completeness, style])
    return summarize_by_metric(result)


if __name__ == "__main__":
    print_summary("application", run())
