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


def get_estoques_minimos_bq() -> dict[str, float]:
    """Retorna {cpd_str: estoque_minimo} da tabela Silver.EstoqueMinimo."""
    client = _get_client()
    query = """
    SELECT
        CAST(CPD AS STRING) AS cpd,
        COALESCE(SAFE_CAST(ESTOQUE_MINIMO AS FLOAT64), 0.0) AS estoque_minimo
    FROM `bi-datateck.Silver.EstoqueMinimo`
    WHERE CPD IS NOT NULL
    """
    return {
        str(row["cpd"]): float(row["estoque_minimo"])
        for row in client.query(query).result()
    }


def get_insumos(subgrupos: list[str]) -> list[dict]:
    client = _get_client()
    query = """
    SELECT
        CPD,
        DESCRICAO_COMPLEMENTAR,
        CODIGO_FABRICANTE,
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


def get_razoes_sociais_mrp() -> list[str]:
    """Retorna lista de razões sociais distintas do MRP para autocomplete."""
    client = _get_client()
    query = """
    SELECT DISTINCT RAZAO_SOCIAL_FORNECEDOR
    FROM `bi-datateck.delphus_staging.Parametros_MRP_sem_duplicidade`
    WHERE RAZAO_SOCIAL_FORNECEDOR IS NOT NULL AND RAZAO_SOCIAL_FORNECEDOR != ''
    ORDER BY RAZAO_SOCIAL_FORNECEDOR
    """
    return [str(row["RAZAO_SOCIAL_FORNECEDOR"]) for row in client.query(query).result()]


def get_parametros_mrp_por_cpds(cpds: list[str]) -> list[dict]:
    if not cpds:
        return []
    client = _get_client()
    # Normaliza o CPD do MRP (pode estar como "30214.0") para inteiro-string "30214",
    # igual ao que o ToolGuard retorna após o CAST(CAST(... AS INT64) AS STRING).
    query = """
    SELECT
        CAST(CAST(SAFE_CAST(CPD AS FLOAT64) AS INT64) AS STRING) AS CPD,
        DESCRICAO_COMPLEMENTAR,
        CODIGO_FABRICANTE,
        COALESCE(SAFE_CAST(ESTOQUE_ALMOXARIFADO AS FLOAT64), 0.0) AS ESTOQUE_ALMOXARIFADO,
        COALESCE(SAFE_CAST(LEADTIME_SEMANAS AS FLOAT64), 0.0) AS LEADTIME_SEMANAS,
        COALESCE(SAFE_CAST(MOQ AS FLOAT64), 0.0) AS MOQ,
        COALESCE(SAFE_CAST(MPQ AS FLOAT64), 0.0) AS MPQ,
        UN__MEDIDA,
        RAZAO_SOCIAL_FORNECEDOR,
        COALESCE(SAFE_CAST(QUANTIDADE_PENDENTE_OC AS FLOAT64), 0.0) AS QUANTIDADE_PENDENTE_OC
    FROM `bi-datateck.delphus_staging.Parametros_MRP_sem_duplicidade`
    WHERE CAST(CAST(SAFE_CAST(CPD AS FLOAT64) AS INT64) AS STRING) IN UNNEST(@cpds)
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ArrayQueryParameter("cpds", "STRING", cpds)]
    )
    return [dict(row) for row in client.query(query, job_config=job_config).result()]


def get_ferramentas_consumo() -> list[dict]:
    client = _get_client()
    # Produzido: soma histórica total; Pendente: saldo de OPs não encerradas
    # Divisores calculados no BigQuery:
    #   meses_produzido = meses distintos com produção > 0 (nível ferramenta)
    #   meses_pendente  = meses distintos com pendente > 0 (nível ferramenta)
    #   meses_total     = meses com qualquer movimentação (nível ferramenta)
    query = """
    WITH ops_monthly AS (
        SELECT
            CAST(CAST(CPD_MATERIA_PRIMA AS INT64) AS STRING)  AS CPD_MATERIA_PRIMA,
            FORMAT_DATE('%Y-%m', DATE(SAFE_CAST(ENTREGA_PEDIDO AS TIMESTAMP))) AS mes_ano,
            SUM(COALESCE(PRODUZIDO_OP, 0) * COALESCE(QUANTIDADE_MP_COMPOSICAO, 0)) AS produzido_mes,
            SUM(
                GREATEST(
                    COALESCE(QUANTIDADE_OP, 0)
                    - COALESCE(PRODUZIDO_OP, 0)
                    - COALESCE(CANCELADO_OP, 0),
                    0
                ) * COALESCE(QUANTIDADE_MP_COMPOSICAO, 0)
            ) AS pendente_mes
        FROM `bi-datateck.delphus_staging.ordens_de_producao_por_mes`
        WHERE TIPO_PEDIDO != 'SIMULAÇÃO DE PROJETOS'
        GROUP BY CPD_MATERIA_PRIMA, mes_ano
    ),
    tg_base AS (
        SELECT CPD, CPD_FERRAMENTA, ANY_VALUE(FERRAMENTA) AS FERRAMENTA
        FROM `bi-datateck.Silver.ToolGuard`
        WHERE CPD_FERRAMENTA IS NOT NULL
        GROUP BY CPD, CPD_FERRAMENTA
    ),
    ops_terminal AS (
        SELECT
            CPD_MATERIA_PRIMA,
            SUM(produzido_mes)                              AS produzido_mp,
            SUM(pendente_mes)                               AS pendente_mp,
            COUNTIF(produzido_mes > 0)                      AS meses_produzido,
            COUNTIF(pendente_mes > 0)                       AS meses_pendente,
            COUNTIF(produzido_mes > 0 OR pendente_mes > 0) AS meses_total
        FROM ops_monthly
        GROUP BY CPD_MATERIA_PRIMA
    )
    SELECT
        tg.CPD_FERRAMENTA,
        tg.FERRAMENTA,
        ot.produzido_mp,
        ot.pendente_mp,
        ot.meses_produzido,
        ot.meses_pendente,
        ot.meses_total
    FROM ops_terminal ot
    JOIN tg_base tg ON tg.CPD = ot.CPD_MATERIA_PRIMA
    """
    return [dict(row) for row in client.query(query).result()]


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
            GREATEST(
                COALESCE(SAFE_CAST(QUANTIDADE_OC AS FLOAT64), 0.0)
                - COALESCE(SAFE_CAST(QUANTIDADE_RECEBIDA AS FLOAT64), 0.0)
                - COALESCE(SAFE_CAST(QUANTIDADE_CANCELADA AS FLOAT64), 0.0),
                0.0
            )
        ) AS ocs_abertas
    FROM `bi-datateck.Silver.OcsView`
    WHERE COALESCE(
            CAST(CAST(SAFE_CAST(CPD AS FLOAT64) AS INT64) AS STRING),
            CAST(CPD AS STRING)
          ) IN UNNEST(@cpds)
        AND (
            COALESCE(SAFE_CAST(QUANTIDADE_RECEBIDA AS FLOAT64), 0.0)
            + COALESCE(SAFE_CAST(QUANTIDADE_CANCELADA AS FLOAT64), 0.0)
        ) < COALESCE(SAFE_CAST(QUANTIDADE_OC AS FLOAT64), 0.0)
        AND DATA_PRIMEIRO_ENVIO_OC IS NOT NULL
    GROUP BY cpd_norm
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ArrayQueryParameter("cpds", "STRING", cpds)]
    )
    return {
        str(row["cpd_norm"]): float(row["ocs_abertas"] or 0)
        for row in client.query(query, job_config=job_config).result()
    }


def get_ferramentas_drilldown(cpd_ferramenta: str) -> list[dict]:
    """Retorna terminais que consomem a ferramenta, com contagem real de meses."""
    client = _get_client()
    query = """
    WITH ops_monthly AS (
        SELECT
            CAST(CAST(CPD_MATERIA_PRIMA AS INT64) AS STRING) AS CPD_MATERIA_PRIMA,
            FORMAT_DATE('%Y-%m', DATE(SAFE_CAST(ENTREGA_PEDIDO AS TIMESTAMP))) AS mes_ano,
            SUM(COALESCE(PRODUZIDO_OP, 0) * COALESCE(QUANTIDADE_MP_COMPOSICAO, 0)) AS produzido_mes,
            SUM(
                GREATEST(
                    COALESCE(QUANTIDADE_OP, 0)
                    - COALESCE(PRODUZIDO_OP, 0)
                    - COALESCE(CANCELADO_OP, 0),
                    0
                ) * COALESCE(QUANTIDADE_MP_COMPOSICAO, 0)
            ) AS pendente_mes
        FROM `bi-datateck.delphus_staging.ordens_de_producao_por_mes`
        WHERE TIPO_PEDIDO != 'SIMULAÇÃO DE PROJETOS'
        GROUP BY CPD_MATERIA_PRIMA, mes_ano
    ),
    ops AS (
        SELECT
            CPD_MATERIA_PRIMA,
            SUM(produzido_mes)                               AS produzido_mp,
            SUM(pendente_mes)                                AS pendente_mp,
            COUNTIF(produzido_mes > 0)                       AS meses_produzido,
            COUNTIF(pendente_mes > 0)                        AS meses_pendente,
            COUNTIF(produzido_mes > 0 OR pendente_mes > 0)  AS meses_total
        FROM ops_monthly
        GROUP BY CPD_MATERIA_PRIMA
    )
    SELECT DISTINCT
        ops.CPD_MATERIA_PRIMA,
        mrp.DESCRICAO_COMPLEMENTAR,
        mrp.CODIGO_FABRICANTE,
        ops.pendente_mp AS ops_pendentes,
        ops.produzido_mp,
        ops.meses_produzido,
        ops.meses_pendente,
        ops.meses_total
    FROM ops
    JOIN (SELECT DISTINCT CPD, CPD_FERRAMENTA FROM `bi-datateck.Silver.ToolGuard`) tg
        ON tg.CPD = ops.CPD_MATERIA_PRIMA
        AND tg.CPD_FERRAMENTA = @cpd_ferramenta
    LEFT JOIN `bi-datateck.delphus_staging.Parametros_MRP_sem_duplicidade` mrp
        ON CAST(CAST(SAFE_CAST(mrp.CPD AS FLOAT64) AS INT64) AS STRING) = ops.CPD_MATERIA_PRIMA
    WHERE ops.produzido_mp > 0 OR ops.pendente_mp > 0
    ORDER BY
        SAFE_DIVIDE(ops.produzido_mp + ops.pendente_mp,
                    NULLIF(ops.meses_total, 0)) DESC
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("cpd_ferramenta", "STRING", cpd_ferramenta),
        ]
    )
    return [dict(row) for row in client.query(query, job_config=job_config).result()]


def get_consumo_por_mes(cpd_ferramenta: str) -> list[dict]:
    client = _get_client()
    query = """
    WITH tg AS (
        SELECT DISTINCT CAST(CAST(CPD AS INT64) AS STRING) AS cpd_norm
        FROM `bi-datateck.Silver.ToolGuard`
        WHERE CPD_FERRAMENTA = @cpd_ferramenta
    )
    SELECT
        FORMAT_DATE('%Y-%m', DATE(SAFE_CAST(ENTREGA_PEDIDO AS TIMESTAMP))) AS mes_ano,
        SUM(COALESCE(PRODUZIDO_OP, 0) * COALESCE(QUANTIDADE_MP_COMPOSICAO, 0)) AS produzido,
        SUM(
            GREATEST(
                COALESCE(QUANTIDADE_OP, 0)
                - COALESCE(PRODUZIDO_OP, 0)
                - COALESCE(CANCELADO_OP, 0),
                0
            ) * COALESCE(QUANTIDADE_MP_COMPOSICAO, 0)
        ) AS pendente
    FROM `bi-datateck.delphus_staging.ordens_de_producao_por_mes` op
    JOIN tg ON CAST(CAST(op.CPD_MATERIA_PRIMA AS INT64) AS STRING) = tg.cpd_norm
    WHERE op.TIPO_PEDIDO != 'SIMULAÇÃO DE PROJETOS'
    GROUP BY mes_ano
    ORDER BY mes_ano
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("cpd_ferramenta", "STRING", cpd_ferramenta),
    ])
    return [dict(row) for row in client.query(query, job_config=job_config).result()]


def get_consumo_por_mes_terminal(cpd_materia_prima: str) -> list[dict]:
    client = _get_client()
    query = """
    SELECT
        FORMAT_DATE('%Y-%m', DATE(SAFE_CAST(ENTREGA_PEDIDO AS TIMESTAMP))) AS mes_ano,
        SUM(COALESCE(PRODUZIDO_OP, 0) * COALESCE(QUANTIDADE_MP_COMPOSICAO, 0)) AS produzido,
        SUM(
            GREATEST(
                COALESCE(QUANTIDADE_OP, 0)
                - COALESCE(PRODUZIDO_OP, 0)
                - COALESCE(CANCELADO_OP, 0),
                0
            ) * COALESCE(QUANTIDADE_MP_COMPOSICAO, 0)
        ) AS pendente
    FROM `bi-datateck.delphus_staging.ordens_de_producao_por_mes`
    WHERE CAST(CAST(CPD_MATERIA_PRIMA AS INT64) AS STRING) = @cpd_terminal
      AND TIPO_PEDIDO != 'SIMULAÇÃO DE PROJETOS'
    GROUP BY mes_ano
    ORDER BY mes_ano
    """
    job_config = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("cpd_terminal", "STRING", cpd_materia_prima),
    ])
    return [dict(row) for row in client.query(query, job_config=job_config).result()]


def get_sem_ferramenta(subgrupos_excluir: list[str] | None = None) -> list[dict]:
    """Materiais com consumo > 0 que não possuem vínculo na ToolGuard."""
    client = _get_client()
    excluir = subgrupos_excluir or []
    query = """
    WITH ops_monthly AS (
        SELECT
            CAST(CAST(CPD_MATERIA_PRIMA AS INT64) AS STRING) AS CPD_MATERIA_PRIMA,
            FORMAT_DATE('%Y-%m', DATE(SAFE_CAST(ENTREGA_PEDIDO AS TIMESTAMP))) AS mes_ano,
            SUM(COALESCE(PRODUZIDO_OP, 0) * COALESCE(QUANTIDADE_MP_COMPOSICAO, 0)) AS produzido_mes,
            SUM(
                GREATEST(
                    COALESCE(QUANTIDADE_OP, 0)
                    - COALESCE(PRODUZIDO_OP, 0)
                    - COALESCE(CANCELADO_OP, 0),
                    0
                ) * COALESCE(QUANTIDADE_MP_COMPOSICAO, 0)
            ) AS pendente_mes
        FROM `bi-datateck.delphus_staging.ordens_de_producao_por_mes`
        WHERE TIPO_PEDIDO != 'SIMULAÇÃO DE PROJETOS'
        GROUP BY CPD_MATERIA_PRIMA, mes_ano
    ),
    ops AS (
        SELECT
            CPD_MATERIA_PRIMA,
            SUM(produzido_mes)                              AS produzido_total,
            SUM(pendente_mes)                               AS pendente_total,
            COUNTIF(produzido_mes > 0)                      AS meses_produzido,
            COUNTIF(pendente_mes > 0)                       AS meses_pendente,
            COUNTIF(produzido_mes > 0 OR pendente_mes > 0) AS meses_total
        FROM ops_monthly
        GROUP BY CPD_MATERIA_PRIMA
    ),
    em_ferramenta AS (
        SELECT DISTINCT CAST(CAST(CPD AS INT64) AS STRING) AS CPD
        FROM `bi-datateck.Silver.ToolGuard`
        WHERE CPD IS NOT NULL AND CPD_FERRAMENTA IS NOT NULL
    )
    SELECT
        ops.CPD_MATERIA_PRIMA,
        mrp.CODIGO_FABRICANTE,
        mrp.SUBGRUPO,
        ops.produzido_total,
        ops.pendente_total,
        ops.meses_produzido,
        ops.meses_pendente,
        ops.meses_total
    FROM ops
    LEFT JOIN em_ferramenta ef ON ef.CPD = ops.CPD_MATERIA_PRIMA
    LEFT JOIN `bi-datateck.delphus_staging.Parametros_MRP_sem_duplicidade` mrp
        ON CAST(CAST(SAFE_CAST(mrp.CPD AS FLOAT64) AS INT64) AS STRING) = ops.CPD_MATERIA_PRIMA
    WHERE ef.CPD IS NULL
      AND (ops.produzido_total + ops.pendente_total) > 0
      AND (ARRAY_LENGTH(@subgrupos_excluir) = 0
           OR UPPER(COALESCE(mrp.SUBGRUPO, '')) NOT IN UNNEST(@subgrupos_excluir))
    ORDER BY
        SAFE_DIVIDE(ops.produzido_total + ops.pendente_total, NULLIF(ops.meses_total, 0)) DESC
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ArrayQueryParameter("subgrupos_excluir", "STRING", excluir),
        ]
    )
    return [dict(row) for row in client.query(query, job_config=job_config).result()]


def get_fornecedor_ids(razoes_sociais: list[str]) -> dict[str, int]:
    """Retorna {razao_social_upper: id_delphus} via cadastro_empresas."""
    if not razoes_sociais:
        return {}
    client = _get_client()
    nomes_upper = [n.strip().upper() for n in razoes_sociais if n.strip()]
    query = """
    SELECT
        CAST(id AS INT64) AS id,
        UPPER(TRIM(name))         AS name_upper,
        UPPER(TRIM(trading_name)) AS trading_upper
    FROM `bi-datateck.delphus_staging.cadastro_empresas`
    WHERE UPPER(TRIM(name))         IN UNNEST(@nomes)
       OR UPPER(TRIM(trading_name)) IN UNNEST(@nomes)
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ArrayQueryParameter("nomes", "STRING", nomes_upper)]
    )
    result: dict[str, int] = {}
    for row in client.query(query, job_config=job_config).result():
        id_ = int(row["id"])
        if row["name_upper"] and row["name_upper"] in nomes_upper:
            result[row["name_upper"]] = id_
        if row["trading_upper"] and row["trading_upper"] in nomes_upper:
            result[row["trading_upper"]] = id_
    return result


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


def get_precos_por_cpds(cpds: list[str]) -> dict[str, dict]:
    """Retorna {cpd: {preco: float, moeda: str}} para cálculo de valor total da OC."""
    if not cpds:
        return {}
    client = _get_client()
    query = """
    SELECT
        CAST(CAST(SAFE_CAST(CPD AS FLOAT64) AS INT64) AS STRING) AS cpd_norm,
        COALESCE(SAFE_CAST(PRECO_UNITARIO AS FLOAT64), 0.0) AS preco,
        COALESCE(MOEDA, 'BRL') AS moeda
    FROM `bi-datateck.delphus_staging.Parametros_MRP_sem_duplicidade`
    WHERE CAST(CAST(SAFE_CAST(CPD AS FLOAT64) AS INT64) AS STRING) IN UNNEST(@cpds)
        AND PRECO_UNITARIO IS NOT NULL
        AND SAFE_CAST(PRECO_UNITARIO AS FLOAT64) > 0
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ArrayQueryParameter("cpds", "STRING", cpds)]
    )
    result = {}
    for row in client.query(query, job_config=job_config).result():
        cpd = str(row["cpd_norm"])
        result[cpd] = {
            "preco": float(row["preco"]),
            "moeda": str(row["moeda"]).upper(),
        }
    return result
