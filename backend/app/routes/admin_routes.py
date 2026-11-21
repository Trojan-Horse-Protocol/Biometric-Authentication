import hashlib
import secrets
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..dependencies import require_admin
from ..email import send_recovery_email
from ..model import AuditEvent, RecoveryToken, User, utcnow
from .webauthn_routes import audit

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

ROLE_RANK = {"member": 0, "admin": 1, "super_admin": 2}

class RoleInfo(BaseModel):
    role: Literal["member", "admin"]

class RecoveryInfo(BaseModel):
    revoke_existing: bool = True

@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    return [{"id": u.id, "username": u.username, "role": u.role, "passkey_count": len(u.credentials)} for u in db.query(User).order_by(User.id)]

@router.patch("/users/{user_id}/role")
def set_role(user_id: int, body: RoleInfo, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.get(User, user_id)

    if not user:
        raise HTTPException(404, "user not found")
    if user.role == "super_admin":
        raise HTTPException(403, "The super admin cannot be changed")
    if ROLE_RANK[admin.role] <= ROLE_RANK[user.role]:
        raise HTTPException(403, "Administrators can only manage lower-tier accounts")
    if body.role == "super_admin":
        raise HTTPException(403, "Super admin role can only be assigned during bootstrap")

    user.role = body.role
    db.commit()

    audit(db, "role_change", True, admin, request, f"{user.username} -> {body.role}")
    return {"ok": True, "username": user.username, "role": user.role}
@router.post("/users/{user_id}/recovery")
def issue_recovery(user_id: int, body: RecoveryInfo, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(403, "You cannot issue a recovery token for yourself")
    if ROLE_RANK[admin.role] <= ROLE_RANK[user.role]:
        raise HTTPException(403, "Administrators can only generate recovery tokens for lower-tier accounts")

    db.query(RecoveryToken).filter(
        RecoveryToken.user_id == user.id,
        RecoveryToken.used == False,
    ).update({"used": True})

    if body.revoke_existing:
        user.credentials.clear()

    token = secrets.token_urlsafe(32)

    db.add(RecoveryToken(user_id=user.id, created_by=admin.id, token_hash=hashlib.sha256(token.encode()).hexdigest(),
                         expires_at=utcnow() + timedelta(minutes=settings.recovery_token_minutes),
                         revoke_existing=body.revoke_existing))
    db.commit()

    email_sent = "@" in user.username
    if email_sent:
        try:
            send_recovery_email(user.username, token)
        except Exception as error:
            audit(db, "recovery_email_fail", False, admin, request, str(error))
            raise HTTPException(503, "Recovery token was created, but email delivery failed.") from error

    audit(db, "recovery_issued", True, admin, request, f"for {user.username}")
    return {
        "token": token,
        "expires_in_minutes": settings.recovery_token_minutes,
        "email_sent": email_sent,
    }


@router.get("/audit")
def list_audit(limit: int = 100, db: Session = Depends(get_db)):
    rows = db.query(AuditEvent).order_by(AuditEvent.id.desc()).limit(max(1, min(limit, 500)))

    return [{"id": r.id, "username": r.username, "event": r.event, "success": r.success,"ip": r.ip, "detail": r.detail, "created_at": r.created_at} for r in rows]
