"""LLM clients the profiling nodes invoke.

Built once at import through the shared :func:`src.agents.commons.llm.get_chat_model`
factory, which targets Meta Muse (the OpenAI-compatible Meta Model API) and
transparently swaps in a fake/replay model when that mode is enabled. Each
structured client returns a typed Pydantic object; ``reply_stream_llm`` streams
plain text token-by-token. Invocation requires ``MODEL_API_KEY`` (and
``MUSE_BASE_URL``) unless replay mode is on.
"""

from src.agents.commons.llm import get_chat_model
from src.agents.user_profiling.models import ChatReply, ProfileExtraction, SuggestionList
from src.config import settings

# Muse Spark always reasons, so max_tokens must cover reasoning + the answer.
# The two narrow structured tasks also run at low reasoning effort to keep
# reasoning tokens from exhausting the budget before the JSON is produced.
extractor_llm = get_chat_model(
    settings.PROFILING_EXTRACTOR_MODEL,
    max_tokens=2048,
    structured=ProfileExtraction,
    reasoning_effort="low",
)

chat_llm = get_chat_model(settings.PROFILING_CHAT_MODEL, max_tokens=4096, structured=ChatReply)

# Plain (non-structured) model for token-by-token streaming of the reply.
reply_stream_llm = get_chat_model(settings.PROFILING_CHAT_MODEL, max_tokens=4096)

# Structured model for the three follow-up suggestions, generated after the
# reply has finished streaming (streaming can't also return structured output).
suggestions_llm = get_chat_model(
    settings.PROFILING_EXTRACTOR_MODEL,
    max_tokens=2048,
    structured=SuggestionList,
    reasoning_effort="low",
)
