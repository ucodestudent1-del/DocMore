"""Rate limiting for subscription tiers.

Uses Redis when available (production), falls back to in-memory store (development).
"""

import time
import threading
from typing import Dict, List, Optional

from app.config import REDIS_URL
from app.database import async_session
from app.models import User
from sqlalchemy import select


# In-memory rate limit store: {user_id: [timestamps]}
_rate_limit_store: Dict[str, List[float]] = {}
_lock = threading.Lock()

# Redis client (lazy init)
_redis_client = None


def _get_redis():
    """Get or create a Redis client."""
    global _redis_client
    if _redis_client is not False:  # False means "tried and failed"
        if _redis_client is None:
            try:
                import redis
                _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
                # Test connection
                _redis_client.ping()
            except Exception:
                _redis_client = False  # Mark as unavailable
        return _redis_client if _redis_client is not False else None
    return None


def _redis_key(username: str) -> str:
    return f"rate_limit:{username}"


async def _get_tier_from_db(username: str) -> str:
    """Look up user tier from the database."""
    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        return user.tier if user else "free"


async def check_rate_limit(username: str) -> tuple[bool, str]:
    """Check if user has exceeded rate limits. Returns (allowed, message)."""
    if not username:
        return True, ""  # No auth = no rate limit

    user_tier = await _get_tier_from_db(username)

    tier_limits = {
        "free": 100,
        "premium": 500,
        "enterprise": 5000,
    }
    max_requests = tier_limits.get(user_tier, 10)

    now = time.time()
    window = 60  # 1 minute window

    # Try Redis first
    redis_client = _get_redis()
    if redis_client is not None:
        try:
            key = _redis_key(username)
            # Remove old timestamps
            redis_client.zremrangebyscore(key, 0, now - window)
            count = redis_client.zcard(key)

            if count >= max_requests:
                return False, f"Rate limit exceeded. {user_tier} tier allows {max_requests} requests per minute."

            redis_client.zadd(key, {str(now): now})
            redis_client.expire(key, window + 1)
            return True, ""
        except Exception:
            # Fall through to in-memory
            pass

    # In-memory fallback
    with _lock:
        if username not in _rate_limit_store:
            _rate_limit_store[username] = []

        # Clean old timestamps
        _rate_limit_store[username] = [t for t in _rate_limit_store[username] if now - t < window]

        if len(_rate_limit_store[username]) >= max_requests:
            return False, f"Rate limit exceeded. {user_tier} tier allows {max_requests} requests per minute."

        _rate_limit_store[username].append(now)
        return True, ""


async def check_rate_limit_dependency(username: Optional[str]):
    """FastAPI dependency that enforces rate limits."""
    if username:
        allowed, message = await check_rate_limit(username)
        if not allowed:
            from fastapi import HTTPException
            raise HTTPException(status_code=429, detail=message)
