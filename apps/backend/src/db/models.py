"""SQLAlchemy ORM models for database tables"""
import uuid
from datetime import datetime
from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector
from .database import Base

# SONAR embedding dimension. Keep in sync with settings.EMBEDDING_DIM and the
# Vector(...) size in the card_chunks migration.
EMBEDDING_DIM = 1024


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Card(id={self.id}, title={self.title})>"


class CardProduct(Base):
    """A card in the catalog the assistant recommends from (the exact facts)."""

    __tablename__ = "card_products"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    issuer: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    network: Mapped[str | None] = mapped_column(String(50), nullable=True)
    card_type: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    annual_fee: Mapped[int] = mapped_column(Integer, nullable=False)
    apr: Mapped[str | None] = mapped_column(String(200), nullable=True)
    foreign_transaction_fee: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    credit_score_required: Mapped[str | None] = mapped_column(String(100), nullable=True)
    intro_offer: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Kept as-is from the catalog; structured rather than embedded. JSONB on
    # Postgres, generic JSON under SQLite so the test schema can be created.
    rewards: Mapped[list[dict[str, str]]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=False
    )
    benefits: Mapped[list[str]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=False
    )
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<CardProduct(id={self.id}, name={self.name})>"


class CardChunk(Base):
    """One embeddable piece of a card's text, with its SONAR vector (RAG retrieval)."""

    __tablename__ = "card_chunks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    card_id: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("card_products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    # pgvector column on Postgres; Text under SQLite purely so the test schema
    # can be created (chunks are never inserted in tests).
    embedding: Mapped[list[float]] = mapped_column(
        Vector(EMBEDDING_DIM).with_variant(Text(), "sqlite"), nullable=False
    )

    def __repr__(self) -> str:
        return f"<CardChunk(id={self.id}, card_id={self.card_id})>"
