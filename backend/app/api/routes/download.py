"""API routes: file download."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.storage import storage

router = APIRouter(tags=["download"])


@router.get("/download/{file_id}")
def download_file(file_id: str):
    path = storage.read_file(file_id)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=path.name)
