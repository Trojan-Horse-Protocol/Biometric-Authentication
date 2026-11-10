from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from .config import settings
from .database import Base, engine
from .routes import webauthn_routes

Base.metadata.create_all(engine)

app = FastAPI(
    title="WebAuthn Project API",
    version="0.1.0",
    description="Passkey-protected club portal API.",
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    https_only=False,  #set True in production
    same_site="lax",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(webauthn_routes.router)

@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "webauthn-api"}