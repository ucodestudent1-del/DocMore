"""API routes: file download."""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from app.storage import storage
from app.api.routes.auth import get_current_user_optional

router = APIRouter(tags=["download"])


@router.get("/download/{file_id}")
async def download_file(file_id: str, current_user: dict | None = Depends(get_current_user_optional)):
    path = await storage.read_file(file_id)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    # Verify the user owns this file if authenticated
    if current_user:
        entry = await storage.get_file_entry(file_id, current_user["username"])
        if not entry:
            raise HTTPException(status_code=403, detail="Not authorized to access this file")
    return FileResponse(path, filename=path.name)
