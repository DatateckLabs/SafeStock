"""config fornecedor e ferramenta

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-15 00:00:00.000000
"""
import sqlalchemy as sa
from alembic import op

revision     = "0002"
down_revision = "0001"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.create_table(
        "config_fornecedores",
        sa.Column("id",              sa.Integer(),     nullable=False),
        sa.Column("razao_social",    sa.String(255),   nullable=False),
        sa.Column("leadtime_meses",  sa.Float(),       nullable=False, server_default="2.0"),
        sa.Column("cobertura_meses", sa.Float(),       nullable=False, server_default="2.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("razao_social"),
    )
    op.create_index("ix_config_fornecedores_id",           "config_fornecedores", ["id"])
    op.create_index("ix_config_fornecedores_razao_social", "config_fornecedores", ["razao_social"])

    op.create_table(
        "config_ferramentas",
        sa.Column("id",                sa.Integer(),   nullable=False),
        sa.Column("cpd_ferramenta",    sa.String(50),  nullable=False),
        sa.Column("aplicacoes",        sa.Integer(),   nullable=False, server_default="80000"),
        sa.Column("leadtime_override", sa.Float(),     nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cpd_ferramenta"),
    )
    op.create_index("ix_config_ferramentas_id",             "config_ferramentas", ["id"])
    op.create_index("ix_config_ferramentas_cpd_ferramenta", "config_ferramentas", ["cpd_ferramenta"])


def downgrade() -> None:
    op.drop_table("config_ferramentas")
    op.drop_table("config_fornecedores")
