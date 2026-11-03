"""API routes: usage and quota status."""

from fastapi import APIRouter, HTTPException, Depends
from app.usage_service import usage_service
from app.api.routes.auth import get_current_user

router = APIRouter(tags=["usage"])


@router.get("/usage")
async def get_usage(
    current_user: dict = Depends(get_current_user),
):
    """Get current usage vs limits for the authenticated user."""
    try:
        status = await usage_service.get_quota_status(current_user["username"])
        return status
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


__all__ = ["router"]
