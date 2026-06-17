"""disparo_item_log add estoque_atual

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-17 00:00:00.000000
"""
import sqlalchemy as sa
from alembic import op

revision     = "0003"
down_revision = "0002"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.add_column("disparos_item_log", sa.Column("estoque_atual", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("disparos_item_log", "estoque_atual")
