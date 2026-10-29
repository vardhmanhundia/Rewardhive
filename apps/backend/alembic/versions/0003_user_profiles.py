"""extended user profiles

Revision ID: 0003_user_profiles
Revises: 0002_user_memories
Create Date: 2026-10-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0003_user_profiles"
down_revision = "0002_user_memories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column("user_id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("occupation", sa.String(length=200), nullable=True),
        sa.Column("relationship_status", sa.String(length=20), nullable=True),
        sa.Column("family_size", sa.Integer(), nullable=True),
        sa.Column("location_state", sa.String(length=100), nullable=True),
        sa.Column("location_country", sa.String(length=100), nullable=True),
        sa.Column("household", sa.String(length=20), nullable=True),
        sa.Column("car", sa.String(length=20), nullable=True),
        sa.Column("airline_preference", sa.String(length=50), nullable=True),
        sa.Column("travel_preference", sa.String(length=20), nullable=True),
        sa.Column("us_status", sa.String(length=20), nullable=True),
        sa.Column("cards", JSONB(), nullable=False, server_default="[]"),
        sa.Column("banks", JSONB(), nullable=False, server_default="[]"),
        sa.Column("goals", JSONB(), nullable=False, server_default="[]"),
        sa.Column("loans", JSONB(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("user_profiles")
