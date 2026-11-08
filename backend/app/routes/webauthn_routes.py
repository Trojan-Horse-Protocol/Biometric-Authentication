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

from ..database import get_db
from ..model import User, Credential, AuditEvent
from ..config import settings

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request

from pydantic import BaseModel

from sqlalchemy.orm import Session

router = APIRouter(prefix="/authentication", tags=["auth"])

class UsernameInfo(BaseModel):
    username: str
class CredentialInfo(BaseModel):
    credential: dict

def audit(db, event, ok, user=None, request=None, detail=None):
    db.add(AuditEvent(user_id=user.id if user else None, username=user.username if user else None,
                      event=event, success=ok, detail=detail,
                      ip=request.client.host if request else None))
    db.commit()


def stash_challenge(request: Request, challenge: bytes, **extra) -> None:
    request.session["ch"] = {"c": challenge.hex(), **extra}


def pop_challenge(request: Request) -> dict:
    ch = request.session.pop("ch", None)
    if not ch:
        raise HTTPException(400, "Challenge missing")
    ch["c"] = bytes.fromhex(ch["c"])
    return ch

@router.post("/register/begin")
def register_begin(body: UsernameInfo, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=body.username).first()
    if user:
        raise HTTPException(409, "Username taken")
    handle = secrets.token_bytes(32)
    opts = generate_registration_options(
        rp_id=settings.rp_id, rp_name=settings.rp_name,
        user_id=handle, user_name=body.username,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.REQUIRED))
    stash_challenge(request, opts.challenge, username=body.username, handle=handle.hex())
    return json.loads(options_to_json(opts))

@router.post("/register/verify")
def register_verify(body: CredentialInfo, request: Request, db: Session = Depends(get_db)):
    ch = pop_challenge(request)
    try:
        v = verify_registration_response(
            credential=body.credential, expected_challenge=ch["c"],
            expected_rp_id=settings.rp_id, expected_origin=settings.origin,
            require_user_verification=True)
    except Exception as e:
        audit(db, "register_fail", False, request=request, detail=str(e));
        raise HTTPException(400, "Registration failed")
    role = "admin" if ch["username"] == settings.admin_username else "member"  # bootstrap admin
    user = User(username=ch["username"], handle=bytes.fromhex(ch["handle"]), role=role)
    user.credentials.append(Credential(credential_id=v.credential_id,
                                       public_key=v.credential_public_key, sign_count=v.sign_count))
    db.add(user);
    db.commit()
    request.session["uid"] = user.id
    audit(db, "register_ok", True, user, request)
    return {"ok": True}

@router.post("/login/begin")
def login_begin(body: UsernameInfo, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=body.username).first()
    allow = [PublicKeyCredentialDescriptor(id=c.credential_id) for c in user.credentials] if user else []
    opts = generate_authentication_options(rp_id=settings.rp_id, allow_credentials=allow,
                                           user_verification=UserVerificationRequirement.REQUIRED)
    stash_challenge(request, opts.challenge)
    return json.loads(options_to_json(opts))

@router.post("/login/verify")
def login_verify(body: CredentialInfo, request: Request, db: Session = Depends(get_db)):
    ch = pop_challenge(request)
    from webauthn.helpers import base64url_to_bytes
    raw_id = base64url_to_bytes(body.credential["rawId"])
    cred = db.query(Credential).filter_by(credential_id=raw_id).first()
    if not cred:
        audit(db, "login_fail", False, request=request, detail="unknown credential")
        raise HTTPException(401, "Authentication failed")
    user = db.get(User, cred.user_id)
    try:
        v = verify_authentication_response(
            credential=body.credential, expected_challenge=ch["c"],
            expected_rp_id=settings.rp_id, expected_origin=settings.origin,
            credential_public_key=cred.public_key, credential_current_sign_count=cred.sign_count,
            require_user_verification=True)
    except Exception as e:
        audit(db, "login_fail", False, user, request, str(e));
        raise HTTPException(401, "Authentication failed")
    cred.sign_count = v.new_sign_count;
    db.commit()
    request.session["uid"] = user.id
    audit(db, "login_ok", True, user, request)
    return {"ok": True, "username": user.username, "role": user.role}


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}