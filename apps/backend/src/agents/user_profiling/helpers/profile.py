"""Structured-profile long-term memory for the profiling graph.

The profiling agent's memory is the user's structured profile
(``user_profiles``): the extractor finds the fields defined in
:class:`src.models.UserProfileDetails`, and this module merges them into what is
already stored and renders the profile for the LLM prompts.

Merge policy (locked with the product owner):

- **Multi-value fields** (airline / online / offline shopping rankings, banks,
  goals, loans, cards): union — new items are appended and de-duplicated, so
  values collected from the Profile UI and from chat coexist. Nothing is lost.
- **Single-value fields** (occupation, company, relationship, family size,
  location, household, car, travel preference, US status + detail): fill when
  empty; when a newly-mentioned value conflicts with the stored one it is *not*
  overwritten but surfaced as a :class:`ProfileConflict` for the assistant to
  ask about — unless the user confirmed it (``confirmed_fields``), in which case
  it overwrites.
"""

from typing import Any, Callable
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.user_profiling.models import ProfileConflict, ProfileExtraction
from src.models import SavedCard, UserProfileDetails, UserProfileUpdate
from src.services.user_service import UserService

# Single-value fields mapped to the human label used in summaries / questions.
SINGLE_FIELDS: dict[str, str] = {
    "occupation": "occupation",
    "company": "company",
    "relationship_status": "relationship",
    "family_size": "family size",
    "location_state": "state",
    "location_country": "country",
    "household": "household",
    "car": "car",
    "travel_preference": "travel preference",
    "us_status": "US status",
    "us_status_detail": "US status detail",
}

# Plain string lists.
STR_LIST_FIELDS: dict[str, str] = {
    "airline_ranking": "airlines",
    "online_shopping_ranking": "online shopping",
    "offline_shopping_ranking": "offline shopping",
}


async def load_profile(session: AsyncSession, user_id: UUID) -> UserProfileDetails:
    """Load the user's structured profile (empty defaults on first access)."""
    profile = await UserService.get_profile_details(session, user_id)
    return UserProfileDetails.model_validate(profile)


async def format_profile(session: AsyncSession, user_id: UUID) -> str:
    """Load and render the user's profile as a bullet list for an LLM prompt."""
    return render_profile(await load_profile(session, user_id))


def _is_empty(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _union(
    current: list[Any], incoming: list[Any], key: Callable[[Any], Any]
) -> tuple[list[Any], int]:
    """Append items from ``incoming`` not already in ``current`` (by ``key``).

    Returns the merged list (existing order preserved) and the number added.
    """
    merged = list(current)
    seen = {key(item) for item in current}
    added = 0
    for item in incoming:
        k = key(item)
        if k in seen:
            continue
        seen.add(k)
        merged.append(item)
        added += 1
    return merged, added


def _card_key(c: SavedCard) -> tuple[str, str]:
    ident = c.card_id or f"custom:{(c.name or '').strip().lower()}"
    return ident, (c.category or "").strip().lower()


# Object-list fields: (SavedModel, dedupe key). banks/goals/loans/cards.
_OBJECT_LIST_FIELDS: dict[str, tuple[str, Callable[[Any], Any]]] = {
    "banks": ("banks", lambda b: (b.name or "").strip().lower()),
    "goals": ("goals", lambda g: (g.text or "").strip().lower()),
    "loans": ("loans", lambda loan: (loan.loan_type or "").strip().lower()),
    "cards": ("cards", _card_key),
}


def merge_extraction(
    current: UserProfileDetails, extracted: ProfileExtraction
) -> tuple[dict[str, Any], list[str], list[ProfileConflict]]:
    """Merge an extraction into the stored profile.

    Returns ``(changes, updates, conflicts)``:

    - ``changes``: field -> new value to persist (only fields that changed).
    - ``updates``: human-readable one-liners describing each change this turn.
    - ``conflicts``: unconfirmed single-value conflicts to ask the user about.
    """
    changes: dict[str, Any] = {}
    updates: list[str] = []
    conflicts: list[ProfileConflict] = []
    confirmed = {f.strip() for f in (extracted.confirmed_fields or [])}

    # Single-value fields: fill-if-empty, overwrite-if-confirmed, else conflict.
    for field, label in SINGLE_FIELDS.items():
        new = getattr(extracted, field)
        if _is_empty(new):
            continue
        cur = getattr(current, field)
        if _is_empty(cur):
            changes[field] = new
            updates.append(f"{label} → {new}")
        elif str(cur) == str(new):
            continue
        elif field in confirmed:
            changes[field] = new
            updates.append(f"{label}: {cur} → {new}")
        else:
            conflicts.append(
                ProfileConflict(field=field, label=label, stored=str(cur), mentioned=str(new))
            )

    # Plain string lists: union-append, de-duplicated case-insensitively.
    for field, label in STR_LIST_FIELDS.items():
        incoming = [s for s in (getattr(extracted, field) or []) if s and s.strip()]
        merged, added = _union(
            getattr(current, field) or [], incoming, key=lambda s: s.strip().lower()
        )
        if added:
            changes[field] = merged
            updates.append(f"{label}: added {added}")

    # Object lists (banks / goals / loans / cards): union-append by natural key.
    for field, (label, key) in _OBJECT_LIST_FIELDS.items():
        incoming = getattr(extracted, field) or []
        merged, added = _union(getattr(current, field) or [], incoming, key=key)
        if added:
            changes[field] = merged
            updates.append(f"{label}: added {added}")

    return changes, updates, conflicts


async def apply_profile_changes(
    session: AsyncSession, user_id: UUID, changes: dict[str, Any]
) -> None:
    """Persist merged profile ``changes`` (no-op when empty)."""
    if not changes:
        return
    await UserService.upsert_profile(session, user_id, UserProfileUpdate(**changes))


def render_conflicts(conflicts: list[dict]) -> str:
    """Render unconfirmed conflicts as instructions for the chat prompt."""
    if not conflicts:
        return "(none)"
    lines = [
        f'- {c["label"]}: you have "{c["stored"]}" saved, but they just '
        f'mentioned "{c["mentioned"]}"'
        for c in conflicts
    ]
    return "\n".join(lines)


def render_profile(details: UserProfileDetails) -> str:
    """Render a structured profile as a readable bullet list, or ``(empty)``."""
    lines: list[str] = []

    def add(label: str, value: Any) -> None:
        if not _is_empty(value):
            lines.append(f"- {label}: {value}")

    add("Occupation", details.occupation)
    add("Company", details.company)
    if details.relationship_status:
        rel = str(details.relationship_status)
        if details.family_size is not None:
            rel += f" (size {details.family_size})"
        lines.append(f"- Relationship: {rel}")
    location = ", ".join(p for p in (details.location_state, details.location_country) if p)
    add("Location", location)
    add("Household", details.household)
    add("Car", details.car)
    add("Travel preference", details.travel_preference)
    if details.us_status:
        status = str(details.us_status)
        if details.us_status_detail:
            status += f" ({details.us_status_detail})"
        lines.append(f"- US status: {status}")
    if details.airline_ranking:
        lines.append(f"- Preferred airlines: {' > '.join(details.airline_ranking)}")
    if details.online_shopping_ranking:
        lines.append(f"- Online shopping: {' > '.join(details.online_shopping_ranking)}")
    if details.offline_shopping_ranking:
        lines.append(f"- Offline shopping: {' > '.join(details.offline_shopping_ranking)}")
    if details.banks:
        lines.append(f"- Banks: {', '.join(b.name for b in details.banks)}")
    if details.goals:
        lines.append(f"- Goals: {', '.join(g.text for g in details.goals)}")
    if details.loans:
        lines.append(f"- Loans: {', '.join(x.loan_type for x in details.loans)}")
    if details.cards:
        rendered = ", ".join(
            f"{c.name or c.card_id} ({c.category}{', custom' if c.custom else ''})"
            for c in details.cards
        )
        lines.append(f"- Cards: {rendered}")

    return "\n".join(lines) if lines else "(empty)"
