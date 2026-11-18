import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.errors import register_error_handlers
from backend.app.routers.session import router as session_router

load_dotenv()


def get_allowed_origins() -> list[str]:
    configured_origins = os.getenv(
        "BACKEND_CORS_ORIGINS", "http://localhost:5173"
    )
    return [origin.strip() for origin in configured_origins.split(",") if origin.strip()]


app = FastAPI(
    title="WebAuthn Project API",
    version="0.1.0",
    description="Starter API for the club's WebAuthn project.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

register_error_handlers(app)
app.include_router(session_router)


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    """Return a simple response used to verify that the API is running."""
    return {"status": "ok", "service": "webauthn-api"}
