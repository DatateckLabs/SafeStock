from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    auth_base_url: str = "http://auth-service:8001"
    environment: str = "development"
    # Fix 1 — ALLOWED_ORIGINS como str com split
    allowed_origins_raw: str = Field("http://localhost:5173", alias="ALLOWED_ORIGINS")

    # BigQuery
    google_application_credentials: str = "./credentials/bigquery_key.json"
    bq_project: str = "bi-datateck"

    # SMTP
    smtp_password: str = ""

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins_raw.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        populate_by_name = True


settings = Settings()
