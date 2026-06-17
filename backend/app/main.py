from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.router import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Garante tabela de log existente (idempotente)
    from app.db.base import Base
    from app.db.session import engine
    from sqlalchemy import text
    import app.models.disparo_log       # noqa: F401
    import app.models.disparo_item_log  # noqa: F401
    Base.metadata.create_all(bind=engine, checkfirst=True)
    # Adiciona colunas novas sem quebrar bancos existentes
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE disparos_log ADD COLUMN IF NOT EXISTS modulo VARCHAR(20) DEFAULT 'insumos'"
        ))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS disparos_item_log (
                id                      SERIAL PRIMARY KEY,
                disparo_log_id          INTEGER NOT NULL REFERENCES disparos_log(id),
                modulo                  VARCHAR(20) NOT NULL,
                cpd                     VARCHAR(50) NOT NULL,
                descricao               VARCHAR(500),
                razao_social_fornecedor VARCHAR(200),
                qtd_sugerida            FLOAT NOT NULL DEFAULT 0,
                preco_unitario          FLOAT DEFAULT 0,
                moeda                   VARCHAR(10) DEFAULT 'BRL',
                valor_brl               FLOAT DEFAULT 0,
                ocs_abertas             FLOAT DEFAULT 0,
                created_at              TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        conn.commit()

    # Agenda disparo semanal via APScheduler
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger
    from app.db.session import SessionLocal
    from app.models.parametro_global import ParametroGlobal

    def _get_p(chave: str, default: str) -> str:
        db = SessionLocal()
        try:
            obj = db.query(ParametroGlobal).filter(ParametroGlobal.chave == chave).first()
            return obj.valor if obj else default
        finally:
            db.close()

    import json as _json

    agendamentos_raw = _get_p("cron_agendamentos", "")
    if agendamentos_raw:
        try:
            agendamentos = _json.loads(agendamentos_raw)
            if not isinstance(agendamentos, list):
                agendamentos = []
        except Exception:
            agendamentos = []
    else:
        # fallback para parâmetros legados
        dia_leg = _get_p("cron_dia_semana", "mon")
        hora_leg = _get_p("cron_hora", "08:00")
        agendamentos = [{"dia": dia_leg, "hora": hora_leg}]

    scheduler = BackgroundScheduler()
    from app.services.disparo_service import executar_disparo_sync
    for i, ag in enumerate(agendamentos):
        dia = ag.get("dia", "mon")
        hora_str = ag.get("hora", "08:00")
        hora_part, minuto_part = hora_str.split(":") if ":" in hora_str else ("8", "0")
        scheduler.add_job(
            executar_disparo_sync,
            CronTrigger(day_of_week=dia, hour=int(hora_part), minute=int(minuto_part)),
            id=f"disparo_semanal_{i}",
            replace_existing=True,
        )
    scheduler.start()

    yield

    scheduler.shutdown(wait=False)


app = FastAPI(title="SafeStock API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health", tags=["infra"])
def health():
    return {"status": "ok"}
