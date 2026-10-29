"""Structured output schemas for the recommendation subgraph."""

from __future__ import annotations

from pydantic import BaseModel, Field


class RecommendedSelection(BaseModel):
    """Which of the candidate cards the written recommendation actually endorses.

    Retrieval hands Muse several candidates for grounding, but the answer usually
    recommends only a couple. This narrows the candidates down to the cards the
    answer actually puts forward, so the UI shows those and not the whole
    retrieved set.
    """

    card_ids: list[str] = Field(
        default_factory=list,
        description=(
            "IDs of the candidate cards the recommendation actually puts forward, "
            "best fit first. Use the exact id values from the candidate list. "
            "Include only cards the answer recommends; omit ones merely retrieved "
            "or mentioned to rule out."
        ),
    )
