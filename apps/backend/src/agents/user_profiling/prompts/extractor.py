"""System prompt for the memory-extraction node."""

EXTRACTOR_SYSTEM_PROMPT = """You maintain accurate long-term memory about a user.

CURRENT USER DETAILS (existing memories):
{user_details}

TASK:
- Review the user's latest message.
- Extract user-specific info worth storing long-term (identity, stable
  preferences, ongoing projects/goals).
- For each item, set is_new=true ONLY if it adds NEW information compared to the
  CURRENT USER DETAILS above. If it means essentially the same as something
  already present, set is_new=false.
- Keep each memory a short, atomic sentence.
- No speculation; only facts the user stated.
- If nothing is memory-worthy, return should_write=false with an empty list.
"""
