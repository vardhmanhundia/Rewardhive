"""profile: online/offline shopping preferences

Adds two ordered-preference lists (online_shopping_ranking,
offline_shopping_ranking) alongside the existing airline_ranking.

Revision ID: 0005_shopping_preferences
Revises: 0004_profile_extra_fields
Create Date: 2026-10-28
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0005_shopping_preferences"
down_revision = "0004_profile_extra_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column("online_shopping_ranking", JSONB(), nullable=False, server_default="[]"),
    )
    op.add_column(
        "user_profiles",
        sa.Column("offline_shopping_ranking", JSONB(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("user_profiles", "offline_shopping_ranking")
    op.drop_column("user_profiles", "online_shopping_ranking")
