# evals/pipeline.py
"""
The eval-side view of the REAL card-recommendation RAG.

The eval files need a small, synchronous surface to drive: give a query, get
back retrieved context and a grounded answer. The application itself is an async
LangGraph subgraph (``src.agents.recommendation.graph``) that needs a DB session,
a user profile, streaming, and turn persistence -- far more than an eval needs,
and async where the eval loops are sync.

So this module wires the eval surface to the SAME building blocks the app uses,
with nothing faked:

  retrieval : src.services.retrieval_service.RetrievalService  (pgvector ANN over
              card_chunks -> distinct CardProduct rows) -- the exact query path.
  grounding : the exact RECOMMENDATION_SYSTEM_PROMPT the app grounds on.
  generation: the exact RECOMMENDATION_MODEL via src.agents.commons.get_chat_model.

What it deliberately drops (not part of what these evals measure): the user
profile (evals send no profile -> "(not provided)"), card selection, follow-up
suggestions, and DB persistence of the turn. So the answer is a clean function of
retrieval + generation, which is what the quality/safety/ops metrics score.

Sync over async: the pipeline owns ONE private event loop for its whole life and
drives every coroutine on it with ``run_until_complete``. Because it's a single
loop, the async DB engine and the HTTP client stay bound to one loop (no
"attached to a different loop" errors), and DeepEval's own ``evaluate()`` -- which
runs after we've finished building test cases -- still gets a clean slate.
"""

from __future__ import annotations

import asyncio
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from src.agents.commons.llm import get_chat_model
from src.agents.recommendation.prompts import RECOMMENDATION_SYSTEM_PROMPT
from src.config import settings
from src.db.models import CardProduct
from src.services.retrieval_service import RetrievalService


# ============================================================
# 1. CARD -> TEXT  (how a card becomes retrieval context)
# ============================================================
# One card rendered as the compact fact block the generator is grounded on. This
# mirrors the application's own formatting so the context the evals see is the
# context the app would see.
def format_card(card: CardProduct) -> str:
    lines = [f"{card.name} ({card.issuer})"]
    if card.card_type:
        lines.append(f"  type: {card.card_type}")
    lines.append(f"  annual fee: ${card.annual_fee}")
    if card.apr:
        lines.append(f"  APR: {card.apr}")
    if card.foreign_transaction_fee is not None:
        lines.append(f"  foreign transaction fee: {card.foreign_transaction_fee}%")
    if card.credit_score_required:
        lines.append(f"  credit needed: {card.credit_score_required}")
    if card.intro_offer:
        lines.append(f"  intro offer: {card.intro_offer}")
    if card.rewards:
        rewards = "; ".join(f"{r['rate']} {r['category']}" for r in card.rewards)
        lines.append(f"  rewards: {rewards}")
    if card.benefits:
        lines.append(f"  benefits: {'; '.join(card.benefits)}")
    return "\n".join(lines)


# The grounding system prompt the app uses, with the (eval-absent) profile fixed
# to "(not provided)". That leaves exactly one placeholder, {cards}, which we
# rename to {context} so the same template drives both generation and the cost
# eval's `prompt | llm` chain.
_SYSTEM_TEMPLATE = (
    RECOMMENDATION_SYSTEM_PROMPT.replace("{preferences}", "(not provided)").replace(
        "{cards}", "{context}"
    )
)

# Reusable prompt template: {context} (retrieved cards) + {question} (user ask).
# `prompt | llm` (the cost eval) invokes this with those two variables.
prompt = ChatPromptTemplate.from_messages(
    [("system", _SYSTEM_TEMPLATE), ("human", "{question}")]
)


class _RetrievedDoc:
    """Minimal document shim exposing ``.page_content``.

    DeepEval's retrieval metrics (and the stage timers) read ``.page_content`` off
    each retrieved item, the LangChain Document convention. Our retrieval returns
    ORM rows, so we wrap each card's fact block in this.
    """

    __slots__ = ("page_content", "card")

    def __init__(self, card: CardProduct) -> None:
        self.page_content = format_card(card)
        self.card = card


# ============================================================
# 2. THE PIPELINE
# ============================================================
class CardRagPipeline:
    """Synchronous eval surface over the real async card RAG.

    Build one, drive it from the sync eval loops, and ``close()`` it when done
    (or use it as a context manager). Every public method is sync; async work is
    marshalled onto the pipeline's private loop.
    """

    def __init__(self) -> None:
        # One private loop for the pipeline's whole life. Not installed as the
        # thread's current loop, so DeepEval's asyncio.run() later is unaffected.
        self._loop = asyncio.new_event_loop()
        # NullPool: no connection is held between calls, so nothing is pinned to
        # the loop across the gaps -- robust even if a caller reuses the engine.
        self._engine = create_async_engine(
            settings.DATABASE_URL, echo=settings.SQL_ECHO, poolclass=NullPool
        )
        self._sessionmaker = async_sessionmaker(
            bind=self._engine, expire_on_commit=False, autoflush=False
        )
        # Plain generation client (same model the app answers with). Built once;
        # its async HTTP client binds to our single loop on first use.
        self._model = get_chat_model(settings.RECOMMENDATION_MODEL, max_tokens=4096)
        # Expose the retriever as an attribute the ops/retriever evals reach for.
        self.retriever = _Retriever(self)

    # ---- lifecycle --------------------------------------------------------
    def close(self) -> None:
        try:
            self._loop.run_until_complete(self._engine.dispose())
        finally:
            self._loop.close()

    def __enter__(self) -> CardRagPipeline:
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    # ---- messages ---------------------------------------------------------
    @staticmethod
    def _messages(query: str, context: list[str]) -> list[Any]:
        system = _SYSTEM_TEMPLATE.format(context="\n\n".join(context) or "(no matching cards found)")
        return [SystemMessage(content=system), HumanMessage(content=query)]

    @staticmethod
    def _text(content: Any) -> str:
        """Coerce a message/chunk's content (str or list-of-blocks) into text."""
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(p.get("text", "") for p in content if isinstance(p, dict))
        return ""

    # ---- async core -------------------------------------------------------
    async def _aretrieve(self, query: str) -> list[CardProduct]:
        session: AsyncSession
        async with self._sessionmaker() as session:
            return await RetrievalService.retrieve_cards(session, query)

    async def _agenerate(self, query: str, context: list[str]) -> str:
        msg = await self._model.ainvoke(self._messages(query, context))
        return self._text(msg.content)

    async def _agenerate_stream(self, query: str, context: list[str]):
        async for chunk in self._model.astream(self._messages(query, context)):
            text = self._text(chunk.content)
            if text:
                yield text

    # ---- sync surface the evals use --------------------------------------
    def retrieve(self, query: str) -> list[_RetrievedDoc]:
        """Retrieved context for ``query`` as documents with ``.page_content``."""
        cards = self._loop.run_until_complete(self._aretrieve(query))
        return [_RetrievedDoc(c) for c in cards]

    def generate(self, query: str, context: list[str]) -> str:
        """Generate a grounded answer from explicit ``context`` (list of strings)."""
        return self._loop.run_until_complete(self._agenerate(query, context))

    def generate_stream(self, query: str, context: list[str]):
        """Yield answer pieces as they stream, for time-to-first-token timing.

        Drives the async stream one chunk at a time on the private loop so the
        caller sees each token the instant it arrives.
        """
        agen = self._agenerate_stream(query, context).__aiter__()
        while True:
            try:
                piece = self._loop.run_until_complete(agen.__anext__())
            except StopAsyncIteration:
                break
            yield piece

    def invoke(self, query: str) -> dict[str, Any]:
        """Full pipeline: retrieve -> generate. Returns {query, context, answer, cards}."""
        docs = self.retrieve(query)
        context = [d.page_content for d in docs]
        answer = self.generate(query, context)
        return {
            "query": query,
            "context": context,
            "answer": answer,
            "cards": [d.card for d in docs],
        }


class _Retriever:
    """``pipeline.retriever`` -- a thin handle exposing ``invoke(query)``.

    The retriever evals and the latency stage timers call ``retriever.invoke``;
    this delegates to the owning pipeline so there is only ever one engine/loop.
    """

    def __init__(self, pipeline: CardRagPipeline) -> None:
        self._pipeline = pipeline

    def invoke(self, query: str) -> list[_RetrievedDoc]:
        return self._pipeline.retrieve(query)


def build_pipeline() -> CardRagPipeline:
    """Construct the pipeline the whole suite shares."""
    return CardRagPipeline()
