"""API routes: processing history."""

from typing import Optional
from fastapi import APIRouter, Depends
from app.storage import storage
from app.api.routes.auth import get_current_user

router = APIRouter(tags=["history"])


@router.get("/history")
def get_history(
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
):
    return {"history": storage.list_history(limit=limit, user_id=current_user["username"])}
