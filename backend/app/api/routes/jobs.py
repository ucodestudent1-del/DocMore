"""API routes: generic job status."""

from fastapi import APIRouter
from app.jobs import get_job, list_jobs

router = APIRouter(tags=["jobs"])


@router.get("/jobs/{job_id}")
def job_status(job_id: str):
    return get_job(job_id)


@router.get("/jobs")
def list_jobs_endpoint(limit: int = 50):
    return {"jobs": list_jobs(limit=limit)}
