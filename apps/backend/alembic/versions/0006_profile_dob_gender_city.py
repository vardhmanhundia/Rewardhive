"""profile: add date_of_birth, gender, city columns

Revision ID: 0006_profile_dob_gender_city
Revises: 0005_shopping_preferences
Create Date: 2026-10-31
"""

from alembic import op
import sqlalchemy as sa

revision = "0006_profile_dob_gender_city"
down_revision = "0005_shopping_preferences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_profiles", sa.Column("date_of_birth", sa.String(10), nullable=True))
    op.add_column("user_profiles", sa.Column("gender", sa.String(50), nullable=True))
    op.add_column("user_profiles", sa.Column("city", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("user_profiles", "city")
    op.drop_column("user_profiles", "gender")
    op.drop_column("user_profiles", "date_of_birth")
