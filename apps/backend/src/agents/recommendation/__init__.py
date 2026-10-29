"""Card-recommendation agent: profile-aware RAG over the card catalog.

Exposes the recommendation subgraph builder. The composed turn (profiling +
recommendation) and its entrypoints live in :mod:`src.agents.graph`.
"""

from src.agents.recommendation.graph import build_recommendation_subgraph

__all__ = ["build_recommendation_subgraph"]
