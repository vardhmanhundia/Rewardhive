"""Prompt templates for the user-profiling graph."""

from src.agents.user_profiling.prompts.chat import CHAT_SYSTEM_PROMPT
from src.agents.user_profiling.prompts.extractor import EXTRACTOR_SYSTEM_PROMPT
from src.agents.user_profiling.prompts.suggestions import SUGGESTIONS_SYSTEM_PROMPT

__all__ = [
    "CHAT_SYSTEM_PROMPT",
    "EXTRACTOR_SYSTEM_PROMPT",
    "SUGGESTIONS_SYSTEM_PROMPT",
]
