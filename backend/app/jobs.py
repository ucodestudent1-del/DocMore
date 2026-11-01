"""Background job system: Celery with in-process fallback.

Jobs run through Celery when a Redis broker is available; otherwise they run
synchronously in-process via the same task registry. The API surface is
identical so the rest of the app doesn't care which backend is active.
"""

import os
import uuid
import threading
import time
from typing import Any, Callable, Dict, Optional

from app.config import REDIS_URL, CELERY_RESULT_BACKEND
from app.storage import storage

_task_registry: Dict[str, dict] = {}
_task_lock = threading.Lock()
_task_threads: Dict[str, threading.Thread] = {}


def _mark(job_id: str, **fields) -> None:
    with _task_lock:
        entry = _task_registry.setdefault(job_id, {"status": "pending", "progress": 0})
        entry.update(fields)
        entry["ts"] = time.time()


def _run_in_process(task_func: Callable, job_id: str, *args, **kwargs) -> Any:
    try:
        _mark(job_id, status="started", progress=5)
        result = task_func(*args, **kwargs)
        _mark(job_id, status="success", progress=100, result=result)
        return result
    except Exception as exc:  # noqa: BLE001
        _mark(job_id, status="failure", error=str(exc))
        raise


def enqueue(task_name: str, *args, **kwargs) -> str:
    """Enqueue a conversion/processing task. Returns a job id."""
    job_id = kwargs.pop("job_id", None) or uuid.uuid4().hex
    _mark(job_id, status="pending", progress=0, task=task_name)

    # Try Celery first if a broker is configured and importable.
    try:
        from app.celery_app import celery_app
        # Only dispatch if the broker is actually reachable; otherwise fall back.
        import socket
        from urllib.parse import urlparse
        broker = REDIS_URL or "redis://localhost:6379/0"
        parsed = urlparse(broker)
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
        s = socket.socket()
        s.settimeout(1.0)
        try:
            s.connect((host, port))
            s.close()
            celery_app.send_task(task_name, args=args, kwargs=kwargs, task_id=job_id)
            return job_id
        except OSError:
            s.close()
    except Exception:
        pass

    # In-process fallback: run in a background thread.
    from app import tasks
    task_func = getattr(tasks, task_name, None)
    if task_func is None:
        raise ValueError(f"Unknown task {task_name}")
    thread = threading.Thread(target=_run_in_process, args=(task_func, job_id) + args, kwargs=kwargs, daemon=True)
    _task_threads[job_id] = thread
    thread.start()
    return job_id


def get_job(job_id: str) -> dict:
    with _task_lock:
        entry = dict(_task_registry.get(job_id, {}))
    if not entry:
        return {"status": "unknown", "progress": 0}
    return entry


def list_jobs(limit: int = 50) -> list:
    with _task_lock:
        items = sorted(_task_registry.items(), key=lambda kv: kv[1].get("ts", 0), reverse=True)
    return [{"id": jid, **v} for jid, v in items[:limit]]
