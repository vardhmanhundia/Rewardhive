"""Tests for the /multimodal/* endpoints and the vision service.

The LLM is driven with canned responses (``llm.fake_responses``) exactly as the
other agent tests do — no API key, no network — and the PDF rasterizer is
monkeypatched so these stay hermetic and do not require the native pdfium wheel.
"""

import base64

from fastapi.testclient import TestClient

from src.agents.commons import llm
from src.services import vision_service

# A 1x1 PNG — valid image bytes for the upload layer; the LLM is faked anyway.
_PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)
_PDF_BYTES = b"%PDF-1.4\n%fake pdf for tests\n"


def _auth_header(client: TestClient, test_user_data: dict) -> dict:
    token = client.post("/auth/signup", json=test_user_data).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# --- auth / validation --------------------------------------------------------
def test_parse_receipt_requires_auth(client: TestClient):
    res = client.post("/multimodal/parse-receipt", files={"file": ("r.png", _PNG_1X1, "image/png")})
    assert res.status_code == 401


def test_unsupported_file_type_rejected(client: TestClient, test_user_data: dict):
    headers = _auth_header(client, test_user_data)
    res = client.post(
        "/multimodal/parse-receipt",
        headers=headers,
        files={"file": ("r.txt", b"not an image", "text/plain")},
    )
    assert res.status_code == 400
    assert "Unsupported file type" in res.json()["detail"]


# --- parse-receipt ------------------------------------------------------------
def test_parse_receipt_extracts_items(client: TestClient, test_user_data: dict):
    headers = _auth_header(client, test_user_data)
    canned = (
        '{"items": [{"merchant": "Whole Foods", "amount": 42.5, "category": "groceries",'
        ' "date": "2026-01-02"}], "total_amount": 42.5, "currency": "USD",'
        ' "statement_date": "2026-01-02"}'
    )
    with llm.fake_responses([canned]):
        res = client.post(
            "/multimodal/parse-receipt",
            headers=headers,
            files={"file": ("receipt.png", _PNG_1X1, "image/png")},
        )
    assert res.status_code == 200
    data = res.json()
    assert data["total_amount"] == 42.5
    assert data["items"][0]["merchant"] == "Whole Foods"
    assert data["items"][0]["category"] == "groceries"


def test_parse_receipt_rasterizes_pdf_before_vision_call(
    client: TestClient, test_user_data: dict, monkeypatch
):
    """A PDF upload must be rendered to page images before the model call, not
    shipped as raw PDF bytes the vision model cannot read."""
    headers = _auth_header(client, test_user_data)
    calls: list[int] = []

    def fake_pdf_to_images(data: bytes, max_pages: int = 10) -> list[str]:
        calls.append(len(data))
        # Two fake page images.
        return [vision_service.encode_image_bytes(b"page1"), vision_service.encode_image_bytes(b"page2")]

    monkeypatch.setattr(vision_service, "_pdf_to_images", fake_pdf_to_images)

    canned = '{"items": [], "total_amount": 0.0, "currency": "USD", "statement_date": null}'
    with llm.fake_responses([canned]):
        res = client.post(
            "/multimodal/parse-receipt",
            headers=headers,
            files={"file": ("statement.pdf", _PDF_BYTES, "application/pdf")},
        )
    assert res.status_code == 200
    assert calls, "PDF was not converted to images before the vision call"


# --- analyze-screenshot -------------------------------------------------------
def test_analyze_screenshot_identifies_purchase(client: TestClient, test_user_data: dict):
    headers = _auth_header(client, test_user_data)
    canned = (
        '{"merchant": "United", "amount": 420.0, "category": "travel",'
        ' "description": "Flight SFO-JFK"}'
    )
    with llm.fake_responses([canned]):
        res = client.post(
            "/multimodal/analyze-screenshot",
            headers=headers,
            files={"file": ("shot.png", _PNG_1X1, "image/png")},
            data={"question": "Which card should I use?"},
        )
    assert res.status_code == 200
    data = res.json()
    assert data["merchant"] == "United"
    assert data["category"] == "travel"


# --- speech -------------------------------------------------------------------
def test_rewrite_for_speech(client: TestClient, test_user_data: dict):
    headers = _auth_header(client, test_user_data)
    with llm.fake_responses(["So here's the deal — your Sapphire wins on dining."]):
        res = client.post(
            "/multimodal/rewrite-for-speech",
            headers=headers,
            json={"text": "The Chase Sapphire Preferred earns 3x on dining."},
        )
    assert res.status_code == 200
    assert "Sapphire" in res.json()["spoken"]


def test_speak_returns_mp3_audio(client: TestClient, test_user_data: dict, monkeypatch):
    headers = _auth_header(client, test_user_data)

    async def fake_tts(text: str, voice: str = vision_service.EDGE_TTS_VOICE) -> bytes:
        return b"ID3-fake-mp3-bytes"

    monkeypatch.setattr(vision_service, "text_to_speech", fake_tts)
    with llm.fake_responses(["Your best bet is the Sapphire."]):
        res = client.post(
            "/multimodal/speak",
            headers=headers,
            json={"text": "Use the Chase Sapphire Preferred for dining."},
        )
    assert res.status_code == 200
    assert res.headers["content-type"] == "audio/mpeg"
    assert res.content == b"ID3-fake-mp3-bytes"


# --- vision_service unit tests ------------------------------------------------
def test_looks_like_pdf_detects_mime_and_magic():
    assert vision_service._looks_like_pdf("application/pdf", b"anything") is True
    assert vision_service._looks_like_pdf("image/png", b"%PDF-1.7 ...") is True
    assert vision_service._looks_like_pdf("image/png", b"\x89PNG\r\n") is False


def test_vision_parts_passes_non_pdf_through():
    b64 = vision_service.encode_image_bytes(_PNG_1X1)
    parts = vision_service._vision_parts(b64, "image/png")
    assert len(parts) == 1
    assert parts[0]["type"] == "image_url"
    assert parts[0]["image_url"]["url"].startswith("data:image/png;base64,")


def test_vision_parts_rasterizes_pdf(monkeypatch):
    monkeypatch.setattr(
        vision_service,
        "_pdf_to_images",
        lambda data, max_pages=10: ["pageA", "pageB", "pageC"],
    )
    b64 = vision_service.encode_image_bytes(_PDF_BYTES)
    parts = vision_service._vision_parts(b64, "application/pdf")
    assert len(parts) == 3
    assert all(p["type"] == "image_url" for p in parts)
    assert parts[0]["image_url"]["url"] == "data:image/png;base64,pageA"
