import json
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
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

from ..config import settings
from ..database import get_db
from ..identifiers import (
    IDENTIFIER_FORMAT_MESSAGE,
    is_valid_identifier,
    normalize_identifier,
)
from ..model import AuditEvent, Credential, User, utcnow

router = APIRouter(prefix="/authentication", tags=["auth"])

class UsernameInfo(BaseModel):
    username: str

class CredentialInfo(BaseModel):
    credential: dict

def client_ip(request: Request | None) -> str | None:
    return request.client.host if request and request.client else None

def audit(db, event, ok, user=None, request=None, detail=None):
    db.add(AuditEvent(user_id=user.id if user else None, username=user.username if user else None,event=event,
                      success=ok, detail=detail[:200] if detail else None, ip=client_ip(request)))
    db.commit()

def check_limit(db: Session, request: Request, username: str | None = None) -> None:
    cutoff = utcnow() - timedelta(minutes=settings.lockout_minutes)
    conds = []
    ip = client_ip(request)
    if ip:
        conds.append(AuditEvent.ip == ip)
    if username:
        conds.append(AuditEvent.username == username)
    if not conds:
        return
    failures = (db.query(AuditEvent) .filter(AuditEvent.event == "login_fail", AuditEvent.created_at >= cutoff, or_(*conds)).count())
    if failures >= settings.max_failed_logins:
        audit(db, "login_blocked", False, request=request, detail=username)
        raise HTTPException(429, "too many failed attempts.")


def stash_challenge(request: Request, challenge: bytes, **extra) -> None:
    request.session["ch"] = {"c": challenge.hex(), **extra}

def pop_challenge(request: Request, purpose: str) -> dict:
    ch = request.session.pop("ch", None)
    if not ch:
        raise HTTPException(400, "Challenge missing")
    if ch.get("purpose") != purpose:
        raise HTTPException(400, "Wrong challenge")
    ch["c"] = bytes.fromhex(ch["c"])
    return ch

def start_session(request: Request, user: User) -> None:
    request.session.clear()
    request.session["uid"] = user.id

@router.post("/register/begin")
def register_begin(body: UsernameInfo, request: Request, db: Session = Depends(get_db)):
    username = normalize_identifier(body.username)
    if not is_valid_identifier(username):
        raise HTTPException(422, IDENTIFIER_FORMAT_MESSAGE)
    if db.query(User).filter_by(username=username).first():
        raise HTTPException(409, "Username taken")

    handle = secrets.token_bytes(32)
    opts = generate_registration_options(
        rp_id=settings.rp_id, rp_name=settings.rp_name,
        user_id=handle, user_name=username,
        authenticator_selection=AuthenticatorSelectionCriteria(resident_key=ResidentKeyRequirement.PREFERRED,
                                                               user_verification=UserVerificationRequirement.REQUIRED))
    stash_challenge(request, opts.challenge, purpose="register", username=username, handle=handle.hex())
    return json.loads(options_to_json(opts))

@router.post("/register/verify")
def register_verify(body: CredentialInfo, request: Request, db: Session = Depends(get_db)):
    ch = pop_challenge(request, "register")
    try:
        v = verify_registration_response(credential=body.credential, expected_challenge=ch["c"],
                                         expected_rp_id=settings.rp_id, expected_origin=settings.origin,
                                         require_user_verification=True)
    except Exception as e:
        audit(db, "register_fail", False, request=request, detail=str(e))
        raise HTTPException(400, "registration failed")

    role = "member"
    user = User(username=ch["username"], handle=bytes.fromhex(ch["handle"]), role=role)
    user.credentials.append(Credential(credential_id=v.credential_id, public_key=v.credential_public_key,
                                       sign_count=v.sign_count))

    try:
        db.add(user)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "username taken")
    start_session(request, user)
    audit(db, "register_ok", True, user, request)
    return {"ok": True, "username": user.username}


@router.post("/login/begin")
def login_begin(body: UsernameInfo, request: Request, db: Session = Depends(get_db)):
    username = normalize_identifier(body.username)
    if not is_valid_identifier(username):
        raise HTTPException(422, IDENTIFIER_FORMAT_MESSAGE)
    check_limit(db, request, username)
    user = db.query(User).filter_by(username=username).first()
    allow = (
        [PublicKeyCredentialDescriptor(id=c.credential_id) for c in user.credentials]
        if user
        else []
    )
    if not allow:
        allow = [PublicKeyCredentialDescriptor(id=secrets.token_bytes(32))]

    opts = generate_authentication_options(rp_id=settings.rp_id, allow_credentials=allow,
                                           user_verification=UserVerificationRequirement.REQUIRED)
    stash_challenge(
        request,
        opts.challenge,
        purpose="login",
        uid=user.id if user else None,
        username=username,
    )
    return json.loads(options_to_json(opts))


@router.post("/login/verify")
def login_verify(body: CredentialInfo, request: Request, db: Session = Depends(get_db)):
    ch = pop_challenge(request, "login")
    try:
        raw_id = base64url_to_bytes(body.credential["rawId"])
    except Exception:
        raise HTTPException(400, "bad credential")

    user_id = ch.get("uid")
    user = db.get(User, user_id) if user_id is not None else None
    check_limit(db, request, user.username if user else ch.get("username"))
    if not user:
        audit(db, "login_fail", False, request=request, detail="unknown username")
        raise HTTPException(401, "Authentication failed")

    cred = db.query(Credential).filter_by(
        credential_id=raw_id,
        user_id=user.id,
    ).first()
    if not cred:
        audit(db, "login_fail", False, user, request, "credential not registered to user")
        raise HTTPException(401, "Authentication failed")

    try:
        v = verify_authentication_response( credential=body.credential, expected_challenge=ch["c"],
                                            expected_rp_id=settings.rp_id, expected_origin=settings.origin,
                                            credential_public_key=cred.public_key,
                                            credential_current_sign_count=cred.sign_count,
                                            require_user_verification=True)
    except Exception as e:
        audit(db, "login_fail", False, user, request, str(e))
        raise HTTPException(401, "Authentication failed")

    cred.sign_count = v.new_sign_count
    db.commit()
    start_session(request, user)
    audit(db, "login_ok", True, user, request)
    return {"ok": True, "username": user.username, "role": user.role}


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}

@router.get("/user")
def current(request: Request, db: Session = Depends(get_db)):
    uid = request.session.get("uid")
    user = db.get(User, uid) if uid else None
    if not user:
        raise HTTPException(401, "not authenticated")
    return {"username": user.username, "role": user.role}