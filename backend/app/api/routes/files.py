"""API routes: file management (metadata, download URLs, delete)."""

from fastapi import APIRouter, HTTPException, Depends
from app.storage import storage
from app.api.routes.auth import get_current_user

router = APIRouter(tags=["files"])


@router.get("/files/{file_id}/download")
async def get_file_download_url(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return a (possibly signed) URL for downloading a file."""
    entry = await storage.get_file_entry(file_id, user_id=current_user["username"])
    if not entry:
        raise HTTPException(status_code=404, detail="File not found")
    url = await storage.get_download_url(file_id)
    return {"url": url}


@router.get("/files/{file_id}")
async def get_file_metadata(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get file metadata."""
    entry = await storage.get_file_entry(file_id, user_id=current_user["username"])
    if not entry:
        raise HTTPException(status_code=404, detail="File not found")
    return entry


@router.delete("/files/{file_id}")
async def delete_file_endpoint(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a file."""
    removed = await storage.delete_file(file_id, user_id=current_user["username"])
    if not removed:
        raise HTTPException(status_code=404, detail="File not found")
    return {"detail": "File deleted"}
