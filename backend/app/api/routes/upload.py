"""API routes: file upload."""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.storage import storage
from app.api.routes.auth import get_current_user_optional
from app.rate_limiter import check_rate_limit_dependency
from app.malware import scan_bytes
from app.models import TIER_LIMITS

router = APIRouter(tags=["upload"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict | None = Depends(get_current_user_optional),
):
    user_id = current_user["username"] if current_user else None
    if user_id:
        await check_rate_limit_dependency(user_id)

        # Enforce per-tier file size quota.
        user_tier = current_user.get("tier", "free")
        limits = TIER_LIMITS.get(user_tier, TIER_LIMITS["free"])
        max_size_mb = limits.get("max_file_size_mb", 10)
        content = await file.read()
        if len(content) > max_size_mb * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail=f"File too large for {user_tier} tier (max {max_size_mb} MB)",
            )
    else:
        content = await file.read()

    # Malware scan (graceful degradation if ClamAV unavailable).
    scan_result = scan_bytes(content, file.filename or "file")
    if scan_result.infected:
        raise HTTPException(
            status_code=400,
            detail=f"File rejected: {scan_result.reason}",
        )

    try:
        entry = await storage.save_upload(
            content,
            file.filename or "file",
            user_id=user_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "id": entry["id"],
        "original_name": entry["original_name"],
        "mime": entry["mime"],
        "ext": entry["ext"],
        "size": entry["size"],
        "scanned": scan_result.scanned,
        "scan_reason": scan_result.reason,
    }
