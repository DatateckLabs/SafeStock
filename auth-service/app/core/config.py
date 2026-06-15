from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    app_prefix: str = "safestock"
    auth_base_url: str = "http://localhost:8001"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    environment: str = "development"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
