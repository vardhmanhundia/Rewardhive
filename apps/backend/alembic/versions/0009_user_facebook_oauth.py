"""add facebook_id / oauth_provider to users and make password_hash nullable

Revision ID: 0009_user_facebook_oauth
Revises: 0008_conversation_shares
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa

revision = "0009_user_facebook_oauth"
down_revision = "0008_conversation_shares"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("facebook_id", sa.String(255), nullable=True)
    )
    op.add_column(
        "users", sa.Column("oauth_provider", sa.String(50), nullable=True)
    )
    op.create_index("ix_users_facebook_id", "users", ["facebook_id"], unique=True)

    # OAuth users have no password, so password_hash must be nullable.
    op.alter_column("users", "password_hash", existing_type=sa.String(255), nullable=True)


def downgrade() -> None:
    op.alter_column("users", "password_hash", existing_type=sa.String(255), nullable=False)
    op.drop_index("ix_users_facebook_id", table_name="users")
    op.drop_column("users", "oauth_provider")
    op.drop_column("users", "facebook_id")
