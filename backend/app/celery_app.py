"""Celery application (optional; only used when Redis is available)."""

from celery import Celery
from app.config import REDIS_URL, CELERY_RESULT_BACKEND

broker = REDIS_URL or "redis://localhost:6379/0"
backend = CELERY_RESULT_BACKEND or "redis://localhost:6379/0"

celery_app = Celery("udstudio", broker=broker, backend=backend)
celery_app.conf.task_acks_late = True
celery_app.conf.task_time_limit = 600
celery_app.conf.worker_prefetch_multiplier = 1

# Import tasks so they're registered.
import app.tasks  # noqa: F401
