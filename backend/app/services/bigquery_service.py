import os
from google.cloud import bigquery
from google.oauth2 import service_account
from app.core.config import settings

_client: bigquery.Client | None = None


def _get_client() -> bigquery.Client:
    global _client
    if _client is None:
        creds_path = settings.google_application_credentials
        if os.path.exists(creds_path):
            credentials = service_account.Credentials.from_service_account_file(
                creds_path,
                scopes=["https://www.googleapis.com/auth/bigquery"],
            )
            _client = bigquery.Client(project=settings.bq_project, credentials=credentials)
        else:
            _client = bigquery.Client(project=settings.bq_project)
    return _client


def get_insumos(subgrupos: list[str]) -> list[dict]:
    client = _get_client()
    query = """
    SELECT
        CPD,
        DESCRICAO_COMPLEMENTAR,
        SUBGRUPO,
        COALESCE(SAFE_CAST(ESTOQUE_ALMOXARIFADO AS FLOAT64), 0.0) AS ESTOQUE_ALMOXARIFADO,
        COALESCE(SAFE_CAST(LEADTIME_SEMANAS AS FLOAT64), 0.0) AS LEADTIME_SEMANAS,
        COALESCE(SAFE_CAST(MOQ AS FLOAT64), 0.0) AS MOQ,
        COALESCE(SAFE_CAST(MPQ AS FLOAT64), 0.0) AS MPQ,
        UN__MEDIDA,
        RAZAO_SOCIAL_FORNECEDOR,
        COALESCE(SAFE_CAST(QUANTIDADE_PENDENTE_OC AS FLOAT64), 0.0) AS QUANTIDADE_PENDENTE_OC,
        INATIVO
    FROM `bi-datateck.delphus_staging.Parametros_MRP_sem_duplicidade`
    WHERE SUBGRUPO IN UNNEST(@subgrupos)
        AND (INATIVO IS NULL OR INATIVO != 'S')
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ArrayQueryParameter("subgrupos", "STRING", subgrupos)]
    )
    return [dict(row) for row in client.query(query, job_config=job_config).result()]


def get_parametros_mrp_por_cpds(cpds: list[str]) -> list[dict]:
    if not cpds:
        return []
    client = _get_client()
    query = """
    SELECT
        CPD,
        DESCRICAO_COMPLEMENTAR,
        COALESCE(SAFE_CAST(ESTOQUE_ALMOXARIFADO AS FLOAT64), 0.0) AS ESTOQUE_ALMOXARIFADO,
        COALESCE(SAFE_CAST(LEADTIME_SEMANAS AS FLOAT64), 0.0) AS LEADTIME_SEMANAS,
        COALESCE(SAFE_CAST(MOQ AS FLOAT64), 0.0) AS MOQ,
        COALESCE(SAFE_CAST(MPQ AS FLOAT64), 0.0) AS MPQ,
        UN__MEDIDA,
        RAZAO_SOCIAL_FORNECEDOR,
        COALESCE(SAFE_CAST(QUANTIDADE_PENDENTE_OC AS FLOAT64), 0.0) AS QUANTIDADE_PENDENTE_OC
    FROM `bi-datateck.delphus_staging.Parametros_MRP_sem_duplicidade`
    WHERE CPD IN UNNEST(@cpds)
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ArrayQueryParameter("cpds", "STRING", cpds)]
    )
    return [dict(row) for row in client.query(query, job_config=job_config).result()]


def get_ferramentas_consumo(janela_dias: int) -> list[dict]:
    client = _get_client()
    # Demanda Produzida (histórico) = PRODUZIDO_OP × QUANTIDADE_MP_COMPOSICAO
    # Demanda Pendente  (futuro)    = (QTD_OP - PRODUZIDO - CANCELADO) × QUANTIDADE_MP_COMPOSICAO
    # Consumo Mensal = (produzido_mp + pendente_mp) / (janela_dias / 30)
    query = """
    WITH ops AS (
        SELECT
            CAST(CAST(CPD_MATERIA_PRIMA AS INT64) AS STRING) AS CPD_MATERIA_PRIMA,
            SUM(
                COALESCE(PRODUZIDO_OP, 0) * COALESCE(QUANTIDADE_MP_COMPOSICAO, 0)
            ) AS produzido_mp,
            SUM(
                GREATEST(
                    COALESCE(QUANTIDADE_OP, 0)
                    - COALESCE(PRODUZIDO_OP, 0)
                    - COALESCE(CANCELADO_OP, 0),
                    0
                ) * COALESCE(QUANTIDADE_MP_COMPOSICAO, 0)
            ) AS pendente_mp
        FROM `bi-datateck.delphus_staging.ordens_de_producao_por_mes`
        WHERE DATE(SAFE_CAST(ENTREGA_PEDIDO AS TIMESTAMP)) >= DATE_SUB(CURRENT_DATE(), INTERVAL @janela_dias DAY)
        GROUP BY CPD_MATERIA_PRIMA
    )
    SELECT
        tg.CPD_FERRAMENTA,
        tg.FERRAMENTA,
        ops.produzido_mp,
        ops.pendente_mp
    FROM ops
    JOIN `bi-datateck.Silver.ToolGuard` tg ON tg.CPD = ops.CPD_MATERIA_PRIMA
    WHERE tg.CPD_FERRAMENTA IS NOT NULL
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("janela_dias", "INT64", janela_dias)]
    )
    return [dict(row) for row in client.query(query, job_config=job_config).result()]


def get_ocs_abertas_por_cpds(cpds: list[str]) -> dict[str, float]:
    """Retorna {cpd: quantidade_em_aberto} consultando OcsView."""
    if not cpds:
        return {}
    client = _get_client()
    query = """
    SELECT
        COALESCE(
            CAST(CAST(SAFE_CAST(CPD AS FLOAT64) AS INT64) AS STRING),
            CAST(CPD AS STRING)
        ) AS cpd_norm,
        SUM(
            COALESCE(SAFE_CAST(QUANTIDADE_OC AS FLOAT64), 0.0) -
            COALESCE(SAFE_CAST(QUANTIDADE_RECEBIDA AS FLOAT64), 0.0)
        ) AS ocs_abertas
    FROM `bi-datateck.Silver.OcsView`
    WHERE COALESCE(
            CAST(CAST(SAFE_CAST(CPD AS FLOAT64) AS INT64) AS STRING),
            CAST(CPD AS STRING)
          ) IN UNNEST(@cpds)
        AND COALESCE(SAFE_CAST(QUANTIDADE_RECEBIDA AS FLOAT64), 0.0)
            < COALESCE(SAFE_CAST(QUANTIDADE_OC AS FLOAT64), 0.0)
    GROUP BY cpd_norm
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ArrayQueryParameter("cpds", "STRING", cpds)]
    )
    return {
        str(row["cpd_norm"]): float(row["ocs_abertas"] or 0)
        for row in client.query(query, job_config=job_config).result()
    }


def get_ferramentas_drilldown(cpd_ferramenta: str, janela_dias: int) -> list[dict]:
    """Retorna terminais que consomem a ferramenta, com OPs pendentes e consumo mensal."""
    client = _get_client()
    query = """
    WITH ops AS (
        SELECT
            CAST(CAST(CPD_MATERIA_PRIMA AS INT64) AS STRING) AS CPD_MATERIA_PRIMA,
            SUM(
                COALESCE(PRODUZIDO_OP, 0) * COALESCE(QUANTIDADE_MP_COMPOSICAO, 0)
            ) AS produzido_mp,
            SUM(
                GREATEST(
                    COALESCE(QUANTIDADE_OP, 0)
                    - COALESCE(PRODUZIDO_OP, 0)
                    - COALESCE(CANCELADO_OP, 0),
                    0
                ) * COALESCE(QUANTIDADE_MP_COMPOSICAO, 0)
            ) AS pendente_mp
        FROM `bi-datateck.delphus_staging.ordens_de_producao_por_mes`
        WHERE DATE(SAFE_CAST(ENTREGA_PEDIDO AS TIMESTAMP)) >= DATE_SUB(CURRENT_DATE(), INTERVAL @janela_dias DAY)
        GROUP BY CPD_MATERIA_PRIMA
    )
    SELECT
        ops.CPD_MATERIA_PRIMA,
        mrp.DESCRICAO_COMPLEMENTAR,
        ops.pendente_mp AS ops_pendentes,
        SAFE_DIVIDE(ops.produzido_mp, CAST(@janela_dias AS FLOAT64) / 30.0) AS consumo_mensal_ferramenta
    FROM ops
    JOIN `bi-datateck.Silver.ToolGuard` tg
        ON tg.CPD = ops.CPD_MATERIA_PRIMA
        AND tg.CPD_FERRAMENTA = @cpd_ferramenta
    LEFT JOIN `bi-datateck.delphus_staging.Parametros_MRP_sem_duplicidade` mrp
        ON mrp.CPD = ops.CPD_MATERIA_PRIMA
    WHERE ops.pendente_mp > 0
    ORDER BY ops.pendente_mp DESC
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("janela_dias", "INT64", janela_dias),
            bigquery.ScalarQueryParameter("cpd_ferramenta", "STRING", cpd_ferramenta),
        ]
    )
    return [dict(row) for row in client.query(query, job_config=job_config).result()]


def get_ocs_view() -> list[dict]:
    client = _get_client()
    query = """
    SELECT
        CPD,
        OC,
        SUBGRUPO,
        QUANTIDADE_OC,
        QUANTIDADE_RECEBIDA,
        DATA_GERADA_OC,
        DATA_DE_ENTREGA_DATATECK,
        FINALIDADE_DA_OC,
        RAZAO_SOCIAL_FORNECEDOR,
        USUARIO_QUE_GEROU_A_OC
    FROM `bi-datateck.Silver.OcsView`
    ORDER BY DATA_GERADA_OC DESC
    LIMIT 500
    """
    return [dict(row) for row in _get_client().query(query).result()]
