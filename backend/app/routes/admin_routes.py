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
from ..model import AuditEvent, RecoveryToken, User, utcnow
from .webauthn_routes import audit

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

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

    if admin.role != "super_admin":
        raise HTTPException(403, "Super admin only")

    if user.role == "super_admin":
        raise HTTPException(400, "cannot change super admin")

    user.role = body.role
    db.commit()

    audit(db, "role_change", True, admin, request, f"{user.username} -> {body.role}")
    return {"ok": True, "username": user.username, "role": user.role}
@router.post("/users/{user_id}/recovery")
def issue_recovery(user_id: int, body: RecoveryInfo, request: Request, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    token = secrets.token_urlsafe(32)

    db.add(RecoveryToken(user_id=user.id, created_by=admin.id, token_hash=hashlib.sha256(token.encode()).hexdigest(),
                         expires_at=utcnow() + timedelta(minutes=settings.recovery_token_minutes),
                         revoke_existing=body.revoke_existing))
    db.commit()

    audit(db, "recovery_issued", True, admin, request, f"for {user.username}")
    return {"token": token, "expires_in_minutes": settings.recovery_token_minutes}


@router.get("/audit")
def list_audit(limit: int = 100, db: Session = Depends(get_db)):
    rows = db.query(AuditEvent).order_by(AuditEvent.id.desc()).limit(max(1, min(limit, 500)))

    return [{"id": r.id, "username": r.username, "event": r.event, "success": r.success,"ip": r.ip, "detail": r.detail, "created_at": r.created_at} for r in rows]