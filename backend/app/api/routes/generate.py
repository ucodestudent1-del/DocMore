"""API routes: document generation (async via job queue)."""

import secrets
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

from app.storage import storage
from app.generation import (
    render_blocks, HeadingBlock, ParagraphBlock, TableBlock,
    ListBlock, ImageBlock, PageBreakBlock, HorizontalRuleBlock,
    fill_placeholders,
)
from app.jobs import enqueue, get_job
from app.api.routes.auth import get_current_user

router = APIRouter(tags=["generate"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


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


BLOCK_MAP = {
    "heading": HeadingBlock,
    "paragraph": ParagraphBlock,
    "table": TableBlock,
    "list": ListBlock,
    "image": ImageBlock,
    "pagebreak": PageBreakBlock,
    "hr": HorizontalRuleBlock,
}


def _block_to_dict(b) -> dict:
    type_by_class = {
        "HeadingBlock": "heading",
        "ParagraphBlock": "paragraph",
        "TableBlock": "table",
        "ListBlock": "list",
        "ImageBlock": "image",
        "PageBreakBlock": "pagebreak",
        "HorizontalRuleBlock": "hr",
    }
    t = type_by_class.get(b.__class__.__name__, "paragraph")
    if t == "heading":
        data = {"text": getattr(b, "text", ""), "level": getattr(b, "level", 1)}
    elif t == "paragraph":
        data = {"text": getattr(b, "text", ""), "align": getattr(b, "align", "left")}
    elif t == "list":
        data = {"items": getattr(b, "items", []), "ordered": getattr(b, "ordered", False)}
    elif t == "table":
        data = {"rows": getattr(b, "rows", [])}
    elif t == "image":
        data = {"path": getattr(b, "path", ""), "width": getattr(b, "width", 4)}
    else:
        data = {}
    return {"type": t, "data": data}


def _blocks_to_dicts(blocks) -> list:
    return [_block_to_dict(b) for b in blocks]


def _to_blocks(blocks_in: List[BlockIn]) -> List:
    blocks = []
    for b in blocks_in:
        cls = BLOCK_MAP.get(b.type)
        if not cls:
            raise HTTPException(status_code=400, detail=f"Unknown block type {b.type}")
        blocks.append(cls(**b.data))
    return blocks


TEMPLATES: Dict[str, List[BlockIn]] = {
    "invoice": [
        BlockIn(type="heading", data={"text": "INVOICE", "level": 1}),
        BlockIn(type="paragraph", data={"text": "{{invoice_number}}", "align": "right"}),
        BlockIn(type="paragraph", data={"text": "Bill To: {{customer}}"}),
        BlockIn(type="table", data={"rows": [["Item", "Qty", "Price", "Total"], ["{{item}}", "{{qty}}", "{{price}}", "{{total}}"]]}),
        BlockIn(type="paragraph", data={"text": "Total Due: {{total_due}}", "align": "right"}),
    ],
    "business-letter": [
        BlockIn(type="heading", data={"text": "Business Letter", "level": 1}),
        BlockIn(type="paragraph", data={"text": "Dear {{recipient}},"}),
        BlockIn(type="paragraph", data={"text": "{{body}}"}),
        BlockIn(type="paragraph", data={"text": "Sincerely,\n{{sender}}"}),
    ],
    "resume": [
        BlockIn(type="heading", data={"text": "{{name}}", "level": 1}),
        BlockIn(type="paragraph", data={"text": "{{email}} | {{phone}} | {{location}}"}) ,
        BlockIn(type="heading", data={"text": "Experience", "level": 2}),
        BlockIn(type="list", data={"items": ["{{exp1}}", "{{exp2}"], "ordered": False}),
    ],
    "report": [
        BlockIn(type="heading", data={"text": "{{title}}", "level": 1}),
        BlockIn(type="paragraph", data={"text": "{{summary}}"}),
        BlockIn(type="heading", data={"text": "Findings", "level": 2}),
        BlockIn(type="list", data={"items": ["{{finding1}}", "{{finding2}}"]}),
    ],
    "certificate": [
        BlockIn(type="heading", data={"text": "Certificate of Completion", "level": 1}),
        BlockIn(type="paragraph", data={"text": "This is awarded to {{recipient}}"}),
        BlockIn(type="paragraph", data={"text": "for {{achievement}}"}),
        BlockIn(type="paragraph", data={"text": "Date: {{date}}"}),
    ],
    "cover-letter": [
        BlockIn(type="heading", data={"text": "Cover Letter", "level": 1}),
        BlockIn(type="paragraph", data={"text": "Dear {{hiring_manager}},"}),
        BlockIn(type="paragraph", data={"text": "{{body}}"}),
        BlockIn(type="paragraph", data={"text": "Best regards,\n{{sender}}"}),
    ],
    "meeting-minutes": [
        BlockIn(type="heading", data={"text": "Meeting Minutes", "level": 1}),
        BlockIn(type="paragraph", data={"text": "Meeting: {{meeting}} | Date: {{date}}"}),
        BlockIn(type="paragraph", data={"text": "Attendees: {{attendees}}"}) ,
        BlockIn(type="heading", data={"text": "Agenda", "level": 2}),
        BlockIn(type="list", data={"items": ["{{agenda1}}", "{{agenda2}}"]}),
    ],
}


@router.post("/generate")
def generate_document(
    req: GenerateRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    blocks = _to_blocks(req.blocks)
    if req.data:
        blocks = fill_placeholders(blocks, req.data)
    block_dicts = _blocks_to_dicts(blocks)
    job_id = enqueue("generate", block_dicts, req.format, req.data or {},
                     req.page_size, req.orientation, req.margins or {},
                     user_id=current_user.username if current_user else None)
    return {"job_id": job_id, "status": "queued"}


@router.post("/generate/template")
def generate_template(
    req: TemplateRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    name = req.name
    data = req.data
    tpl = TEMPLATES.get(name)
    if not tpl:
        raise HTTPException(status_code=404, detail=f"Template {name} not found")
    blocks = _to_blocks(tpl)
    if data:
        blocks = fill_placeholders(blocks, data)
    block_dicts = _blocks_to_dicts(blocks)
    fmt = req.format
    job_id = enqueue("generate", block_dicts, fmt, data or {},
                     "letter", "portrait", {},
                     user_id=current_user.username if current_user else None)
    return {"job_id": job_id, "status": "queued", "template": name}


@router.get("/templates")
def list_templates():
    return {"templates": list(TEMPLATES.keys())}
