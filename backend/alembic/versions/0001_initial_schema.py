"""initial schema

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(100), nullable=False, unique=True),
        sa.Column("role", sa.String(20), nullable=False, server_default="operador"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_user_profiles_username", "user_profiles", ["username"])

    op.create_table(
        "parametros_globais",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("chave", sa.String(100), nullable=False, unique=True),
        sa.Column("valor", sa.Text(), nullable=False, server_default=""),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_parametros_globais_chave", "parametros_globais", ["chave"])

    op.create_table(
        "estoques_minimos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cpd", sa.String(50), nullable=False, unique=True),
        sa.Column("estoque_minimo", sa.Float(), nullable=False, server_default="0"),
        sa.Column("estoque_maximo", sa.Float(), nullable=False, server_default="0"),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_estoques_minimos_cpd", "estoques_minimos", ["cpd"])

    op.create_table(
        "criticidades_ferramentas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cpd_ferramenta", sa.String(50), nullable=False, unique=True),
        sa.Column("criticidade", sa.String(10), nullable=False, server_default="media"),
        sa.Column("janela_consumo_dias", sa.Integer(), nullable=True),
        sa.Column("threshold_inatividade", sa.Float(), nullable=True),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_criticidades_ferramentas_cpd", "criticidades_ferramentas", ["cpd_ferramenta"])

    op.create_table(
        "ordens_compra_geradas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("numero_oc_interno", sa.String(50), nullable=False, unique=True),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="gerada"),
        sa.Column("arquivo_path", sa.Text(), nullable=True),
        sa.Column("email_destinatario", sa.Text(), nullable=True),
        sa.Column("erro_msg", sa.Text(), nullable=True),
        sa.Column("gerado_por_username", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("enviado_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "itens_ordens_compra_geradas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ordem_compra_id", sa.Integer(), sa.ForeignKey("ordens_compra_geradas.id"), nullable=False),
        sa.Column("cpd", sa.String(50), nullable=False),
        sa.Column("descricao_item", sa.Text(), nullable=True),
        sa.Column("qtd_solicitada", sa.Float(), nullable=False),
        sa.Column("unidade", sa.String(20), nullable=True),
        sa.Column("razao_social_fornecedor", sa.Text(), nullable=True),
        sa.Column("estoque_atual", sa.Float(), nullable=True),
        sa.Column("estoque_minimo_calculado", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("itens_ordens_compra_geradas")
    op.drop_table("ordens_compra_geradas")
    op.drop_table("criticidades_ferramentas")
    op.drop_table("estoques_minimos")
    op.drop_table("parametros_globais")
    op.drop_table("user_profiles")
