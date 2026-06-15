from datetime import datetime
from pydantic import BaseModel


class ParametroGlobalUpdate(BaseModel):
    valor: str
    descricao: str | None = None


class ParametroGlobalResponse(BaseModel):
    id: int
    chave: str
    valor: str
    descricao: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}
