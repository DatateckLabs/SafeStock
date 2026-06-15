from datetime import datetime
from pydantic import BaseModel


class ConfigFerramentaUpsert(BaseModel):
    aplicacoes:        int   = 80_000
    leadtime_override: float | None = None


class ConfigFerramentaResponse(BaseModel):
    id:                int
    cpd_ferramenta:    str
    aplicacoes:        int
    leadtime_override: float | None
    created_at:        datetime
    updated_at:        datetime

    model_config = {"from_attributes": True}
