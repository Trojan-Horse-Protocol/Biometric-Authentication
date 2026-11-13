import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from webauthn import generate_registration_options, options_to_json, verify_registration_response
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from ..config import settings
from ..database import get_db
from ..model import Credential, RecoveryToken, User, utcnow
from .webauthn_routes import CredentialInfo, audit, pop_challenge, stash_challenge

router = APIRouter(prefix="/recovery", tags=["recovery"])

class TokenInfo(BaseModel):
    token: str

def valid_token(t: RecoveryToken | None) -> bool:
    return bool(t) and not t.used and t.expires_at > utcnow()

@router.post("/begin")
def recovery_begin(body: TokenInfo, request: Request, db: Session = Depends(get_db)):
    t = db.query(RecoveryToken).filter_by(
        token_hash=hashlib.sha256(body.token.encode()).hexdigest()).first()
    if not valid_token(t):
        audit(db, "recovery_fail", False, request=request, detail="bad token")
        raise HTTPException(400, "Invalid or expired")
    user = db.get(User, t.user_id)
    opts = generate_registration_options(rp_id=settings.rp_id, rp_name=settings.rp_name,
                                         user_id=user.handle, user_name=user.username,
                                         authenticator_selection=AuthenticatorSelectionCriteria(
                                             resident_key=ResidentKeyRequirement.PREFERRED,
                                             user_verification=UserVerificationRequirement.REQUIRED))
    stash_challenge(request, opts.challenge, purpose="recovery", token_id=t.id)
    return json.loads(options_to_json(opts))

@router.post("/finish")
def recovery_finish(body: CredentialInfo, request: Request, db: Session = Depends(get_db)):
    ch = pop_challenge(request, "recovery")
    t = db.get(RecoveryToken, ch["token_id"])

    if not valid_token(t):
        raise HTTPException(400, "invalid or expired")
    try:
        v = verify_registration_response(credential=body.credential, expected_challenge=ch["c"],
                                         expected_rp_id=settings.rp_id, expected_origin=settings.origin,
                                         require_user_verification=True)
    except Exception as e:
        audit(db, "recovery_fail", False, request=request, detail=str(e))
        raise HTTPException(400, "registration failed")

    user = db.get(User, t.user_id)
    if t.revoke_existing:
        user.credentials.clear()
    user.credentials.append(Credential(credential_id=v.credential_id, public_key=v.credential_public_key,
                                       sign_count=v.sign_count))
    t.used = True
    db.commit()

    request.session.clear()
    request.session["uid"] = user.id
    audit(db, "recovery_ok", True, user, request)
    return {"ok": True, "username": user.username}