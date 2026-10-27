"""User-profiling LangGraph workflow — wires the pieces together and runs.

A two-node graph that mirrors the reference sample, adapted to this project's
stack (async SQLAlchemy + Anthropic Claude):

    START -> remember -> chat -> END

- ``remember`` extracts memory-worthy, atomic facts from the latest user
  message with a cheap structured LLM and persists the genuinely-new ones as
  long-term memory (Postgres, via :class:`MemoryService`).
- ``chat`` answers the user, personalized with everything known about them,
  and proposes three relevant follow-up questions.

Inputs arrive as function parameters (``user_id``, ``message``, optional
``history``) — the frontend owns conversation state and calls
:func:`run_profiling_turn`. The database session is injected per invocation
through the LangGraph config so the compiled graph stays stateless.

The building blocks live in sibling packages:
``prompts`` (system prompts), ``models`` (schemas + state), ``tools`` (LLM
clients), and ``helpers`` (config/memory access).
"""

from collections.abc import AsyncIterator
from typing import Any, cast
from uuid import UUID

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.commons.tracing import traceable
from src.agents.user_profiling.helpers import (
    add_memory,
    config_values,
    format_memories,
    history_messages,
)
from src.agents.user_profiling.models import (
    ChatReply,
    MemoryDecision,
    ProfilingResult,
    ProfilingState,
    SuggestionList,
)
from src.agents.user_profiling.prompts import (
    CHAT_SYSTEM_PROMPT,
    EXTRACTOR_SYSTEM_PROMPT,
    SUGGESTIONS_SYSTEM_PROMPT,
)
from src.agents.user_profiling.tools import (
    chat_llm,
    extractor_llm,
    reply_stream_llm,
    suggestions_llm,
)


# ----------------------------------------------------------------------------
# Shared steps (used by both the compiled graph and the streaming entrypoint)
# ----------------------------------------------------------------------------
async def extract_and_store_memories(
    session: AsyncSession, user_id: UUID, message: str
) -> list[str]:
    """Extract memory-worthy facts from ``message`` and persist the new ones.

    Returns the list of memory texts stored this turn.
    """
    existing = await format_memories(session, user_id)

    decision = cast(
        MemoryDecision,
        await extractor_llm.ainvoke(
            [
                SystemMessage(content=EXTRACTOR_SYSTEM_PROMPT.format(user_details=existing)),
                HumanMessage(content=message),
            ]
        ),
    )

    stored: list[str] = []
    if decision.should_write:
        for item in decision.memories:
            if item.is_new and item.text.strip():
                await add_memory(session, user_id, item.text)
                stored.append(item.text.strip())
    return stored


# ----------------------------------------------------------------------------
# Nodes
# ----------------------------------------------------------------------------
async def remember_node(state: ProfilingState, config: RunnableConfig) -> ProfilingState:
    """Extract memory-worthy facts and persist the genuinely-new ones."""
    session, user_id = config_values(config)
    stored = await extract_and_store_memories(session, user_id, state.get("message", ""))
    return {"new_memories": stored}


async def chat_node(state: ProfilingState, config: RunnableConfig) -> ProfilingState:
    """Answer the user, personalized with everything known about them."""
    session, user_id = config_values(config)
    # Re-read so memories just stored this turn are available.
    user_details = await format_memories(session, user_id)

    messages: list[Any] = [
        SystemMessage(content=CHAT_SYSTEM_PROMPT.format(user_details=user_details))
    ]
    messages.extend(history_messages(state))
    messages.append(HumanMessage(content=state.get("message", "")))

    result = cast(ChatReply, await chat_llm.ainvoke(messages))
    return {"reply": result.reply, "suggestions": result.suggestions[:3]}


# ----------------------------------------------------------------------------
# Graph assembly
# ----------------------------------------------------------------------------
def _build_graph():
    builder = StateGraph(ProfilingState)
    builder.add_node("remember", remember_node)
    builder.add_node("chat", chat_node)
    builder.add_edge(START, "remember")
    builder.add_edge("remember", "chat")
    builder.add_edge("chat", END)
    return builder.compile()


# Compiled once (stateless); the session is injected per invocation.
compiled_graph = _build_graph()


# ----------------------------------------------------------------------------
# Entrypoint
# ----------------------------------------------------------------------------
@traceable(run_type="chain", name="profiling_turn")
async def run_profiling_turn(
    session: AsyncSession,
    user_id: UUID,
    message: str,
    history: list[dict[str, str]] | None = None,
) -> ProfilingResult:
    """Run one user-profiling turn.

    Args:
        session: Active async DB session (the caller owns the transaction).
        user_id: The user whose long-term memory this turn reads and updates.
        message: The user's latest message.
        history: Optional prior turns as ``[{"role": "user"|"assistant",
            "content": str}, ...]`` for in-context personalization.

    Returns:
        The personalized reply, three follow-up suggestions, and any memories
        stored this turn.
    """
    state: ProfilingState = {"message": message, "history": history or []}
    config: RunnableConfig = {"configurable": {"session": session, "user_id": user_id}}
    final = await compiled_graph.ainvoke(state, config)
    return ProfilingResult(
        reply=final.get("reply", ""),
        suggestions=final.get("suggestions", []),
        new_memories=final.get("new_memories", []),
    )


def _chunk_text(content: Any) -> str:
    """Coerce a streamed message chunk's content into text.

    Anthropic chunks arrive as plain strings, but LangChain may also surface
    content as a list of blocks (e.g. ``[{"type": "text", "text": "..."}]``).
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(part.get("text", "") for part in content if isinstance(part, dict))
    return ""


async def _generate_suggestions(message: str, reply: str) -> list[str]:
    """Propose three follow-up questions from the completed turn."""
    result = cast(
        SuggestionList,
        await suggestions_llm.ainvoke(
            [
                SystemMessage(content=SUGGESTIONS_SYSTEM_PROMPT),
                HumanMessage(content=f"User said:\n{message}\n\nAssistant replied:\n{reply}"),
            ]
        ),
    )
    return result.suggestions[:3]


@traceable(run_type="chain", name="profiling_turn_stream")
async def stream_profiling_turn(
    session: AsyncSession,
    user_id: UUID,
    message: str,
    history: list[dict[str, str]] | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Run one profiling turn, streaming the reply token-by-token.

    Yields event dicts the transport serializes as SSE, in order:

    - ``{"type": "token", "text": "..."}`` — repeated, as reply chunks arrive.
    - ``{"type": "memories", "items": [...]}`` — memories stored this turn.
    - ``{"type": "suggestions", "items": [q1, q2, q3]}`` — follow-up questions.
    - ``{"type": "done"}`` — stream complete.

    On failure a single ``{"type": "error", "detail": "..."}`` is yielded.

    The caller owns the transaction; this commits once after memory extraction
    so stored memories persist even if the client disconnects mid-stream.
    """
    try:
        # 1. Extract and persist long-term memories (not streamed), then commit
        #    so they survive a dropped connection during the reply stream.
        new_memories = await extract_and_store_memories(session, user_id, message)
        await session.commit()

        # 2. Stream the personalized reply. Re-read memories so anything stored
        #    this turn is available to the answer.
        user_details = await format_memories(session, user_id)
        messages: list[Any] = [
            SystemMessage(content=CHAT_SYSTEM_PROMPT.format(user_details=user_details))
        ]
        messages.extend(history_messages({"history": history or []}))
        messages.append(HumanMessage(content=message))

        reply_parts: list[str] = []
        async for chunk in reply_stream_llm.astream(messages):
            text = _chunk_text(chunk.content)
            if text:
                reply_parts.append(text)
                yield {"type": "token", "text": text}

        reply = "".join(reply_parts)

        # 3. Terminal metadata events.
        yield {"type": "memories", "items": new_memories}
        yield {"type": "suggestions", "items": await _generate_suggestions(message, reply)}
        yield {"type": "done"}
    except Exception as exc:  # noqa: BLE001 — surface any failure to the client
        yield {"type": "error", "detail": str(exc)}
