from datetime import datetime
from pydantic import BaseModel


class EstoqueMinimoUpsert(BaseModel):
    estoque_minimo: float = 0.0
    estoque_maximo: float = 0.0
    observacao: str | None = None


class EstoqueMinimoResponse(BaseModel):
    id: int
    cpd: str
    estoque_minimo: float
    estoque_maximo: float
    observacao: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
