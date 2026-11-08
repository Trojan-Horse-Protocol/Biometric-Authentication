from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")
    rp_id: str = "localhost"
    rp_name: str = "Club Portal"
    origin: str = "http://localhost:5173"
    session_secret: str
    admin_username: str = "admin"

settings = Settings()