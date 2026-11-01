"""API routes: file upload."""

from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from app.storage import storage
from app.api.routes.auth import get_current_user
from app.rate_limiter import check_rate_limit_dependency

router = APIRouter(tags=["upload"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: Optional[dict] = Depends(get_current_user),
):
    check_rate_limit_dependency(current_user.username if current_user else None)
    content = await file.read()
    try:
        entry = storage.save_upload(
            content, 
            file.filename or "file", 
            user_id=current_user.username if current_user else None
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
