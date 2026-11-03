"""Authentication utilities: password hashing, JWT tokens, current user dependency.

User accounts are stored in PostgreSQL (SQLAlchemy async).  The legacy in-memory
_USERS dict is removed; all lookups/mutations go through the database so the admin
panel, stats, and data isolation all operate on a single source of truth.
"""

import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.database import async_session, get_db
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


# ---------------------------------------------------------------------------
# Pure crypto helpers (no DB)
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
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


# ---------------------------------------------------------------------------
# DB-backed user store
# ---------------------------------------------------------------------------

def _user_to_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "hashed_password": user.hashed_password,
        "tier": user.tier,
        "role": user.role,
        "is_verified": user.is_verified,
        "created_at": user.created_at.timestamp() if user.created_at else None,
    }


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[dict]:
    """Get user by username from the database."""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    return _user_to_dict(user) if user else None


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[dict]:
    """Get user by email from the database."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    return _user_to_dict(user) if user else None


async def create_user(username: str, email: str, password: str, tier: str = "free") -> Optional[dict]:
    """Create a new user in the database."""
    async with async_session() as db:
        if await get_user_by_username(db, username):
            return None
        if await get_user_by_email(db, email):
            return None
        hashed_password = hash_password(password)
        user = User(
            username=username,
            email=email,
            hashed_password=hashed_password,
            tier=tier,
            role="user",
            is_verified=False,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return _user_to_dict(user)


async def get_tier(db: AsyncSession, username: str) -> str:
    """Get user tier from the database."""
    user = await get_user_by_username(db, username)
    if user:
        return user.get("tier", "free")
    return "free"


async def get_tier_limits(db: AsyncSession, username: str) -> dict:
    """Get tier limits for a user."""
    from app.models import TIER_LIMITS
    tier = await get_tier(db, username)
    return TIER_LIMITS.get(tier, TIER_LIMITS["free"])


async def update_user_profile(
    db: AsyncSession,
    username: str,
    **kwargs,
) -> Optional[dict]:
    """Update user profile fields. Self-service updates only allow email."""
    user_result = await db.execute(select(User).where(User.username == username))
    user = user_result.scalar_one_or_none()
    if user is None:
        return None
    new_email = kwargs.get("email")
    if new_email is not None and new_email != user.email:
        existing = await get_user_by_email(db, new_email)
        if existing and existing["username"] != username:
            return None
    # Only email is editable by the user themselves; tier/role are admin-only.
    if new_email is not None:
        user.email = new_email
    await db.commit()
    await db.refresh(user)
    return _user_to_dict(user)


async def change_password(
    db: AsyncSession,
    username: str,
    old_password: str,
    new_password: str,
) -> bool:
    """Change user password after verifying the current one."""
    user_result = await db.execute(select(User).where(User.username == username))
    user = user_result.scalar_one_or_none()
    if user is None:
        return False
    if not verify_password(old_password, user.hashed_password):
        return False
    user.hashed_password = hash_password(new_password)
    await db.commit()
    return True


async def reset_password_with_token(
    db: AsyncSession,
    token: str,
    new_password: str,
) -> bool:
    """Reset password using a password-reset JWT (subject is the email)."""
    email = verify_password_reset_token(token)
    if email is None:
        return False
    user = await get_user_by_email(db, email)
    if user is None:
        return False
    user_result = await db.execute(select(User).where(User.username == user["username"]))
    db_user = user_result.scalar_one_or_none()
    if db_user is None:
        return False
    db_user.hashed_password = hash_password(new_password)
    await db.commit()
    return True


async def delete_account(
    db: AsyncSession,
    username: str,
) -> None:
    """Delete a user account and cascade their uploads/outputs/jobs."""
    user_result = await db.execute(select(User).where(User.username == username))
    user = user_result.scalar_one_or_none()
    if user is None:
        return
    # Delete user's files from filesystem
    from app.storage import storage as st
    for entry in list(st._history):
        if entry.get("user_id") == username:
            st.delete_file(entry["id"])
    # Remove from history
    st._history = [e for e in st._history if e.get("user_id") != username]
    st._save_history()
    await db.delete(user)
    await db.commit()


# ---------------------------------------------------------------------------
# Email / password-reset tokens (pure JWT, no DB)
# ---------------------------------------------------------------------------

def verify_email_token(token: str) -> Optional[str]:
    """Verify email verification token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("email")
        if email is None:
            return None
        return email
    except JWTError:
        return None


def create_email_token(email: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create email verification token."""
    to_encode = {"email": email}
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_password_reset_token(email: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create password reset token."""
    to_encode = {"email": email}
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=1)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_password_reset_token(token: str) -> Optional[str]:
    """Verify password reset token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("email")
        if email is None:
            return None
        return email
    except JWTError:
        return None


def generate_email_verification(username: str, email: str) -> str:
    """Generate email verification token for a user."""
    return create_email_token(email, expires_delta=timedelta(hours=24))


def generate_password_reset(email: str) -> str:
    """Generate password reset token for a user."""
    return create_password_reset_token(email, expires_delta=timedelta(hours=1))


# ---------------------------------------------------------------------------
# Current-user dependencies (require DB session)
# ---------------------------------------------------------------------------

async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[dict]:
    """Return the current user if authenticated, otherwise None."""
    if token is None:
        return None
    username = verify_token(token)
    if username is None:
        return None
    return await get_user_by_username(db, username)


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict:
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
    user = await get_user_by_username(db, username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Require admin role (not merely enterprise tier)."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
