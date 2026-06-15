import os, sys
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = r'C:\Users\Marcos Schulz\Documents\Claudinho\Controle de Insumos e Ferramentas\gcp-creds.json'
os.environ['BQ_PROJECT'] = 'bi-datateck'
sys.path.insert(0, '.')
try:
    from app.services.bigquery_service import get_ferramentas_consumo
    result = get_ferramentas_consumo(90)
    print('OK, rows:', len(result))
    if result:
        print('Keys:', list(result[0].keys()))
        print('Exemplo:', dict(list(result[0].items())[:5]))
except Exception as e:
    print('ERRO:', type(e).__name__)
    print(str(e)[:600])
