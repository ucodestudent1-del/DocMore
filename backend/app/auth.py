"""Authentication utilities: password hashing, JWT tokens, current user dependency."""

import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.database import async_session
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


def hash_password(password: str) -> str:
    """Hash a password using bcrypt. bcrypt limits passwords to 72 bytes."""
    pwd = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pwd, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a bcrypt hash."""
    try:
        pwd = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(pwd, hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return username
    except JWTError:
        return None


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[dict]:
    """Get user by username from database."""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        return None
    return {
        "username": user.username,
        "email": user.email,
        "tier": user.tier,
        "hashed_password": user.hashed_password,
    }


async def create_user(username: str, email: str, password: str, tier: str = "free") -> Optional[dict]:
    """Create a new user in the database."""
    async with async_session() as db:
        # Check if user already exists
        result = await db.execute(select(User).where(User.username == username))
        if result.scalar_one_or_none():
            return None
        
        hashed_password = hash_password(password)
        user = User(username=username, email=email, hashed_password=hashed_password, tier=tier)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return {
            "username": user.username,
            "email": user.email,
            "tier": user.tier,
            "hashed_password": user.hashed_password,
        }


async def get_tier(username: str) -> str:
    """Get user tier from database."""
    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if user:
            return user.tier
        return "free"


async def get_tier_limits(username: str) -> dict:
    """Get tier limits from database."""
    from app.models import TIER_LIMITS
    tier = await get_tier(username)
    return TIER_LIMITS.get(tier, TIER_LIMITS["free"])


async def get_current_user_optional(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[dict]:
    """Return the current user if authenticated, otherwise None."""
    if token is None:
        return None
    username = verify_token(token)
    if username is None:
        return None
    async with async_session() as db:
        user = await get_user_by_username(db, username)
        if user is None:
            return None
        return {
            "username": user["username"],
            "email": user["email"],
            "tier": user["tier"],
        }


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    """Require authentication. Raises 401 if not authenticated."""
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    username = verify_token(token)
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    async with async_session() as db:
        user = await get_user_by_username(db, username)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return {
            "username": user["username"],
            "email": user["email"],
            "tier": user["tier"],
        }