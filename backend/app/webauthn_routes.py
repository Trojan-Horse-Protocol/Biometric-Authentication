import os, json, re, secrets
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from database import get_db
from model import Users, Credential

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request

from pydantic import BaseModel

from sqlalchemy.orm import Session

router = APIRouter(prefix="/authentication", tags=["auth"])

#CONST
RP_ID = os.getenv("RP_ID", "localhost")
RP_NAME = os.getenv("RP_NAME", "Club Portal")
ORIGIN = os.getenv("ORIGIN", "http://localhost:5173")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_-]+$")

class UsernameInfo(BaseModel):
    username: str
class Credentials(BaseModel):
    username: dict

def stash_challenge(request: Request, challenge: bytes, **extra) -> None:
    request.session["ch"] = {"c": challenge.hex(), **extra}


def pop_challenge(request: Request) -> dict:
    ch = request.session.pop("ch", None)  # pop makes it single-use
    if not ch:
        raise HTTPException(400, "Challenge missing")
    ch["c"] = bytes.fromhex(ch["c"])
    return ch

@router.post("/register/options")
def register_options(body: UsernameInfo, request: Request, db: Session = Depends(get_db)):
    if not USERNAME_RE.match(body.username):
        raise HTTPException(422, "Username must be 3-64 characters: letters, numbers, _ . -")
    if db.query(Users).filter_by(username=body.username).first():
        raise HTTPException(409, "Username taken")

    handle = secrets.token_bytes(32)
    opts = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=handle,
        user_name=body.username,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
    )

    stash_challenge(request, opts.challenge, username=body.username, handle=handle.hex())
    return json.loads(options_to_json(opts))
