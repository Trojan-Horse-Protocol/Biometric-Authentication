"""Recovery-token endpoints used by the Recovery UI.

The token store is intentionally in memory for this starter implementation.
Production recovery should persist token hashes and require an authenticated
admin session before issuing a token.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/recovery", tags=["recovery"])
TOKEN_LIFETIME = timedelta(minutes=30)


class IssueRecoveryTokenRequest(BaseModel):
    email: str = Field(min_length=3)
    reason: str = Field(min_length=1, max_length=500)


class IssueRecoveryTokenResponse(BaseModel):
    email: str
    token: str
    expires_at: str


class ValidateRecoveryTokenRequest(BaseModel):
    email: str = Field(min_length=3)
    token: str = Field(min_length=1)


class ValidateRecoveryTokenResponse(BaseModel):
    status: str
    email: str
    expires_at: str


_tokens: dict[str, dict[str, str | datetime]] = {}


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _remove_expired_tokens(now: datetime) -> None:
    expired = [
        key for key, value in _tokens.items() if value["expires_at"] <= now
    ]
    for key in expired:
        _tokens.pop(key, None)


@router.post(
    "/admin/tokens",
    response_model=IssueRecoveryTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def issue_recovery_token(
    payload: IssueRecoveryTokenRequest,
) -> IssueRecoveryTokenResponse:
    """Issue a short-lived recovery token for the admin recovery form."""
    now = datetime.now(timezone.utc)
    _remove_expired_tokens(now)
    token = f"recovery-{secrets.token_urlsafe(18)}"
    expires_at = now + TOKEN_LIFETIME
    _tokens[_token_hash(token)] = {
        "email": payload.email.strip().lower(),
        "expires_at": expires_at,
    }
    return IssueRecoveryTokenResponse(
        email=payload.email.strip().lower(),
        token=token,
        expires_at=expires_at.isoformat(),
    )


@router.post("/validate", response_model=ValidateRecoveryTokenResponse)
def validate_recovery_token(
    payload: ValidateRecoveryTokenRequest,
) -> ValidateRecoveryTokenResponse:
    """Validate a recovery token before starting passkey registration."""
    now = datetime.now(timezone.utc)
    _remove_expired_tokens(now)
    record = _tokens.get(_token_hash(payload.token.strip()))
    email = payload.email.strip().lower()

    if record is None or not hmac.compare_digest(str(record["email"]), email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid recovery token.",
        )

    expires_at = record["expires_at"]
    if not isinstance(expires_at, datetime) or expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recovery token has expired.",
        )

    return ValidateRecoveryTokenResponse(
        status="valid",
        email=email,
        expires_at=expires_at.isoformat(),
    )
