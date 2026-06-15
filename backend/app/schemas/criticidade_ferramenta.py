from datetime import datetime
from typing import Literal
from pydantic import BaseModel


class CriticidadeFerramentaUpsert(BaseModel):
    criticidade: Literal["alta", "media", "baixa"] = "media"
    janela_consumo_dias: int | None = None
    threshold_inatividade: float | None = None
    observacao: str | None = None


class CriticidadeFerramentaResponse(BaseModel):
    id: int
    cpd_ferramenta: str
    criticidade: str
    janela_consumo_dias: int | None
    threshold_inatividade: float | None
    observacao: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
