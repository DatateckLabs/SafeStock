# SafeStock — Controle de Insumos e Ferramentas

Sistema web interno para controle de estoque de insumos (etiquetas e ribbons) e ferramentas consumíveis de processo, com geração automática de ordens de compra e envio por e-mail.

---

## Arquitetura

```
safestock/
├── auth-service/       Microsserviço de autenticação (porta 8001)
├── backend/            API FastAPI principal (porta 8000)
├── frontend/           React + TypeScript (porta 5173)
├── credentials/        Chave de serviço do BigQuery (não versionada)
└── postgres-init/      Script de criação dos bancos no Docker
```

**Bancos PostgreSQL:**
- `safestock`      → dados da aplicação
- `safestock_auth` → auth-service local

**BigQuery (somente leitura):**
- `bi-datateck.delphus_staging.Parametros_MRP_sem_duplicidade`
- `bi-datateck.Silver.ToolGuard`
- `bi-datateck.delphus_staging.ordens_de_producao_por_mes`
- `bi-datateck.Silver.OcsView`

---

## Pré-requisitos

- Python 3.12+
- Node.js 20+
- PostgreSQL 16 acessível na rede
- Chave de serviço BigQuery (JSON)

---

## Setup — Desenvolvimento local (sem Docker)

### 1. Credenciais BigQuery

Coloque a chave de serviço em:
```
credentials/bigquery_key.json
```
Este diretório está no `.gitignore` — nunca comite a chave.

### 2. Criar os bancos de dados

```sql
CREATE DATABASE safestock;
CREATE DATABASE safestock_auth;
```

### 3. Auth-service

```bash
cd auth-service
cp .env.example .env
# Edite .env: DATABASE_URL, SECRET_KEY
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
alembic upgrade head
python seed.py                # Cria usuário admin/admin123
uvicorn app.main:app --port 8001 --reload
```

### 4. Backend

```bash
cd backend
cp .env.example .env
# Edite .env: DATABASE_URL, SECRET_KEY, AUTH_BASE_URL, GOOGLE_APPLICATION_CREDENTIALS
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python seed.py                # Cria UserProfile admin + parâmetros padrão
uvicorn app.main:app --port 8000 --reload
```

### 5. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### URLs

| Serviço       | URL                                   |
|---------------|---------------------------------------|
| Frontend      | http://localhost:5173                 |
| API Docs      | http://localhost:8000/docs            |
| Auth Docs     | http://localhost:8001/docs            |
| Login local   | http://localhost:8001/safestock/login/ |

**Login padrão:** `admin` / `admin123`

---

## Setup — Docker (produção)

```bash
cp .env.example .env
cp auth-service/.env.example auth-service/.env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edite os .env com as senhas e credenciais reais

docker compose up --build
```

> **Importante:** no `.env` raiz, defina `POSTGRES_PASSWORD`. O script `postgres-init/create-databases.sh` cria o banco `safestock_auth` automaticamente.

---

## Variáveis de ambiente — Backend

| Variável                         | Descrição                                    |
|----------------------------------|----------------------------------------------|
| `DATABASE_URL`                   | PostgreSQL — banco `safestock`               |
| `SECRET_KEY`                     | Segredo JWT (qualquer string longa)          |
| `AUTH_BASE_URL`                  | URL do auth-service                          |
| `ALLOWED_ORIGINS`                | Origins CORS (vírgula-separado)              |
| `GOOGLE_APPLICATION_CREDENTIALS` | Caminho para `credentials/bigquery_key.json` |
| `BQ_PROJECT`                     | Projeto BigQuery (`bi-datateck`)             |
| `SMTP_PASSWORD`                  | Senha SMTP (nunca no banco)                  |

---

## Perfis de acesso

| Perfil    | Permissões                                               |
|-----------|----------------------------------------------------------|
| `admin`   | Acesso total + CRUD de usuários e cadastros              |
| `gestor`  | Visualiza tudo, edita parâmetros, gera OCs               |
| `operador`| Somente visualização (Dashboard)                         |

Gerencie perfis em **Usuários** (apenas admin).

---

## Migração para o Auth Central (Datateck)

Quando o sistema estiver validado:

1. Edite `backend/.env`:
   ```
   AUTH_BASE_URL=https://app.datateck.com.br
   ```

2. Edite `frontend/.env`:
   ```
   VITE_AUTH_BASE_URL=https://app.datateck.com.br
   ```

3. Suba novamente:
   ```bash
   docker compose up --build
   ```

O `auth-service` local pode ser removido do `docker-compose.yml`. Nenhum código precisa ser alterado.
