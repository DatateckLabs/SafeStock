from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenVerifyRequest(BaseModel):
    token: str


class TokenVerifyResponse(BaseModel):
    valid: bool


# Contrato idêntico ao auth central Datateck
class MeResponse(BaseModel):
    username: str
    role: str
    groups: list[str]
    permissions: list[str]
    apps: list[str]
