from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel, Field

from backend.app.sessions import (
    Session,
    clear_session_cookie,
    create_session,
    delete_session,
    require_session,
    set_session_cookie,
    SESSION_COOKIE_NAME,
)

router = APIRouter(tags=["session"])


class CreateSessionRequest(BaseModel):
    username: str = Field(min_length=1)


class SessionResponse(BaseModel):
    user_id: str
    username: str
    expires_at: str


def _to_response(session: Session) -> SessionResponse:
    return SessionResponse(
        user_id=session.user_id,
        username=session.username,
        expires_at=session.expires_at.isoformat(),
    )


@router.post("/session", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_user_session(
    payload: CreateSessionRequest, response: Response
) -> SessionResponse:
    """Create a session cookie for the given username.

    This is a stand-in until WebAuthn authentication verify creates sessions
    only after a successful assertion.
    """
    session = create_session(payload.username)
    set_session_cookie(response, session.session_id)
    return _to_response(session)


@router.get("/session", response_model=SessionResponse)
def read_current_session(request: Request) -> SessionResponse:
    return _to_response(require_session(request))


@router.post("/logout")
def logout(request: Request, response: Response) -> dict[str, str]:
    delete_session(request.cookies.get(SESSION_COOKIE_NAME))
    clear_session_cookie(response)
    return {"status": "logged_out"}
