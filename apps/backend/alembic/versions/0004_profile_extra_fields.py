"""profile: company, visa/green-card detail, airline ranking

Adds company and us_status_detail, replaces the single airline_preference with
an ordered airline_ranking list.

Revision ID: 0004_profile_extra_fields
Revises: 0003_user_profiles
Create Date: 2026-10-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0004_profile_extra_fields"
down_revision = "0003_user_profiles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_profiles", sa.Column("company", sa.String(length=200), nullable=True))
    op.add_column(
        "user_profiles", sa.Column("us_status_detail", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "user_profiles",
        sa.Column("airline_ranking", JSONB(), nullable=False, server_default="[]"),
    )
    op.drop_column("user_profiles", "airline_preference")


def downgrade() -> None:
    op.add_column(
        "user_profiles", sa.Column("airline_preference", sa.String(length=50), nullable=True)
    )
    op.drop_column("user_profiles", "airline_ranking")
    op.drop_column("user_profiles", "us_status_detail")
    op.drop_column("user_profiles", "company")
