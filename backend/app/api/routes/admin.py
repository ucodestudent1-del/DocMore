"""API routes: admin (user management, tier management, stats)."""

from typing import List
from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin, get_user_by_username
from app.database import get_db
from app.models import User, Upload, Output, Job, TIER_LIMITS
from app.storage import storage
from app.prisma_client import get_prisma


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
    tier: str | None = None
    role: str | None = None
    is_verified: bool | None = None


class AdminStats(BaseModel):
    total_users: int
    verified_users: int
    total_uploads: int
    total_outputs: int
    total_jobs: int
    jobs_by_status: dict
    users_by_tier: dict


def _user_out(user: User) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        tier=getattr(user, "tier", "free"),
        role=getattr(user, "role", "user"),
        is_verified=getattr(user, "is_verified", False),
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


@router.get("/users", response_model=List[AdminUserOut])
async def list_users(
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
):
    """List all users (admin only)."""
    result = await db.execute(select(User).offset(offset).limit(limit))
    users = result.scalars().all()
    return [_user_out(u) for u in users]


@router.get("/users/{username}", response_model=AdminUserOut)
async def get_user(
    username: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific user (admin only)."""
    user = await get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Re-fetch the ORM instance to get created_at.
    result = await db.execute(select(User).where(User.username == username))
    orm_user = result.scalar_one()
    return _user_out(orm_user)


@router.put("/users/{username}", response_model=AdminUserOut)
async def update_user(
    username: str,
    req: AdminUserUpdate,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a user's tier, role, or verification status (admin only)."""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if req.tier is not None:
        user.tier = req.tier
    if req.role is not None:
        user.role = req.role
    if req.is_verified is not None:
        user.is_verified = req.is_verified
    await db.commit()
    await db.refresh(user)
    return _user_out(user)


@router.delete("/users/{username}")
async def delete_user(
    username: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a user (admin only) and cascade their uploads/outputs/jobs."""
    if username == current_user["username"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    return {"detail": f"User {username} deleted"}


@router.get("/tiers")
async def list_tiers(current_user: dict = Depends(require_admin)):
    """List available subscription tiers and their limits (admin only)."""
    return {"tiers": TIER_LIMITS}


@router.get("/stats", response_model=AdminStats)
async def get_stats(current_user: dict = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Get platform statistics (admin only)."""
    total_users = await db.scalar(select(func.count(User.id)))
    verified_users = await db.scalar(select(func.count(User.id)).where(User.is_verified == True))  # noqa: E712
    total_uploads = await db.scalar(select(func.count(Upload.id)))
    total_outputs = await db.scalar(select(func.count(Output.id)))
    total_jobs = await db.scalar(select(func.count(Job.id)))

    jobs_result = await db.execute(select(Job.status, func.count(Job.id)).group_by(Job.status))
    jobs_by_status = {row[0]: row[1] for row in jobs_result.all()}

    tiers_result = await db.execute(select(User.tier, func.count(User.id)).group_by(User.tier))
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


# ---------------------------------------------------------------------------
# Admin jobs listing
# ---------------------------------------------------------------------------

@router.get("/jobs")
async def admin_jobs(
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
):
    """List all jobs across the platform (admin only)."""
    result = await db.execute(
        select(Job).order_by(Job.created_at.desc()).offset(offset).limit(limit)
    )
    jobs = result.scalars().all()
    return {
        "jobs": [
            {
                "id": j.id,
                "user_id": j.user_id,
                "task_name": j.task_name,
                "status": j.status,
                "progress": j.progress,
                "error": j.error,
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "completed_at": j.completed_at.isoformat() if j.completed_at else None,
            }
            for j in jobs
        ]
    }


# ---------------------------------------------------------------------------
# Retention & GDPR deletion
# ---------------------------------------------------------------------------

class RetentionRunResponse(BaseModel):
    removed_files: int
    removed_users: int


@router.post("/retention/run", response_model=RetentionRunResponse)
async def run_retention(
    current_user: dict = Depends(require_admin),
    hours: int = Query(24, ge=1),
):
    """Run retention cleanup: remove files older than `hours` (admin only)."""
    removed_files = await storage.cleanup_old(hours=hours)
    return RetentionRunResponse(removed_files=removed_files, removed_users=0)


@router.delete("/users/{username}/gdpr")
async def gdpr_delete_user(
    username: str,
    current_user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """GDPR deletion: delete a user and all their data (admin only)."""
    if username == current_user["username"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )
    # Delete user's files via storage backend
    from app.storage import storage as st
    history = await st.list_history(user_id=username)
    for entry in history:
        await st.delete_file(entry["id"], user_id=username)
    # Delete user from DB (cascades uploads/outputs/jobs/sessions)
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    # Audit log via Prisma
    prisma = get_prisma()
    try:
        await prisma.auditlog.create({
            "action": "GDPR_DELETE",
            "target": username,
            "metadata": {"deleted_by": current_user["username"]},
        })
    finally:
        await prisma.disconnect()
    return {"detail": f"User {username} and all data deleted (GDPR)"}


__all__ = ["router"]

