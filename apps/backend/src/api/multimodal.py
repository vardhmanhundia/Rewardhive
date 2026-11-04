"""Multimodal endpoints — receipt parsing, screenshot analysis, and voice TTS.

These endpoints accept image uploads (multipart/form-data) and return structured
JSON. The vision service handles the LLM calls; this module handles the HTTP
layer, auth, and file validation.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_db
from src.middleware.auth import get_current_user_id, verify_user_auth
from src.services.vision_service import (
    ReceiptParseResult,
    ScreenshotAnalysis,
    analyze_screenshot,
    encode_image_bytes,
    parse_receipt,
    rewrite_for_speech,
    rewrite_and_speak,
    _detect_mime,
)

router = APIRouter(prefix="/multimodal", tags=["multimodal"])

_MAX_IMAGE_SIZE = 20 * 1024 * 1024  # 20 MB
_ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"}


async def _read_upload(file: UploadFile) -> tuple[str, str]:
    """Read and validate an uploaded image, returning (base64, mime_type)."""
    if file.content_type and file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. "
            f"Allowed: {', '.join(sorted(_ALLOWED_TYPES))}",
        )
    data = await file.read()
    if len(data) > _MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 20 MB)")
    mime = file.content_type or _detect_mime(file.filename)
    return encode_image_bytes(data), mime


@router.post("/parse-receipt", response_model=ReceiptParseResult)
async def parse_receipt_endpoint(
    file: UploadFile = File(..., description="Receipt or statement image"),
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> ReceiptParseResult:
    """Upload a receipt or bank/card statement image and extract spend data.

    Returns structured line items with merchant, amount, category, and date.
    """
    image_b64, mime = await _read_upload(file)
    result = await parse_receipt(image_b64, mime_type=mime)
    return result


@router.post("/analyze-screenshot", response_model=ScreenshotAnalysis)
async def analyze_screenshot_endpoint(
    file: UploadFile = File(..., description="Screenshot of a checkout or purchase"),
    question: str = Form("", description="Optional question about the screenshot"),
    payload: dict = Depends(verify_user_auth),
    session: AsyncSession = Depends(get_db),
) -> ScreenshotAnalysis:
    """Upload a screenshot and get purchase context for the card advisor.

    The response identifies the merchant, amount, and category so the rewards
    engine can recommend which card to use.
    """
    image_b64, mime = await _read_upload(file)
    result = await analyze_screenshot(image_b64, question=question, mime_type=mime)
    return result


class SpeechRewriteRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)


class SpeechRewriteResponse(BaseModel):
    spoken: str


@router.post("/rewrite-for-speech", response_model=SpeechRewriteResponse)
async def rewrite_for_speech_endpoint(
    request: SpeechRewriteRequest,
    payload: dict = Depends(verify_user_auth),
) -> SpeechRewriteResponse:
    """Rewrite a structured assistant answer into casual, spoken-word style."""
    spoken = await rewrite_for_speech(request.text)
    return SpeechRewriteResponse(spoken=spoken)


@router.post("/speak")
async def speak_endpoint(
    request: SpeechRewriteRequest,
    payload: dict = Depends(verify_user_auth),
) -> Response:
    """Rewrite text via Muse Spark, then synthesize speech with Edge TTS.

    Returns MP3 audio. The text is first rewritten into a friendly
    conversational style, then spoken by a neural US-English female voice.
    """
    audio = await rewrite_and_speak(request.text)
    return Response(content=audio, media_type="audio/mpeg")
