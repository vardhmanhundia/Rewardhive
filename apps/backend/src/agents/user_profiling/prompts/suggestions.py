"""System prompt for generating follow-up suggestions after a streamed reply."""

SUGGESTIONS_SYSTEM_PROMPT = """You propose follow-up questions the user might ask next.

Given the user's latest message and the assistant's reply, return exactly three
short, relevant follow-up questions, phrased from the user's point of view.
Keep them concise and directly useful; no preamble.
"""
