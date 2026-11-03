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

from .database import get_db
from .model import User, Credential

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
USERNAME_RE = re.compile(r"^[A-Za-z0-9_-]{3,50}$")

class UsernameInfo(BaseModel):
    username: str
class CredentialInfo(BaseModel):
    credential: dict

def stash_challenge(request: Request, challenge: bytes, **extra) -> None:
    request.session["ch"] = {"c": challenge.hex(), **extra}


def pop_challenge(request: Request) -> dict:
    ch = request.session.pop("ch", None)  # pop makes it single-use
    if not ch:
        raise HTTPException(400, "Challenge missing")
    ch["c"] = bytes.fromhex(ch["c"])
    return ch

@router.post("/register/begin")
def register_begin(body: UsernameInfo, request: Request, db: Session = Depends(get_db)):
    if not USERNAME_RE.match(body.username):
        raise HTTPException(422, "Username is invalid")
    if db.query(User).filter_by(username=body.username).first():
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

@router.post("/register/finish")
def register_finish(body: CredentialInfo, request: Request, db: Session = Depends(get_db)):
    ch = pop_challenge(request)
    try:
        v = verify_registration_response(
            credential=body.credential,
            expected_challenge=ch["c"],
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
            require_user_verification=True,
        )
    except Exception:
        raise HTTPException(400, "Registration failed")

    role = "admin" if ch["username"] == ADMIN_USERNAME else "member"  # bootstrap admin
    user = User(username=ch["username"], handle=bytes.fromhex(ch["handle"]), role=role)
    user.credentials.append(
        Credential(
            credential_id=v.credential_id,
            public_key=v.credential_public_key,
            sign_count=v.sign_count,
        )
    )
    db.add(user)
    db.commit()
    request.session["uid"] = user.id
    return {"ok": True, "username": user.username}

@router.post("/login/begin")
def login_begin(body: UsernameInfo, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=body.username).first()
    allow = [PublicKeyCredentialDescriptor(id=credential.credential_id) for credential in user.credentials] if user else []
    opts = generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=allow,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    stash_challenge(request, opts.challenge)
    return json.loads(options_to_json(opts))

@router.post("/login/verify")
def login_verify(body: CredentialInfo, request: Request, db: Session = Depends(get_db)):
    ch = pop_challenge(request)
    try:
        raw_id = base64url_to_bytes(body.credential["rawId"])
    except Exception:
        raise HTTPException(400, "Malformed credential")

    cred = db.query(Credential).filter_by(credential_id=raw_id).first()
    if not cred:
        raise HTTPException(401, "Authentication failed")

    try:
        v = verify_authentication_response(
            credential=body.credential,
            expected_challenge=ch["c"],
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
            credential_public_key=cred.public_key,
            credential_current_sign_count=cred.sign_count,
            require_user_verification=True,
        )
    except Exception:
        raise HTTPException(401, "Authentication failed")

    cred.sign_count = v.new_sign_count
    db.commit()
    request.session["uid"] = cred.user_id
    return {"ok": True, "username": cred.user.username, "role": cred.user.role}

@router.get("/user")
def me(request: Request, db: Session = Depends(get_db)):
    uid = request.session.get("uid")
    user = db.get(User, uid) if uid else None
    if not user:
        raise HTTPException(401, "Not authenticated")
    return {"username": user.username, "role": user.role, "passkey_count": len(user.credentials)}


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}