from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from .database import get_db
from .model import User

def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    uid = request.session.get("uid")
    user = db.get(User, uid) if uid else None
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user

def require_admin(user: User = Depends(current_user)) -> User:
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin only")
    return user