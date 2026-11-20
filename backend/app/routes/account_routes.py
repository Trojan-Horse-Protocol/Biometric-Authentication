import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from webauthn import generate_registration_options, options_to_json, verify_registration_response
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from ..config import settings
from ..database import get_db
from ..dependencies import current_user
from ..model import AuditEvent, Credential, User
from .webauthn_routes import CredentialInfo, audit, pop_challenge, stash_challenge

router = APIRouter(prefix="/account", tags=["account"])

@router.get("")
def get_account(user: User = Depends(current_user)):
    return {"username": user.username, "role": user.role,
            "passkeys": [{"id": c.id, "label": c.label} for c in user.credentials]}

@router.post("/passkeys/begin")
def add_passkey_begin(request: Request, user: User = Depends(current_user)):
    opts = generate_registration_options(rp_id=settings.rp_id, rp_name=settings.rp_name,user_id=user.handle,
                                         user_name=user.username,
                                         exclude_credentials=[PublicKeyCredentialDescriptor(id=c.credential_id) for c in user.credentials],
                                         authenticator_selection=AuthenticatorSelectionCriteria(
                                             resident_key=ResidentKeyRequirement.PREFERRED,
                                             user_verification=UserVerificationRequirement.REQUIRED))

    stash_challenge(request, opts.challenge, purpose="add_passkey", uid=user.id)
    return json.loads(options_to_json(opts))


@router.post("/passkeys/finish")
def add_passkey_finish(body: CredentialInfo, request: Request,user: User = Depends(current_user), db: Session = Depends(get_db)):
    ch = pop_challenge(request, "add_passkey")

    if ch.get("uid") != user.id:
        raise HTTPException(400, "wrong challenge")
    try:
        v = verify_registration_response(credential=body.credential, expected_challenge=ch["c"],expected_rp_id=settings.rp_id,
                                         expected_origin=settings.origin, require_user_verification=True)
    except Exception as e:
        audit(db, "passkey_add_fail", False, user, request, str(e))
        raise HTTPException(400, "registration failed")
    try:
        user.credentials.append(Credential(credential_id=v.credential_id, public_key=v.credential_public_key,
                                           sign_count=v.sign_count))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "passkey already registered")

    audit(db, "passkey_added", True, user, request)
    return {"ok": True}


@router.delete("/passkeys/{passkey_id}")
def remove_passkey(passkey_id: int, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    cred = db.query(Credential).filter_by(id=passkey_id, user_id=user.id).first()  # scoped to owner

    if not cred:
        raise HTTPException(404, "not found")
    if len(user.credentials) == 1:
        raise HTTPException(400, "unable to remove passkey")

    db.delete(cred)
    db.commit()
    audit(db, "passkey_removed", True, user, request)
    return {"ok": True}


@router.get("/history")
def my_history(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = (db.query(AuditEvent).filter_by(user_id=user.id).order_by(AuditEvent.id.desc()).limit(50))

    return [{"event": r.event, "success": r.success, "ip": r.ip, "created_at": r.created_at} for r in rows]