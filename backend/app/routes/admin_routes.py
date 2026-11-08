from fastapi import APIRouter, Depends, HTTPException
from ..dependencies import require_admin

router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])

@router.get("/users")
@router.patch("/users/{id}/role")
@router.get("/audit")