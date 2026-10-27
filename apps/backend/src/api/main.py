"""FastAPI application"""
# pyright: reportMissingImports=false
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.config import settings
from src.api.auth import router as auth_router


app = FastAPI(
    title="Card Agent API",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "version": "0.1.0",
    }


@app.get("/cards")
async def get_cards():
    """Get all cards"""
    return {"cards": []}


@app.post("/cards")
async def create_card(card_data: dict):
    """Create a new card"""
    return {"card": card_data}
