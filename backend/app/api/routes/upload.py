"""API routes: file upload."""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.storage import storage
from app.api.routes.auth import get_current_user_optional
from app.rate_limiter import check_rate_limit_dependency
from app.malware import scan_bytes
from app.usage_service import usage_service, QuotaExceeded

router = APIRouter(tags=["upload"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict | None = Depends(get_current_user_optional),
):
    user_id = current_user["username"] if current_user else None
    if user_id:
        await check_rate_limit_dependency(user_id)

        # Enforce per-tier file size quota via UsageService.
        await usage_service.check_upload_quota(user_id, 0)  # size checked below

    content = await file.read()

    if user_id:
        # Re-check with actual file size.
        await usage_service.check_upload_quota(user_id, len(content))

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
    except QuotaExceeded as exc:
        raise HTTPException(status_code=402, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Record usage for authenticated users.
    if user_id:
        try:
            await usage_service.record_conversion(user_id, len(content))
        except Exception:
            pass  # Usage recording should not fail the upload

    return {
        "id": entry["id"],
        "original_name": entry["original_name"],
        "mime": entry["mime"],
        "ext": entry["ext"],
        "size": entry["size"],
        "scanned": scan_result.scanned,
        "scan_reason": scan_result.reason,
    }
