"""API routes: authentication (register, login, me)."""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr

from app.auth import (
    create_access_token,
    verify_password,
    get_current_user,
    get_current_user_optional,
    create_user,
    get_user_by_username,
)
from app.database import async_session
from app.models import User
from sqlalchemy import select

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
    username: str
    email: str
    tier: str


@router.post("/register", response_model=UserOut)
async def register(user: UserRegister):
    created = await create_user(user.username, user.email, user.password, user.tier)
    if created is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    return UserOut(username=created["username"], email=created["email"], tier=created.get("tier", "free"))


@router.post("/token", response_model=Token)
async def login(user: UserLogin):
    async with async_session() as db:
        db_user = await get_user_by_username(db, user.username)
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
    return UserOut(username=current_user["username"], email=current_user["email"], tier=current_user.get("tier", "free"))