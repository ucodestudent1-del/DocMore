"""Rate limiting for subscription tiers."""

import time
import threading
from typing import Dict, List, Optional
from app.config import DATA_DIR
from app.models import user_store

# In-memory rate limit store: {user_id: [timestamps]}
_rate_limit_store: Dict[str, List[float]] = {}
_lock = threading.Lock()

import threading


def check_rate_limit(username: str) -> tuple[bool, str]:
    """Check if user has exceeded rate limits. Returns (allowed, message)."""
    if not username:
        return True, ""  # No auth = no rate limit (but upload requires auth now anyway)

    user_tier = user_store.get_tier(username)
    limits = user_store.get_tier_limits(username)
    max_uploads = limits["max_file_size_mb"]  # We'll track per-minute instead

    # Simple rate limit: 10 requests per minute for free, 100 for premium, 1000 for enterprise
    tier_limits = {
        "free": 10,
        "premium": 100,
        "enterprise": 1000,
    }
    max_requests = tier_limits.get(user_tier, 10)

    now = time.time()
    window = 60  # 1 minute window

    with _lock:
        if username not in _rate_limit_store:
            _rate_limit_store[username] = []

        # Clean old timestamps
        _rate_limit_store[username] = [t for t in _rate_limit_store[username] if now - t < window]

        if len(_rate_limit_store[username]) >= max_requests:
            return False, f"Rate limit exceeded. {user_tier} tier allows {max_requests} requests per minute."

        _rate_limit_store[username].append(now)
        return True, ""


def check_rate_limit_dependency(username: Optional[str]):
    """FastAPI dependency that enforces rate limits."""
    if username:
        allowed, message = check_rate_limit(username)
        if not allowed:
            from fastapi import HTTPException
            raise HTTPException(status_code=429, detail=message)
