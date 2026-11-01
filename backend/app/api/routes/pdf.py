"""API routes: PDF toolkit (async via job queue)."""

import os
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from app.storage import storage
from app.jobs import enqueue, get_job
from app.config import OUTPUT_DIR

router = APIRouter(tags=["pdf"])


def _require_file(file_id: str):
    p = storage.read_file(file_id)
    if not p:
        raise HTTPException(status_code=404, detail="File not found")
    return p


def _new_id() -> str:
    import secrets
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
def pdf_merge(req: MergeRequest):
    for fid in req.file_ids:
        _require_file(fid)
    job_id = enqueue("pdf_tool", "merge", file_ids=req.file_ids)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/split")
def pdf_split(req: SplitRequest):
    _require_file(req.file_id)
    job_id = enqueue("pdf_tool", "split", file_id=req.file_id, pages=req.pages, ranges=req.ranges)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/rotate")
def pdf_rotate(req: RotateRequest):
    _require_file(req.file_id)
    job_id = enqueue("pdf_tool", "rotate", file_id=req.file_id, rotations=req.rotations)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/rearrange")
def pdf_rearrange(req: RearrangeRequest):
    _require_file(req.file_id)
    job_id = enqueue("pdf_tool", "rearrange", file_id=req.file_id, order=req.order)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/extract-pages")
def pdf_extract_pages(req: ExtractPagesRequest):
    _require_file(req.file_id)
    job_id = enqueue("pdf_tool", "extract_pages", file_id=req.file_id, pages=req.pages)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/delete-pages")
def pdf_delete_pages(req: DeletePagesRequest):
    _require_file(req.file_id)
    job_id = enqueue("pdf_tool", "delete_pages", file_id=req.file_id, pages=req.pages)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/watermark")
def pdf_watermark(req: WatermarkRequest):
    _require_file(req.file_id)
    job_id = enqueue("pdf_tool", "watermark", file_id=req.file_id, text=req.text)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/page-numbers")
def pdf_page_numbers(req: PageNumbersRequest):
    _require_file(req.file_id)
    job_id = enqueue("pdf_tool", "page_numbers", file_id=req.file_id, position=req.position)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/header-footer")
def pdf_header_footer(req: HeaderFooterRequest):
    _require_file(req.file_id)
    job_id = enqueue("pdf_tool", "header_footer", file_id=req.file_id, header=req.header, footer=req.footer)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/extract-text")
def pdf_extract_text(file_id: str = Form(...)):
    _require_file(file_id)
    job_id = enqueue("pdf_tool", "extract_text", file_id=file_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/extract-images")
def pdf_extract_images(file_id: str = Form(...)):
    _require_file(file_id)
    job_id = enqueue("pdf_tool", "extract_images", file_id=file_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/metadata")
def pdf_metadata(req: MetadataRequest):
    _require_file(req.file_id)
    # metadata is synchronous (fast); keep inline
    src = str(_require_file(req.file_id))
    out_id = _new_id()
    out_path = str(Path(OUTPUT_DIR) / f"{out_id}.pdf")
    from app import pdf_tools
    res = pdf_tools.set_metadata(src, out_path, req.metadata)
    if not res.ok:
        raise HTTPException(status_code=422, detail=res.error)
    storage.save_output(out_id, open(out_path, "rb").read(), "pdf")
    return {"id": out_id, "ext": "pdf"}


@router.get("/pdf/metadata/{file_id}")
def pdf_get_metadata(file_id: str):
    src = str(_require_file(file_id))
    from app import pdf_tools
    return pdf_tools.get_metadata(src)


@router.get("/pdf/encrypted/{file_id}")
def pdf_encrypted(file_id: str):
    src = str(_require_file(file_id))
    from app import pdf_tools
    return {"encrypted": pdf_tools.is_encrypted(src)}


@router.post("/pdf/protect")
def pdf_protect(req: ProtectRequest):
    _require_file(req.file_id)
    job_id = enqueue("pdf_tool", "protect", file_id=req.file_id, password=req.password)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/unlock")
def pdf_unlock(req: UnlockRequest):
    _require_file(req.file_id)
    job_id = enqueue("pdf_tool", "unlock", file_id=req.file_id, password=req.password)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/compress")
def pdf_compress(file_id: str = Form(...)):
    _require_file(file_id)
    job_id = enqueue("pdf_tool", "compress", file_id=file_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/repair")
def pdf_repair(file_id: str = Form(...)):
    _require_file(file_id)
    job_id = enqueue("pdf_tool", "repair", file_id=file_id)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/ocr")
def pdf_ocr(file_id: str = Form(...), lang: str = Form("eng")):
    _require_file(file_id)
    job_id = enqueue("pdf_tool", "ocr", file_id=file_id, lang=lang)
    return {"job_id": job_id, "status": "queued"}


@router.post("/pdf/images-to-pdf")
def pdf_images_to_pdf(files: List[UploadFile] = File(...)):
    import tempfile
    paths = []
    for f in files:
        content = f.read()
        p = Path(tempfile.gettempdir()) / f"ud_{os.urandom(8).hex()}_{f.filename}"
        p.write_bytes(content)
        paths.append(str(p))
    job_id = enqueue("pdf_tool", "images_to_pdf", paths=paths)
    return {"job_id": job_id, "status": "queued"}


@router.get("/jobs/{job_id}")
def job_status(job_id: str):
    return get_job(job_id)
