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

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.commons.tracing import traceable
from src.agents.user_profiling.helpers import (
    apply_profile_changes,
    config_values,
    format_profile,
    history_messages,
    load_profile,
    merge_extraction,
    render_conflicts,
    render_profile,
)
from src.agents.user_profiling.models import (
    ChatReply,
    ProfileExtraction,
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
async def extract_and_update_profile(
    session: AsyncSession,
    user_id: UUID,
    message: str,
    history: list[dict[str, str]] | None = None,
) -> tuple[list[str], list[dict]]:
    """Extract structured profile fields from ``message`` and merge them in.

    The conversation ``history`` is passed to the extractor so it can tell when
    the user is confirming/correcting a conflicting single value (vs. mentioning
    it in passing). Returns ``(updates, conflicts)`` where ``updates`` are
    human-readable summaries of what changed and ``conflicts`` are unconfirmed
    single-value differences for the chat node to ask about.
    """
    current = await load_profile(session, user_id)

    messages: list[Any] = [
        SystemMessage(content=EXTRACTOR_SYSTEM_PROMPT.format(user_details=render_profile(current)))
    ]
    messages.extend(history_messages({"history": history or []}))
    messages.append(HumanMessage(content=message))

    extraction = cast(ProfileExtraction, await extractor_llm.ainvoke(messages))
    changes, updates, conflicts = merge_extraction(current, extraction)
    await apply_profile_changes(session, user_id, changes)
    return updates, [c.model_dump() for c in conflicts]


# ----------------------------------------------------------------------------
# Nodes
# ----------------------------------------------------------------------------
async def remember_node(state: ProfilingState, config: RunnableConfig) -> ProfilingState:
    """Extract structured profile fields and merge the new/confirmed ones."""
    session, user_id = config_values(config)
    updates, conflicts = await extract_and_update_profile(
        session, user_id, state.get("message", ""), state.get("history")
    )
    return {"new_memories": updates, "conflicts": conflicts}


async def chat_node(state: ProfilingState, config: RunnableConfig) -> ProfilingState:
    """Answer the user, personalized with everything known about them."""
    session, user_id = config_values(config)
    # Re-read so fields just stored this turn are reflected in the answer.
    user_details = await format_profile(session, user_id)

    messages: list[Any] = [
        SystemMessage(
            content=CHAT_SYSTEM_PROMPT.format(
                user_details=user_details,
                conflicts=render_conflicts(state.get("conflicts") or []),
            )
        )
    ]
    messages.extend(history_messages(state))
    messages.append(HumanMessage(content=state.get("message", "")))

    result = cast(ChatReply, await chat_llm.ainvoke(messages))
    return {"reply": result.reply, "suggestions": result.suggestions[:3]}


# ----------------------------------------------------------------------------
# Graph assembly
# ----------------------------------------------------------------------------
def _build_graph(checkpointer: Any = None) -> Any:
    builder = StateGraph(ProfilingState)
    builder.add_node("remember", remember_node)
    builder.add_node("chat", chat_node)
    builder.add_edge(START, "remember")
    builder.add_edge("remember", "chat")
    builder.add_edge("chat", END)
    return builder.compile(checkpointer=checkpointer)


# Compiled once for generation (stateless); the session is injected per call.
compiled_graph = _build_graph()

# A second compile bound to the Postgres checkpointer, used only as a per-user
# conversation store (via aget_state/aupdate_state) — never invoked. Set at
# startup once persistence is available; None means persistence is disabled.
_persist_graph: Any = None


def set_checkpointer(checkpointer: Any) -> None:
    """Enable persistence by binding a checkpointer (called at app startup)."""
    global _persist_graph
    _persist_graph = _build_graph(checkpointer) if checkpointer is not None else None


def _message_role(message: Any) -> str:
    return "assistant" if message.type == "ai" else "user"


async def load_history(user_id: UUID) -> list[dict[str, str]]:
    """Return the user's persisted conversation as ``[{role, content}, ...]``.

    Empty if persistence is disabled or the user has no stored chat. Best-effort:
    never raises — a storage error yields an empty history.
    """
    if _persist_graph is None:
        return []
    try:
        config: RunnableConfig = {"configurable": {"thread_id": str(user_id)}}
        snapshot = await _persist_graph.aget_state(config)
        stored = snapshot.values.get("messages", []) if snapshot else []
        return [{"role": _message_role(m), "content": _chunk_text(m.content)} for m in stored]
    except Exception:  # noqa: BLE001 — persistence is best-effort
        return []


async def persist_turn(user_id: UUID, user_message: str, ai_message: str) -> None:
    """Append one (user, assistant) turn to the user's persisted conversation.

    No-op when persistence is disabled. Best-effort: a storage error is swallowed
    so it never breaks the chat response.
    """
    if _persist_graph is None:
        return
    try:
        config: RunnableConfig = {"configurable": {"thread_id": str(user_id)}}
        await _persist_graph.aupdate_state(
            config,
            {"messages": [HumanMessage(content=user_message), AIMessage(content=ai_message)]},
        )
    except Exception:  # noqa: BLE001 — persistence is best-effort
        pass


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
    reply = final.get("reply", "")
    await persist_turn(user_id, message, reply)
    return ProfilingResult(
        reply=reply,
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
        # 1. Extract and persist structured profile fields (not streamed), then
        #    commit so they survive a dropped connection during the reply stream.
        new_memories, conflicts = await extract_and_update_profile(
            session, user_id, message, history
        )
        await session.commit()

        # 2. Stream the personalized reply. Re-read the profile so anything
        #    stored this turn is reflected in the answer.
        user_details = await format_profile(session, user_id)
        messages: list[Any] = [
            SystemMessage(
                content=CHAT_SYSTEM_PROMPT.format(
                    user_details=user_details, conflicts=render_conflicts(conflicts)
                )
            )
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

        # 3. Persist the turn so the conversation survives logout/login.
        await persist_turn(user_id, message, reply)

        # 4. Terminal metadata events.
        yield {"type": "memories", "items": new_memories}
        yield {"type": "suggestions", "items": await _generate_suggestions(message, reply)}
        yield {"type": "done"}
    except Exception as exc:  # noqa: BLE001 — surface any failure to the client
        yield {"type": "error", "detail": str(exc)}
