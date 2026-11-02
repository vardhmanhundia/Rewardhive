"""conversation sharing, notifications, invite status and roles

Revision ID: 0008_conversation_shares
Revises: 1117ae60f33e
Create Date: 2026-11-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0008_conversation_shares"
down_revision = "1117ae60f33e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "conversation_shares",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("conversation_id", UUID(as_uuid=True), nullable=False),
        sa.Column("shared_by_user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("shared_with_user_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="pending"
        ),
        sa.Column(
            "role", sa.String(20), nullable=False, server_default="member"
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["conversations.id"], ondelete="CASCADE"
        ),
    )
    op.create_index(
        "ix_conversation_shares_conversation_id",
        "conversation_shares",
        ["conversation_id"],
    )
    op.create_index(
        "ix_conversation_shares_shared_with_user_id",
        "conversation_shares",
        ["shared_with_user_id"],
    )
    op.create_unique_constraint(
        "uq_conversation_shares_conv_user",
        "conversation_shares",
        ["conversation_id", "shared_with_user_id"],
    )

    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("conversation_id", UUID(as_uuid=True), nullable=True),
        sa.Column("actor_user_id", UUID(as_uuid=True), nullable=True),
        sa.Column(
            "is_read", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_notifications_user_id", "notifications", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
    op.drop_constraint(
        "uq_conversation_shares_conv_user", "conversation_shares", type_="unique"
    )
    op.drop_index(
        "ix_conversation_shares_shared_with_user_id",
        table_name="conversation_shares",
    )
    op.drop_index(
        "ix_conversation_shares_conversation_id",
        table_name="conversation_shares",
    )
    op.drop_table("conversation_shares")
