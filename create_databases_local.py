"""Cria bancos safestock e safestock_auth no PostgreSQL local."""
import psycopg2

conn = psycopg2.connect(
    host="127.0.0.1", port=5432,
    user="postgres", password="postgres",
    database="postgres"
)
conn.autocommit = True
cur = conn.cursor()

for db in ["safestock", "safestock_auth"]:
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db,))
    if cur.fetchone():
        print(f"[ok] banco '{db}' ja existe")
    else:
        cur.execute(f"CREATE DATABASE {db}")
        print(f"[criado] banco '{db}'")

conn.close()
print("Pronto.")
