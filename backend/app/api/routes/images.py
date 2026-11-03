"""API routes: image processing (async via job queue)."""

import secrets
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from pydantic import BaseModel

from app.storage import storage
from app.jobs import enqueue
from app.api.routes.auth import get_current_user_optional

router = APIRouter(tags=["images"])


def _require_file(file_id: str, current_user: dict | None):
    p = storage.read_file(file_id)
    if not p:
        raise HTTPException(status_code=404, detail="File not found")
    if current_user:
        entry = storage.get_file_entry(file_id, current_user["username"])
        if not entry:
            raise HTTPException(status_code=403, detail="Not authorized to access this file")
    return p


def _new_id() -> str:
    return secrets.token_urlsafe(16)


class ConvertImageRequest(BaseModel):
    file_id: str
    target_format: str
    quality: int = 85


class ResizeImageRequest(BaseModel):
    file_id: str
    width: Optional[int] = None
    height: Optional[int] = None
    fit: str = "cover"
    quality: int = 85


class CompressImageRequest(BaseModel):
    file_id: str
    quality: int = 60


class RotateImageRequest(BaseModel):
    file_id: str
    degrees: int
    expand: bool = True
    quality: int = 85


class ImagesToPdfRequest(BaseModel):
    file_ids: List[str]
    page_size: str = "letter"
    quality: int = 85


@router.post("/images/convert")
async def images_convert(
    req: ConvertImageRequest,
    current_user: dict | None = Depends(get_current_user_optional),
):
    user_id = current_user["username"] if current_user else None
    _require_file(req.file_id, current_user)
    job_id = enqueue(
        "image_convert",
        file_id=req.file_id,
        target_format=req.target_format,
        quality=req.quality,
        user_id=user_id,
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/images/resize")
async def images_resize(
    req: ResizeImageRequest,
    current_user: dict | None = Depends(get_current_user_optional),
):
    user_id = current_user["username"] if current_user else None
    _require_file(req.file_id, current_user)
    job_id = enqueue(
        "image_resize",
        file_id=req.file_id,
        width=req.width,
        height=req.height,
        fit=req.fit,
        quality=req.quality,
        user_id=user_id,
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/images/compress")
async def images_compress(
    req: CompressImageRequest,
    current_user: dict | None = Depends(get_current_user_optional),
):
    user_id = current_user["username"] if current_user else None
    _require_file(req.file_id, current_user)
    job_id = enqueue(
        "image_compress",
        file_id=req.file_id,
        quality=req.quality,
        user_id=user_id,
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/images/rotate")
async def images_rotate(
    req: RotateImageRequest,
    current_user: dict | None = Depends(get_current_user_optional),
):
    user_id = current_user["username"] if current_user else None
    _require_file(req.file_id, current_user)
    job_id = enqueue(
        "image_rotate",
        file_id=req.file_id,
        degrees=req.degrees,
        expand=req.expand,
        quality=req.quality,
        user_id=user_id,
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/images/to-pdf")
async def images_to_pdf(
    req: ImagesToPdfRequest,
    current_user: dict | None = Depends(get_current_user_optional),
):
    user_id = current_user["username"] if current_user else None
    for fid in req.file_ids:
        _require_file(fid, current_user)
    job_id = enqueue(
        "image_to_pdf",
        file_ids=req.file_ids,
        page_size=req.page_size,
        quality=req.quality,
        user_id=user_id,
    )
    return {"job_id": job_id, "status": "queued"}


@router.post("/images/upload")
async def images_upload(
    files: List[UploadFile] = File(...),
    current_user: dict | None = Depends(get_current_user_optional),
):
    """Upload image files directly (for processing)."""
    user_id = current_user["username"] if current_user else None
    uploaded = []
    for f in files:
        content = await f.read()
        entry = await storage.save_upload(content, f.filename or "file", user_id=user_id)
        uploaded.append(entry)
    return {"files": uploaded}


@router.get("/images/formats")
def images_formats():
    """List supported image input/output formats."""
    from app.image_tools import SAVE_FORMATS, READ_FORMATS
    return {
        "input": sorted(READ_FORMATS),
        "output": sorted(SAVE_FORMATS.keys()),
    }
