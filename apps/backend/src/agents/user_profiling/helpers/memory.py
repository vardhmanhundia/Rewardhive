"""Long-term memory access for the profiling graph.

Thin wrappers over :class:`MemoryService` so the graph nodes stay free of
storage details.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.services.memory_service import MemoryService


async def format_memories(session: AsyncSession, user_id: UUID) -> str:
    """Render a user's stored memories as a bullet list, or ``(empty)``."""
    memories = await MemoryService.list_memories(session, user_id)
    if not memories:
        return "(empty)"
    return "\n".join(f"- {m.content}" for m in memories)


async def add_memory(session: AsyncSession, user_id: UUID, text: str) -> None:
    """Persist one atomic memory for a user."""
    await MemoryService.add_memory(session, user_id, text)
