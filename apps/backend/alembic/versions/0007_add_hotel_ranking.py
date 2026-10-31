"""profile: add hotel_ranking column

Revision ID: 0007_add_hotel_ranking
Revises: 0006_profile_dob_gender_city
Create Date: 2026-10-31
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0007_add_hotel_ranking"
down_revision = "0006_profile_dob_gender_city"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column("hotel_ranking", JSONB, nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("user_profiles", "hotel_ranking")
