from datetime import datetime
from pydantic import BaseModel


class ConfigFornecedorUpsert(BaseModel):
    leadtime_meses:  float = 2.0
    cobertura_meses: float = 2.0


class ConfigFornecedorResponse(BaseModel):
    id:              int
    razao_social:    str
    leadtime_meses:  float
    cobertura_meses: float
    created_at:      datetime
    updated_at:      datetime

    model_config = {"from_attributes": True}
