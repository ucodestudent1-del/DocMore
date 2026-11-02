"""Authentication utilities: password hashing, JWT tokens, current user dependency, email verification, password reset."""

import bcrypt
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, FRONTEND_URL
from app.database import async_session
from app.models import User
from app.email import send_welcome_email, send_password_reset as send_password_reset_email, send_subscription_confirmation


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


def create_verification_token() -> str:
    """Create a random email verification token."""
    return secrets.token_urlsafe(32)


def create_reset_token() -> str:
    """Create a random password reset token."""
    return secrets.token_urlsafe(32)


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
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "tier": user.tier,
        "role": user.role,
        "is_verified": user.is_verified,
        "hashed_password": user.hashed_password,
    }


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[dict]:
    """Get user by email from database."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        return None
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "tier": user.tier,
        "role": user.role,
        "is_verified": user.is_verified,
        "hashed_password": user.hashed_password,
    }


async def create_user(username: str, email: str, password: str, tier: str = "free") -> Optional[dict]:
    """Create a new user in the database."""
    async with async_session() as db:
        # Check if user already exists
        result = await db.execute(select(User).where(User.username == username))
        if result.scalar_one_or_none():
            return None

        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            return None

        hashed_password = hash_password(password)
        verification_token = create_verification_token()
        user = User(
            username=username,
            email=email,
            hashed_password=hashed_password,
            tier=tier,
            is_verified=False,
            email_verification_token=verification_token,
            email_verification_expires=datetime.now(timezone.utc) + timedelta(hours=24),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "tier": user.tier,
            "role": user.role,
            "is_verified": user.is_verified,
            "hashed_password": user.hashed_password,
            "email_verification_token": verification_token,
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


async def verify_email_token(token: str) -> bool:
    """Verify an email verification token. Returns True if valid and verified."""
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email_verification_token == token))
        user = result.scalar_one_or_none()
        if user is None:
            return False
        if user.email_verification_expires and user.email_verification_expires < datetime.now(timezone.utc):
            return False
        user.is_verified = True
        user.email_verification_token = None
        user.email_verification_expires = None
        await db.commit()
        return True


async def generate_email_verification(username: str) -> Optional[str]:
    """Generate a new email verification token for a user. Returns the token."""
    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if user is None or user.is_verified:
            return None
        token = create_verification_token()
        user.email_verification_token = token
        user.email_verification_expires = datetime.now(timezone.utc) + timedelta(hours=24)
        await db.commit()
        return token


async def create_password_reset_token(username: str) -> Optional[str]:
    """Create a password reset token for a user. Returns the token."""
    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if user is None:
            return None
        token = create_reset_token()
        user.password_reset_token = token
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.commit()
        return token


async def verify_password_reset_token(token: str) -> Optional[str]:
    """Verify a password reset token. Returns username if valid, None otherwise."""
    async with async_session() as db:
        result = await db.execute(select(User).where(User.password_reset_token == token))
        user = result.scalar_one_or_none()
        if user is None:
            return None
        if user.password_reset_expires and user.password_reset_expires < datetime.now(timezone.utc):
            return None
        return user.username


async def reset_password_with_token(token: str, new_password: str) -> bool:
    """Reset password using a valid reset token. Returns True if successful."""
    username = await verify_password_reset_token(token)
    if username is None:
        return False
    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if user is None:
            return False
        user.hashed_password = hash_password(new_password)
        user.password_reset_token = None
        user.password_reset_expires = None
        await db.commit()
        return True


async def change_password(username: str, current_password: str, new_password: str) -> bool:
    """Change password after verifying current password. Returns True if successful."""
    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if user is None:
            return False
        if not verify_password(current_password, user.hashed_password):
            return False
        user.hashed_password = hash_password(new_password)
        user.password_reset_token = None
        user.password_reset_expires = None
        await db.commit()
        return True


async def update_user_profile(username: str, email: Optional[str] = None, tier: Optional[str] = None, role: Optional[str] = None) -> Optional[dict]:
    """Update user profile fields. Returns updated user dict or None."""
    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        if user is None:
            return None
        if email is not None:
            # Check email not taken by another user
            existing = await db.execute(select(User).where(User.email == email, User.username != username))
            if existing.scalar_one_or_none():
                return None
            user.email = email
        if tier is not None:
            user.tier = tier
        if role is not None:
            user.role = role
        await db.commit()
        await db.refresh(user)
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "tier": user.tier,
            "role": user.role,
            "is_verified": user.is_verified,
        }


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
        return user


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
        return user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Require admin role. Raises 403 if not admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
