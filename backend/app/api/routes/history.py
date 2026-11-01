"""API routes: processing history."""

from typing import Optional
from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordBearer
from app.storage import storage
from app.api.routes.auth import get_current_user

router = APIRouter(tags=["history"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


@router.get("/history")
def get_history(
    limit: int = 100,
    current_user: Optional[dict] = Depends(get_current_user),
):
    return {"history": storage.list_history(limit=limit, user_id=current_user.username if current_user else None)}
