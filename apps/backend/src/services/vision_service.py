"""Vision service for multimodal image analysis.

Accepts base64-encoded images and sends them to the chat model as multimodal
messages (OpenAI-compatible image_url content parts). Used for receipt parsing,
screenshot-based card queries, and statement extraction.
"""

from __future__ import annotations

import base64
import mimetypes
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from src.agents.commons.llm import get_chat_model
from src.config import settings

RECEIPT_SYSTEM_PROMPT = """\
You are a receipt and bank-statement parser for a credit-card wallet app.

Given an image of a receipt, bank statement, or credit-card statement, extract
every line item you can identify. For each item return:
- merchant: the store / vendor name
- amount: the dollar amount (positive float)
- category: one of: dining, groceries, gas, travel, entertainment, shopping,
  utilities, subscriptions, transport, health, education, other
- date: the transaction date in YYYY-MM-DD format if visible, else null

Also return a summary with:
- total_amount: sum of all extracted amounts
- currency: the currency code (e.g. "USD")
- statement_date: the statement or receipt date if visible

Be precise with amounts. If you cannot read a value clearly, skip that item
rather than guessing. Return valid JSON only."""

SCREENSHOT_SYSTEM_PROMPT = """\
You are a purchase advisor for a credit-card wallet app.

The user is showing you a screenshot of a checkout page, booking confirmation,
product listing, or similar purchase context. Your job is to identify:
- merchant: the store or service name
- amount: the total or per-item price if visible
- category: one of: dining, groceries, gas, travel, entertainment, shopping,
  utilities, subscriptions, transport, health, education, other
- description: a brief description of what is being purchased

Then, given the user's question (if any), provide context so the card-rewards
engine can recommend which card to use. Return valid JSON only."""


class ReceiptLineItem(BaseModel):
    merchant: str
    amount: float
    category: str
    date: str | None = None


class ReceiptParseResult(BaseModel):
    items: list[ReceiptLineItem] = Field(default_factory=list)
    total_amount: float = 0.0
    currency: str = "USD"
    statement_date: str | None = None


class ScreenshotAnalysis(BaseModel):
    merchant: str | None = None
    amount: float | None = None
    category: str | None = None
    description: str = ""


def _image_content_part(image_b64: str, mime_type: str = "image/png") -> dict[str, Any]:
    """Build an OpenAI-compatible image_url content part from base64 data."""
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{mime_type};base64,{image_b64}"},
    }


def _detect_mime(filename: str | None, fallback: str = "image/png") -> str:
    if not filename:
        return fallback
    mime, _ = mimetypes.guess_type(filename)
    return mime or fallback


async def parse_receipt(
    image_b64: str,
    mime_type: str = "image/png",
) -> ReceiptParseResult:
    """Extract line items from a receipt or statement image."""
    llm = get_chat_model(
        settings.RECOMMENDATION_MODEL,
        max_tokens=8192,
        structured=ReceiptParseResult,
        reasoning_effort="medium",
    )
    messages = [
        SystemMessage(content=RECEIPT_SYSTEM_PROMPT),
        HumanMessage(
            content=[
                _image_content_part(image_b64, mime_type),
                {"type": "text", "text": "Parse this receipt or statement image."},
            ]
        ),
    ]
    return await llm.ainvoke(messages)


async def analyze_screenshot(
    image_b64: str,
    question: str = "",
    mime_type: str = "image/png",
) -> ScreenshotAnalysis:
    """Analyze a screenshot to identify a purchase context."""
    llm = get_chat_model(
        settings.RECOMMENDATION_MODEL,
        max_tokens=4096,
        structured=ScreenshotAnalysis,
        reasoning_effort="low",
    )
    text_prompt = question or "What purchase or transaction is shown in this screenshot?"
    messages = [
        SystemMessage(content=SCREENSHOT_SYSTEM_PROMPT),
        HumanMessage(
            content=[
                _image_content_part(image_b64, mime_type),
                {"type": "text", "text": text_prompt},
            ]
        ),
    ]
    return await llm.ainvoke(messages)


SPEECH_REWRITE_PROMPT = """\
You are the voice of RewardHive, a credit-card assistant — but right now you're
talking out loud, not writing. Rewrite the assistant's answer so it sounds like
a smart, friendly American woman chatting with a friend over coffee.

Rules:
- Keep every fact, number, card name, and recommendation intact. Don't drop info.
- Use short, punchy sentences. Vary rhythm. Throw in natural speech connectors
  ("so," "honestly," "here's the deal," "the cool thing is").
- No bullet points, no numbered lists, no markdown. Just flowing speech.
- Don't say "um" or "uh". You're smart — you're just casual.
- If the original has a comparison or ranking, keep the order but narrate it
  ("your best bet is X, and then Y is solid too").
- Aim for roughly the same length — don't pad, don't over-trim.
- End with something warm but not cheesy (like "hope that helps!" or
  "let me know if you want to dig deeper").

Return ONLY the rewritten spoken text. No quotes, no preamble."""


async def rewrite_for_speech(text: str) -> str:
    """Have Muse Spark rewrite a structured answer into casual spoken-word style."""
    if not text.strip():
        return text
    llm = get_chat_model(
        settings.RECOMMENDATION_MODEL,
        max_tokens=4096,
        reasoning_effort="low",
    )
    result = await llm.ainvoke([
        SystemMessage(content=SPEECH_REWRITE_PROMPT),
        HumanMessage(content=text),
    ])
    return result.content if hasattr(result, "content") else str(result)


EDGE_TTS_VOICE = "en-US-JennyNeural"


async def text_to_speech(text: str, voice: str = EDGE_TTS_VOICE) -> bytes:
    """Convert text to MP3 audio bytes using Microsoft Edge TTS."""
    import io
    import edge_tts

    communicate = edge_tts.Communicate(text, voice, rate="+5%", pitch="+5Hz")
    buf = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    return buf.getvalue()


async def rewrite_and_speak(text: str) -> bytes:
    """Rewrite text via Muse Spark, then synthesize with Edge TTS. Returns MP3."""
    spoken = await rewrite_for_speech(text)
    return await text_to_speech(spoken)


def encode_image_bytes(data: bytes) -> str:
    """Encode raw image bytes to base64 string."""
    return base64.b64encode(data).decode("utf-8")
