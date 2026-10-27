"""card catalog: card_products and card_chunks (pgvector)

Revision ID: 0002_card_catalog
Revises: 0001_initial
Create Date: 2026-10-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

revision = "0002_card_catalog"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

# SONAR embedding dimension. Keep in sync with models.EMBEDDING_DIM.
EMBEDDING_DIM = 1024


def upgrade() -> None:
    # The `vector` extension is already created in 0001_initial.
    op.create_table(
        "card_products",
        sa.Column("id", sa.String(100), primary_key=True, nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("issuer", sa.String(100), nullable=False),
        sa.Column("network", sa.String(50), nullable=True),
        sa.Column("card_type", sa.String(50), nullable=True),
        sa.Column("annual_fee", sa.Integer(), nullable=False),
        sa.Column("apr", sa.String(200), nullable=True),
        sa.Column("foreign_transaction_fee", sa.Numeric(5, 2), nullable=True),
        sa.Column("credit_score_required", sa.String(100), nullable=True),
        sa.Column("intro_offer", sa.Text(), nullable=True),
        sa.Column("rewards", postgresql.JSONB(), nullable=False),
        sa.Column("benefits", postgresql.JSONB(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
    )
    op.create_index("ix_card_products_issuer", "card_products", ["issuer"])
    op.create_index("ix_card_products_card_type", "card_products", ["card_type"])

    op.create_table(
        "card_chunks",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column(
            "card_id",
            sa.String(100),
            sa.ForeignKey("card_products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=False),
    )
    op.create_index("ix_card_chunks_card_id", "card_chunks", ["card_id"])
    # Approximate-nearest-neighbor index for cosine similarity search.
    op.create_index(
        "ix_card_chunks_embedding",
        "card_chunks",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_card_chunks_embedding", table_name="card_chunks")
    op.drop_index("ix_card_chunks_card_id", table_name="card_chunks")
    op.drop_table("card_chunks")
    op.drop_index("ix_card_products_card_type", table_name="card_products")
    op.drop_index("ix_card_products_issuer", table_name="card_products")
    op.drop_table("card_products")
