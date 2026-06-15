"""
Execute este script UMA VEZ para criar os bancos safestock e safestock_auth.
Rode: python create_databases.py
"""
import psycopg2

conn = psycopg2.connect(
    host="217.196.63.99", port=32771,
    user="datateck", password="w1jj3oabFKfCd77YKA8LMuduzwlMmnN0",
    database="postgres"
)
conn.autocommit = True
cur = conn.cursor()

for db in ["safestock", "safestock_auth"]:
    cur.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db}'")
    if cur.fetchone():
        print(f"[ok] banco '{db}' ja existe")
    else:
        cur.execute(f"CREATE DATABASE {db}")
        print(f"[criado] banco '{db}'")

conn.close()
print("Pronto.")
