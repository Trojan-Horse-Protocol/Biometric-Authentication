from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db
from ..deps import current_user
from ..model import Credential

router = APIRouter(prefix="/account")

@router.get("")
def me(user=Depends(current_user)):
    return {"username": user.username, "role": user.role,
            "passkeys": [{"id": c.id, "label": c.label, "created_at": c.created_at} for c in user.credentials]}

@router.delete("/passkeys/{cid}")
def remove(cid: int, user=Depends(current_user), db=Depends(get_db)):
    cred = db.query(Credential).filter_by(id=cid, user_id=user.id).first()  # scoped to owner
    if not cred: raise HTTPException(404)
    if len(user.credentials) == 1: raise HTTPException(400, "Can't remove your last passkey")
    db.delete(cred); db.commit()