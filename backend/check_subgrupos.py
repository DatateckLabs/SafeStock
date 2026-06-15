import os, sys
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = r'C:\Users\Marcos Schulz\Documents\Claudinho\Controle de Insumos e Ferramentas\gcp-creds.json'
os.environ['BQ_PROJECT'] = 'bi-datateck'
sys.path.insert(0, '.')
from app.services.bigquery_service import _get_client
client = _get_client()
q = "SELECT DISTINCT SUBGRUPO FROM `bi-datateck.delphus_staging.Parametros_MRP_sem_duplicidade` WHERE LOWER(SUBGRUPO) LIKE '%ribbon%' OR LOWER(SUBGRUPO) LIKE '%etiqueta%' OR LOWER(SUBGRUPO) LIKE '%label%'"
rows = list(client.query(q).result())
print("Subgrupos com etiqueta/ribbon/label:")
for r in rows:
    print(" ->", r[0])
