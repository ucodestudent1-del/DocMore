"""API routes: authentication (register, login, me, verify-email, password-reset)."""

from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr

from app.auth import (
    create_access_token,
    verify_password,
    get_current_user,
    get_current_user_optional,
    create_user,
    get_user_by_username,
    get_user_by_email,
    verify_email_token,
    generate_email_verification,
    create_password_reset_token,
    verify_password_reset_token,
    reset_password_with_token,
    change_password,
    update_user_profile,
    require_admin,
)

router = APIRouter(tags=["auth"])


class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    tier: str = "free"


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    tier: str
    role: str
    is_verified: bool


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    username: str


class RequestPasswordReset(BaseModel):
    username: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UpdateProfileRequest(BaseModel):
    email: Optional[EmailStr] = None
    tier: Optional[str] = None


@router.post("/register", response_model=UserOut)
async def register(user: UserRegister):
    created = await create_user(user.username, user.email, user.password, user.tier)
    if created is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered",
        )
    return UserOut(
        id=created["id"],
        username=created["username"],
        email=created["email"],
        tier=created["tier"],
        role=created["role"],
        is_verified=created["is_verified"],
    )


@router.post("/token", response_model=Token)
async def login(user: UserLogin):
    db_user = get_user_by_username(user.username)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return UserOut(
        id=current_user["id"],
        username=current_user["username"],
        email=current_user["email"],
        tier=current_user["tier"],
        role=current_user["role"],
        is_verified=current_user["is_verified"],
    )


@router.post("/verify-email")
async def verify_email(req: VerifyEmailRequest):
    """Verify email verification token."""
    success = verify_email_token(req.token)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )
    return {"detail": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(req: ResendVerificationRequest):
    """Resend email verification token."""
    token = generate_email_verification(req.username)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found or already verified",
        )
    return {"detail": "Verification email sent"}


@router.post("/request-password-reset")
async def request_password_reset(req: RequestPasswordReset):
    """Request a password reset token."""
    token = create_password_reset_token(req.username)
    if token:
        user = get_user_by_email(req.username)
        if user:
            # In a real app, send email here
            pass
    return {"detail": "If an account exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """Reset password using reset token."""
    success = reset_password_with_token(req.token, req.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )
    return {"detail": "Password reset successfully"}


@router.post("/change-password")
async def change_password_endpoint(
    req: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """Change password after verifying current password."""
    success = change_password(current_user["username"], req.current_password, req.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    return {"detail": "Password changed successfully"}


@router.put("/me", response_model=UserOut)
async def update_profile(
    req: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update user profile."""
    updated = update_user_profile(
        current_user["username"],
        email=req.email,
        tier=req.tier,
    )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not update profile",
        )
    return UserOut(
        id=updated["id"],
        username=updated["username"],
        email=updated["email"],
        tier=updated["tier"],
        role=updated["role"],
        is_verified=updated["is_verified"],
    )


@router.delete("/me")
async def delete_account(current_user: dict = Depends(get_current_user)):
    """Delete the current user account."""
    username = current_user["username"]
    if username in _USERS:
        del _USERS[username]
    return {"detail": "Account deleted successfully"}