"""API routes: file upload."""

from fastapi import APIRouter, UploadFile, File, HTTPException
from app.storage import storage

router = APIRouter(tags=["upload"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    entry = storage.save_upload(content, file.filename or "file")
    return {
        "id": entry["id"],
        "original_name": entry["original_name"],
        "mime": entry["mime"],
        "ext": entry["ext"],
        "size": entry["size"],
    }
