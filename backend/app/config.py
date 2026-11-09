from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE)

    rp_id: str = "localhost"
    rp_name: str = "Club Portal"
    origin: str = "http://localhost:5173"
    session_secret: str
    admin_username: str = "admin"
    backend_cors_origins: str = "http://localhost:5173"

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]

settings = Settings()