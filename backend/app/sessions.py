"""In-memory session store and cookie helpers.

WebAuthn authentication will call create_session() after a successful
assertion. Until that endpoint exists, POST /session creates a session
from a username so the cookie flow can be developed and tested.
"""

from __future__ import annotations

import logging
import os
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, Response, status

logger = logging.getLogger(__name__)

SESSION_COOKIE_NAME = "session_id"
SESSION_TTL = timedelta(seconds=int(os.getenv("SESSION_TTL_SECONDS", "86400")))


def _cookie_secure() -> bool:
    return os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"


@dataclass
class Session:
    session_id: str
    user_id: str
    username: str
    created_at: datetime
    expires_at: datetime


_sessions: dict[str, Session] = {}


def user_id_for_username(username: str) -> str:
    normalized = username.strip().lower()
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, normalized))


def create_session(username: str) -> Session:
    cleaned = username.strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required.",
        )

    session_id = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    session = Session(
        session_id=session_id,
        user_id=user_id_for_username(cleaned),
        username=cleaned,
        created_at=now,
        expires_at=now + SESSION_TTL,
    )
    _sessions[session_id] = session
    logger.info("session created user_id=%s", session.user_id)
    return session


def get_session(session_id: str | None) -> Session | None:
    if not session_id:
        return None

    session = _sessions.get(session_id)
    if session is None:
        return None

    if session.expires_at <= datetime.now(timezone.utc):
        _sessions.pop(session_id, None)
        logger.info("session expired user_id=%s", session.user_id)
        return None

    return session


def delete_session(session_id: str | None) -> None:
    if not session_id:
        return

    session = _sessions.pop(session_id, None)
    if session is not None:
        logger.info("session deleted user_id=%s", session.user_id)


def set_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        httponly=True,
        samesite="lax",
        secure=_cookie_secure(),
        max_age=int(SESSION_TTL.total_seconds()),
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        samesite="lax",
        secure=_cookie_secure(),
        httponly=True,
    )


def require_session(request: Request) -> Session:
    session = get_session(request.cookies.get(SESSION_COOKIE_NAME))
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return session
