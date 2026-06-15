import os, sys
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = r'C:\Users\Marcos Schulz\Documents\Claudinho\Controle de Insumos e Ferramentas\gcp-creds.json'
os.environ['BQ_PROJECT'] = 'bi-datateck'
sys.path.insert(0, '.')
from app.services.bigquery_service import _get_client
client = _get_client()

print("=== Teste do SAFE_CAST de ENTREGA_PEDIDO ===")
q1 = """
SELECT
    ENTREGA_PEDIDO,
    SAFE_CAST(ENTREGA_PEDIDO AS DATE) as como_date,
    SAFE_CAST(ENTREGA_PEDIDO AS TIMESTAMP) as como_ts,
    DATE(SAFE_CAST(ENTREGA_PEDIDO AS TIMESTAMP)) as date_de_ts
FROM `bi-datateck.delphus_staging.ordens_de_producao_por_mes`
WHERE ENTREGA_PEDIDO IS NOT NULL
LIMIT 3
"""
for r in client.query(q1).result():
    print(dict(r))

print("\n=== Rows com ENTREGA_PEDIDO >= hoje-90d (sem JOIN) ===")
q2 = """
SELECT COUNT(*) as total
FROM `bi-datateck.delphus_staging.ordens_de_producao_por_mes`
WHERE SAFE_CAST(PRODUZIDO_OP AS FLOAT64) > 0
  AND DATE(SAFE_CAST(ENTREGA_PEDIDO AS TIMESTAMP)) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
"""
for r in client.query(q2).result():
    print(f"  rows sem JOIN: {r[0]}")

print("\n=== Com JOIN ToolGuard ===")
q3 = """
WITH ops AS (
  SELECT
    CAST(CAST(CPD_MATERIA_PRIMA AS INT64) AS STRING) AS CPD_MATERIA_PRIMA,
    CELULA_PRODUCAO,
    SUM(SAFE_CAST(PRODUZIDO_OP AS FLOAT64)) AS total_produzido
  FROM `bi-datateck.delphus_staging.ordens_de_producao_por_mes`
  WHERE SAFE_CAST(PRODUZIDO_OP AS FLOAT64) > 0
    AND DATE(SAFE_CAST(ENTREGA_PEDIDO AS TIMESTAMP)) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  GROUP BY CPD_MATERIA_PRIMA, CELULA_PRODUCAO
)
SELECT COUNT(*) as total
FROM ops
JOIN `bi-datateck.Silver.ToolGuard` tg ON tg.CPD = ops.CPD_MATERIA_PRIMA
WHERE tg.CPD_FERRAMENTA IS NOT NULL
"""
for r in client.query(q3).result():
    print(f"  rows com JOIN: {r[0]}")
