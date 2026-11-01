"""API routes: authentication (register, login, me)."""

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.auth import create_access_token, verify_password
from app.models import user_store

router = APIRouter(tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


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


class UserInDB(UserOut):
    hashed_password: str


async def get_current_user(token: str = Depends(oauth2_scheme)) -> Optional[UserOut]:
    if token is None:
        return None
    from app.auth import verify_token
    username = verify_token(token)
    if username is None:
        return None
    user = user_store.get_user(username)
    if user is None:
        return None
    return UserOut(username=user["username"], email=user["email"])


@router.post("/register", response_model=UserOut)
def register(user: UserRegister):
    created = user_store.create_user(user.username, user.email, user.password, user.tier)
    if created is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    return UserOut(username=created["username"], email=created["email"], tier=created.get("tier", "free"))


@router.post("/token", response_model=Token)
def login(user: UserLogin):
    db_user = user_store.get_user(user.username)
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
def read_users_me(current_user: Optional[UserOut] = Depends(get_current_user)):
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Get tier from user store
    user = user_store.get_user(current_user.username)
    tier = user.get("tier", "free") if user else "free"
    return UserOut(username=current_user.username, email=current_user.email, tier=tier)
