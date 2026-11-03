"""API routes: document generation (async via job queue).

Endpoints:
  POST /api/generate                 - single document from blocks
  POST /api/generate/template        - single document from a named template
  POST /api/generate/batch           - batch: one document per data row
  GET  /api/generate/templates       - list template names
  GET  /api/generate/templates/{name}/placeholders  - extract {{placeholders}}
  GET  /api/generate/formats         - list supported export formats + fidelity
"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.services.generation_service import (
    service as gen_service,
    GenerationError,
    NATIVE_FORMATS,
    FIDELITY_NOTES,
)
from app.jobs import get_job
from app.api.routes.auth import get_current_user
from app.rate_limiter import check_rate_limit_dependency
from app.usage_service import usage_service

router = APIRouter(tags=["generate"])


class BlockIn(BaseModel):
    type: str
    data: dict = {}


class GenerateRequest(BaseModel):
    blocks: List[BlockIn]
    format: str = "pdf"
    page_size: str = "letter"
    orientation: str = "portrait"
    margins: Optional[dict] = None
    data: Optional[dict] = None


class TemplateRequest(BaseModel):
    name: str
    data: Optional[dict] = None
    format: str = "pdf"


class BatchRequest(BaseModel):
    template: str
    rows: List[dict]
    format: str = "pdf"
    page_size: str = "letter"
    orientation: str = "portrait"
    margins: Optional[dict] = None


class BatchCsvRequest(BaseModel):
    template: str
    csv: str
    format: str = "pdf"
    page_size: str = "letter"
    orientation: str = "portrait"
    margins: Optional[dict] = None


class BatchJsonRequest(BaseModel):
    template: str
    json: str
    format: str = "pdf"
    page_size: str = "letter"
    orientation: str = "portrait"
    margins: Optional[dict] = None


class FormatOut(BaseModel):
    format: str
    status: str
    notes: str


@router.post("/generate")
async def generate_document(
    req: GenerateRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["username"]
    await check_rate_limit_dependency(user_id)
    await usage_service.check_conversion_quota(user_id)
    await usage_service.check_concurrent_job_quota(user_id)

    try:
        job_id = gen_service.enqueue_generate(
            blocks=[b.model_dump() for b in req.blocks],
            fmt=req.format,
            data=req.data,
            page_size=req.page_size,
            orientation=req.orientation,
            margins=req.margins,
            user_id=current_user["username"],
        )
    except GenerationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"job_id": job_id, "status": "queued"}


@router.post("/generate/template")
async def generate_template(
    req: TemplateRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["username"]
    await check_rate_limit_dependency(user_id)
    await usage_service.check_conversion_quota(user_id)
    await usage_service.check_concurrent_job_quota(user_id)

    try:
        job_id = gen_service.enqueue_generate(
            blocks=[],  # filled from template inside enqueue path below
            fmt=req.format,
            data=req.data,
            page_size="letter",
            orientation="portrait",
            margins={},
            user_id=current_user["username"],
            template_name=req.name,
        )
    except GenerationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"job_id": job_id, "status": "queued", "template": req.name}


@router.post("/generate/batch")
async def generate_batch(
    req: BatchRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["username"]
    await check_rate_limit_dependency(user_id)
    await usage_service.check_conversion_quota(user_id)
    await usage_service.check_concurrent_job_quota(user_id)

    try:
        job_id = gen_service.enqueue_batch(
            template_name=req.template,
            rows=req.rows,
            fmt=req.format,
            page_size=req.page_size,
            orientation=req.orientation,
            margins=req.margins,
            user_id=current_user["username"],
        )
    except GenerationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"job_id": job_id, "status": "queued", "template": req.template, "count": len(req.rows)}


@router.post("/generate/batch/csv")
async def generate_batch_csv(
    req: BatchCsvRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["username"]
    await check_rate_limit_dependency(user_id)
    await usage_service.check_conversion_quota(user_id)
    await usage_service.check_concurrent_job_quota(user_id)

    try:
        rows = gen_service.parse_csv_batch(req.csv)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {exc}")
    try:
        job_id = gen_service.enqueue_batch(
            template_name=req.template,
            rows=rows,
            fmt=req.format,
            page_size=req.page_size,
            orientation=req.orientation,
            margins=req.margins,
            user_id=current_user["username"],
        )
    except GenerationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"job_id": job_id, "status": "queued", "template": req.template, "count": len(rows)}


@router.post("/generate/batch/json")
async def generate_batch_json(
    req: BatchJsonRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["username"]
    await check_rate_limit_dependency(user_id)
    await usage_service.check_conversion_quota(user_id)
    await usage_service.check_concurrent_job_quota(user_id)

    try:
        rows = gen_service.parse_json_batch(req.json)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}")
    try:
        job_id = gen_service.enqueue_batch(
            template_name=req.template,
            rows=rows,
            fmt=req.format,
            page_size=req.page_size,
            orientation=req.orientation,
            margins=req.margins,
            user_id=current_user["username"],
        )
    except GenerationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"job_id": job_id, "status": "queued", "template": req.template, "count": len(rows)}


@router.get("/templates")
async def list_templates():
    from app.generation import TEMPLATES as GEN_TEMPLATES
    return {"templates": sorted(GEN_TEMPLATES.keys())}


@router.get("/templates/{name}/placeholders")
async def template_placeholders(name: str):
    from app.generation import TEMPLATES as GEN_TEMPLATES
    tpl = GEN_TEMPLATES.get(name)
    if not tpl:
        raise HTTPException(status_code=404, detail=f"Template {name} not found")
    blocks_in = [{"type": b["type"], "data": b["data"]} for b in tpl]
    placeholders = gen_service.extract_placeholders(blocks_in)
    return {"template": name, "placeholders": placeholders}


@router.get("/formats", response_model=List[FormatOut])
async def list_formats():
    formats = []
    for fmt in sorted(NATIVE_FORMATS | {"epub"}):
        formats.append(FormatOut(
            format=fmt,
            status=FIDELITY_NOTES.get(fmt, "done"),
            notes=FIDELITY_NOTES.get(fmt, ""),
        ))
    return formats


@router.get("/jobs/{job_id}")
async def generate_job_status(job_id: str):
    return get_job(job_id)
