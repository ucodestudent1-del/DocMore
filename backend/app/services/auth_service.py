"""Authentication service skeleton.

Wraps existing auth logic in app/auth.py behind a stable interface so it
can be extracted into a dedicated Auth microservice later.
"""

from __future__ import annotations

from typing import Optional

from app.auth import (
    authenticate_user as _authenticate_user,
    create_access_token as _create_access_token,
    create_user as _create_user,
    get_user_by_email as _get_user_by_email,
    get_user_by_username as _get_user_by_username,
    hash_password as _hash_password,
    verify_password as _verify_password,
)


class AuthService:
    def register(self, username: str, email: str, password: str, tier: str = "free") -> Optional[dict]:
        return _create_user(username, email, password, tier)

    def authenticate(self, username: str, password: str) -> Optional[dict]:
        user = _get_user_by_username(username)
        if user is None:
            return None
        if not _verify_password(password, user["hashed_password"]):
            return None
        return user

    def create_access_token(self, username: str, expires_minutes: Optional[int] = None) -> str:
        from datetime import timedelta
        from app.auth import create_access_token as _cat
        if expires_minutes:
            return _cat(data={"sub": username}, expires_delta=timedelta(minutes=expires_minutes))
        return _cat(data={"sub": username})

    def get_user_by_username(self, username: str) -> Optional[dict]:
        return _get_user_by_username(username)

    def get_user_by_email(self, email: str) -> Optional[dict]:
        return _get_user_by_email(email)

    def hash_password(self, password: str) -> str:
        return _hash_password(password)
