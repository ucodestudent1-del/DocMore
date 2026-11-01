"""User model and storage."""

import json
import threading
from pathlib import Path
from typing import Dict, Optional

from app.config import DATA_DIR
from app.auth import hash_password

USERS_FILE = DATA_DIR / "users.json"

_lock = threading.Lock()

TIER_LIMITS = {
    "free": {
        "uploads_per_day": 10,
        "batch_max_files": 5,
        "max_file_size_mb": 10,
        "features": ["convert", "pdf_tools", "generate"],
    },
    "premium": {
        "uploads_per_day": 100,
        "batch_max_files": 50,
        "max_file_size_mb": 100,
        "features": ["convert", "pdf_tools", "generate", "ocr", "batch"],
    },
    "enterprise": {
        "uploads_per_day": 1000,
        "batch_max_files": 500,
        "max_file_size_mb": 1000,
        "features": ["convert", "pdf_tools", "generate", "ocr", "batch", "batch_priority"],
    },
}


class UserStore:
    def __init__(self) -> None:
        self._users: Dict[str, dict] = self._load_users()

    def _load_users(self) -> Dict[str, dict]:
        if USERS_FILE.exists():
            try:
                return json.loads(USERS_FILE.read_text(encoding="utf-8"))
            except Exception:
                return {}
        return {}

    def _save_users(self) -> None:
        tmp = USERS_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(self._users, indent=2), encoding="utf-8")
        tmp.replace(USERS_FILE)

    def get_user(self, username: str) -> Optional[dict]:
        with _lock:
            return self._users.get(username)

    def create_user(self, username: str, email: str, password: str, tier: str = "free") -> Optional[dict]:
        with _lock:
            if username in self._users:
                return None
            self._users[username] = {
                "username": username,
                "email": email,
                "hashed_password": hash_password(password),
                "tier": tier,
                "created_at": __import__("time").time(),
            }
            self._save_users()
            return self._users[username]

    def get_tier(self, username: str) -> str:
        with _lock:
            user = self._users.get(username)
            if user:
                return user.get("tier", "free")
            return "free"

    def get_tier_limits(self, username: str) -> dict:
        tier = self.get_tier(username)
        return TIER_LIMITS.get(tier, TIER_LIMITS["free"])


user_store = UserStore()
