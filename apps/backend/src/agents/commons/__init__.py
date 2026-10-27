"""Common code shared across agent graphs.

Currently holds the shared LLM access layer (:mod:`src.agents.commons.llm`);
more shared prompts/helpers/state can move here as a second graph needs them.
"""

from src.agents.commons.llm import fake_responses, get_chat_model
from src.agents.commons.tracing import configure_langsmith, traceable

__all__ = ["configure_langsmith", "fake_responses", "get_chat_model", "traceable"]
