"""API routes: PDF toolkit (async via job queue)."""

import secrets
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel

from app.storage import storage
from app.jobs import enqueue
from app.config import OUTPUT_DIR
from app.api.routes.auth import get_current_user_optional

router = APIRouter(tags=["pdf"])


def _require_file(file_id: str, current_user: dict | None):
    p = storage.read_file(file_id)
    if not p:
        raise HTTPException(status_code=404, detail="File not found")
    # Verify the user owns this file if authenticated
    if current_user:
        entry = storage.get_file_entry(file_id, current_user["username"])
        if not entry:
            raise HTTPException(status_code=403, detail="Not authorized to access this file")
    return p


def _new_id() -> str:
    return secrets.token_urlsafe(16)


class MergeRequest(BaseModel):
    file_ids: List[str]


class SplitRequest(BaseModel):
    file_id: str
    pages: Optional[List[int]] = None
    ranges: Optional[str] = None


class RotateRequest(BaseModel):
    file_id: str
    rotations: dict


class RearrangeRequest(BaseModel):
    file_id: str
    order: List[int]


class ExtractPagesRequest(BaseModel):
    file_id: str
    pages: List[int]


class DeletePagesRequest(BaseModel):
    file_id: str
    pages: List[int]


class WatermarkRequest(BaseModel):
    file_id: str
    text: str


class PageNumbersRequest(BaseModel):
    file_id: str
    position: str = "bottom-right"


class HeaderFooterRequest(BaseModel):
    file_id: str
    header: str = ""
    footer: str = ""


class ProtectRequest(BaseModel):
    file_id: str
    password: str


class UnlockRequest(BaseModel):
    file_id: str
    password: str


class MetadataRequest(BaseModel):
    file_id: str
    metadata: dict


@router.post("/pdf/merge")
def pdf_merge(req: MergeRequest, current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    for fid in req.file_ids:
        _require_file(fid, current_user)
    job_id = enqueue("pdf_tool", "merge", file_ids=req.file_ids, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/split")
def pdf_split(req: SplitRequest, current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    _require_file(req.file_id, current_user)
    job_id = enqueue("pdf_tool", "split", file_id=req.file_id, pages=req.pages, ranges=req.ranges, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/rotate")
def pdf_rotate(req: RotateRequest, current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    _require_file(req.file_id, current_user)
    job_id = enqueue("pdf_tool", "rotate", file_id=req.file_id, rotations=req.rotations, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/rearrange")
def pdf_rearrange(req: RearrangeRequest, current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    _require_file(req.file_id, current_user)
    job_id = enqueue("pdf_tool", "rearrange", file_id=req.file_id, order=req.order, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/extract-pages")
def pdf_extract_pages(req: ExtractPagesRequest, current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    _require_file(req.file_id, current_user)
    job_id = enqueue("pdf_tool", "extract_pages", file_id=req.file_id, pages=req.pages, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/delete-pages")
def pdf_delete_pages(req: DeletePagesRequest, current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    _require_file(req.file_id, current_user)
    job_id = enqueue("pdf_tool", "delete_pages", file_id=req.file_id, pages=req.pages, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/watermark")
def pdf_watermark(req: WatermarkRequest, current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    _require_file(req.file_id, current_user)
    job_id = enqueue("pdf_tool", "watermark", file_id=req.file_id, text=req.text, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/page-numbers")
def pdf_page_numbers(req: PageNumbersRequest, current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    _require_file(req.file_id, current_user)
    job_id = enqueue("pdf_tool", "page_numbers", file_id=req.file_id, position=req.position, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/header-footer")
def pdf_header_footer(req: HeaderFooterRequest, current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    _require_file(req.file_id, current_user)
    job_id = enqueue("pdf_tool", "header_footer", file_id=req.file_id, header=req.header, footer=req.footer, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/extract-text")
def pdf_extract_text(file_id: str = Form(...), current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    _require_file(file_id, current_user)
    job_id = enqueue("pdf_tool", "extract_text", file_id=file_id, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/extract-images")
def pdf_extract_images(file_id: str = Form(...), current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    _require_file(file_id, current_user)
    job_id = enqueue("pdf_tool", "extract_images", file_id=file_id, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/metadata")
def pdf_metadata(req: MetadataRequest, current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    src = str(_require_file(req.file_id, current_user))
    out_id = _new_id()
    out_path = str(Path(OUTPUT_DIR) / f"{out_id}.pdf")
    from app import pdf_tools
    res = pdf_tools.set_metadata(src, out_path, req.metadata)
    if not res.ok:
        raise HTTPException(status_code=422, detail=res.error)
    with open(out_path, "rb") as f:
        data = f.read()
    storage.save_output(out_id, data, "pdf", user_id=user_id)
    return {"id": out_id, "ext": "pdf"}


@router.get("/pdf/metadata/{file_id}")
def pdf_get_metadata(file_id: str, current_user: dict | None = Depends(get_current_user_optional)):
    src = str(_require_file(file_id, current_user))
    from app import pdf_tools
    return pdf_tools.get_metadata(src)


@router.get("/pdf/encrypted/{file_id}")
def pdf_encrypted(file_id: str, current_user: dict | None = Depends(get_current_user_optional)):
    src = str(_require_file(file_id, current_user))
    from app import pdf_tools
    return {"encrypted": pdf_tools.is_encrypted(src)}


@router.post("/pdf/protect")
def pdf_protect(req: ProtectRequest, current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    _require_file(req.file_id, current_user)
    job_id = enqueue("pdf_tool", "protect", file_id=req.file_id, password=req.password, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/unlock")
def pdf_unlock(req: UnlockRequest, current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    _require_file(req.file_id, current_user)
    job_id = enqueue("pdf_tool", "unlock", file_id=req.file_id, password=req.password, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/compress")
def pdf_compress(file_id: str = Form(...), current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    _require_file(file_id, current_user)
    job_id = enqueue("pdf_tool", "compress", file_id=file_id, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/repair")
def pdf_repair(file_id: str = Form(...), current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    _require_file(file_id, current_user)
    job_id = enqueue("pdf_tool", "repair", file_id=file_id, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/ocr")
def pdf_ocr(file_id: str = Form(...), lang: str = Form("eng"), current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    _require_file(file_id, current_user)
    job_id = enqueue("pdf_tool", "ocr", file_id=file_id, lang=lang, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/images-to-pdf")
async def pdf_images_to_pdf(files: List[UploadFile] = File(...), current_user: dict | None = Depends(get_current_user_optional)):
    user_id = current_user["username"] if current_user else None
    paths = []
    for f in files:
        content = await f.read()
        entry = storage.save_upload(content, f.filename or "file", user_id=user_id)
        paths.append(entry["path"])
    job_id = enqueue("pdf_tool", "images_to_pdf", paths=paths, user_id=user_id)
    return {"job_id": job_id, "status": "queued"}
