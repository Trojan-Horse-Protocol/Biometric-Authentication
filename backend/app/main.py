import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from .database import Base, engine

load_dotenv()


def get_allowed_origins() -> list[str]:
    configured_origins = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:5173")
    return [o.strip() for o in configured_origins.split(",") if o.strip()]

Base.metadata.create_all(engine)

app = FastAPI(
    title="WebAuthn Project API",
    version="0.1.0",
    description="Passkey-protected club portal API.",
)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ["SESSION_SECRET"],
    https_only=False,
    same_site="lax",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(auth.router)

@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "webauthn-api"}