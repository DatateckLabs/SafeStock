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
    import app.models.disparo_log  # noqa: F401 — registra o model no metadata
    Base.metadata.create_all(bind=engine, checkfirst=True)

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

    dia = _get_p("cron_dia_semana", "mon")
    hora_str = _get_p("cron_hora", "08:00")
    hora, minuto = hora_str.split(":") if ":" in hora_str else ("8", "0")

    scheduler = BackgroundScheduler()
    from app.services.disparo_service import executar_disparo_sync
    scheduler.add_job(
        executar_disparo_sync,
        CronTrigger(day_of_week=dia, hour=int(hora), minute=int(minuto)),
        id="disparo_semanal",
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
