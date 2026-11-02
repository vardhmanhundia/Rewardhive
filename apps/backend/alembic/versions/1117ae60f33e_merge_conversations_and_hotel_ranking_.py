"""merge conversations and hotel_ranking branches

Revision ID: 1117ae60f33e
Revises: 0006_conversations, 0007_add_hotel_ranking
Create Date: 2026-11-01 17:23:19.018899
"""
from alembic import op
import sqlalchemy as sa


revision = '1117ae60f33e'
down_revision = ('0006_conversations', '0007_add_hotel_ranking')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
