"""user profiling long-term memory

Revision ID: 0002_user_memories
Revises: 0002_card_catalog
Create Date: 2026-10-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0002_user_memories"
# Chained after 0002_card_catalog (not 0001_initial) so the two merged branches
# form a single linear history; otherwise Alembic sees two heads and
# `alembic upgrade head` fails. These tables are independent, so order is moot.
down_revision = "0002_card_catalog"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_memories",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_user_memories_user_id", "user_memories", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_memories_user_id", table_name="user_memories")
    op.drop_table("user_memories")
