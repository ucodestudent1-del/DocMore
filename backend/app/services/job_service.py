"""Job service skeleton.

Wraps the background job system in app/jobs.py behind a stable interface.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from app.jobs import enqueue as _enqueue
from app.jobs import get_job as _get_job
from app.jobs import list_jobs as _list_jobs


class JobService:
    def enqueue(
        self,
        task_name: str,
        *args,
        job_id: Optional[str] = None,
        user_id: Optional[str] = None,
        **kwargs,
    ) -> str:
        if job_id:
            kwargs["job_id"] = job_id
        if user_id:
            kwargs["user_id"] = user_id
        return _enqueue(task_name, *args, **kwargs)

    def get_job(self, job_id: str) -> Dict[str, Any]:
        return _get_job(job_id)

    def list_jobs(self, limit: int = 50) -> list:
        return _list_jobs(limit)
