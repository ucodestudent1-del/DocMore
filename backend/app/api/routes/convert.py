"""API routes: conversion (async via job queue)."""

from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from app.storage import storage
from app.registry import registry
from app.jobs import enqueue, get_job
from app.api.routes.auth import get_current_user
from app.rate_limiter import check_rate_limit_dependency

router = APIRouter(tags=["convert"])


class ConvertRequest(BaseModel):
    file_id: str
    target: str
    options: dict = {}


@router.post("/convert")
async def convert_file(
    req: ConvertRequest,
    current_user: dict = Depends(get_current_user),
):
    check_rate_limit_dependency(current_user["username"])
    source = storage.read_file(req.file_id)
    if not source:
        raise HTTPException(status_code=404, detail="File not found")
    source_ext = source.suffix.lower().lstrip(".")
    target = req.target.lower().lstrip(".")
    if not registry.can_convert(source_ext, target):
        raise HTTPException(
            status_code=400,
            detail=f"Conversion {source_ext} -> {target} not supported",
        )
    job_id = enqueue(
        "convert",
        req.file_id,
        target,
        req.options,
        user_id=current_user["username"],
    )
    return {"job_id": job_id, "status": "queued"}


@router.get("/convert/jobs/{job_id}")
async def convert_job_status(job_id: str):
    return get_job(job_id)
