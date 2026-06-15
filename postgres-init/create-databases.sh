#!/bin/bash
set -e

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "
  SELECT 'CREATE DATABASE ${POSTGRES_DB}_auth'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${POSTGRES_DB}_auth')\gexec"

echo "Database ${POSTGRES_DB}_auth criado (ou ja existia)."
