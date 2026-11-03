"""API routes: file upload."""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.storage import storage
from app.api.routes.auth import get_current_user_optional
from app.rate_limiter import check_rate_limit_dependency

router = APIRouter(tags=["upload"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict | None = Depends(get_current_user_optional),
):
    user_id = current_user["username"] if current_user else None
    if user_id:
        await check_rate_limit_dependency(user_id)
    content = await file.read()
    try:
        entry = storage.save_upload(
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
    }
