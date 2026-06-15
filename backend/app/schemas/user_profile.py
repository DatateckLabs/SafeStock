from datetime import datetime
from typing import Literal
from pydantic import BaseModel


class UserProfileCreate(BaseModel):
    username: str
    role: Literal["admin", "gestor", "operador"] = "operador"
    is_active: bool = True


class UserProfileUpdate(BaseModel):
    role: Literal["admin", "gestor", "operador"] | None = None
    is_active: bool | None = None


class UserProfileResponse(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MeResponse(BaseModel):
    username: str
    role: str
    groups: list[str]
    permissions: list[str]
    apps: list[str]
