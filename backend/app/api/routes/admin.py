"""API routes: admin (user management, tier management, stats)."""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from sqlalchemy import select, func, delete

from app.auth import require_admin, get_user_by_username, update_user_profile, change_password
from app.database import async_session
from app.models import User, Upload, Output, Job, Subscription, TIER_LIMITS


router = APIRouter(tags=["admin"], prefix="/api/admin")


class AdminUserOut(BaseModel):
    id: int
    username: str
    email: str
    tier: str
    role: str
    is_verified: bool
    created_at: str


class AdminUserUpdate(BaseModel):
    tier: Optional[str] = None
    role: Optional[str] = None
    is_verified: Optional[bool] = None


class AdminStats(BaseModel):
    total_users: int
    verified_users: int
    total_uploads: int
    total_outputs: int
    total_jobs: int
    jobs_by_status: dict
    users_by_tier: dict


@router.get("/users", response_model=List[AdminUserOut])
async def list_users(
    current_user: dict = Depends(require_admin),
    limit: int = 100,
    offset: int = 0,
):
    """List all users (admin only)."""
    async with async_session() as db:
        result = await db.execute(
            select(User).offset(offset).limit(limit)
        )
        users = result.scalars().all()
        return [
            AdminUserOut(
                id=u.id,
                username=u.username,
                email=u.email,
                tier=u.tier,
                role=u.role,
                is_verified=u.is_verified,
                created_at=u.created_at.isoformat() if u.created_at else "",
            )
            for u in users
        ]


@router.get("/users/{username}", response_model=AdminUserOut)
async def get_user(
    username: str,
    current_user: dict = Depends(require_admin),
):
    """Get a specific user (admin only)."""
    async with async_session() as db:
        user = await get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return AdminUserOut(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        tier=user["tier"],
        role=user["role"],
        is_verified=user["is_verified"],
        created_at="",
    )


@router.put("/users/{username}", response_model=AdminUserOut)
async def update_user(
    username: str,
    req: AdminUserUpdate,
    current_user: dict = Depends(require_admin),
):
    """Update a user's tier, role, or verification status (admin only)."""
    updated = await update_user_profile(
        username,
        tier=req.tier,
        role=req.role,
    )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not update user",
        )
    # Handle is_verified separately
    if req.is_verified is not None:
        async with async_session() as db:
            result = await db.execute(select(User).where(User.username == username))
            user = result.scalar_one_or_none()
            if user:
                user.is_verified = req.is_verified
                await db.commit()
    return AdminUserOut(
        id=updated["id"],
        username=updated["username"],
        email=updated["email"],
        tier=updated["tier"],
        role=updated["role"],
        is_verified=updated["is_verified"],
        created_at="",
    )


@router.delete("/users/{username}")
async def delete_user(
    username: str,
    current_user: dict = Depends(require_admin),
):
    """Delete a user (admin only)."""
    if username == current_user["username"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )
    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        await db.execute(delete(User).where(User.username == username))
        await db.commit()
    return {"detail": f"User {username} deleted"}


@router.get("/tiers")
async def list_tiers(current_user: dict = Depends(require_admin)):
    """List available subscription tiers and their limits (admin only)."""
    return {"tiers": TIER_LIMITS}


@router.get("/stats", response_model=AdminStats)
async def get_stats(current_user: dict = Depends(require_admin)):
    """Get platform statistics (admin only)."""
    async with async_session() as db:
        total_users = await db.scalar(select(func.count(User.id)))
        verified_users = await db.scalar(select(func.count(User.id)).where(User.is_verified == True))  # noqa: E712
        total_uploads = await db.scalar(select(func.count(Upload.id)))
        total_outputs = await db.scalar(select(func.count(Output.id)))
        total_jobs = await db.scalar(select(func.count(Job.id)))

        # Jobs by status
        jobs_result = await db.execute(
            select(Job.status, func.count(Job.id)).group_by(Job.status)
        )
        jobs_by_status = {row[0]: row[1] for row in jobs_result.all()}

        # Users by tier
        tiers_result = await db.execute(
            select(User.tier, func.count(User.id)).group_by(User.tier)
        )
        users_by_tier = {row[0]: row[1] for row in tiers_result.all()}

    return AdminStats(
        total_users=total_users or 0,
        verified_users=verified_users or 0,
        total_uploads=total_uploads or 0,
        total_outputs=total_outputs or 0,
        total_jobs=total_jobs or 0,
        jobs_by_status=jobs_by_status,
        users_by_tier=users_by_tier,
    )
