"""Database models for Universal Document Studio.

Uses SQLAlchemy with async support for PostgreSQL.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict
from sqlalchemy import (
    Integer, String, DateTime, Text, ForeignKey, Numeric
)
from sqlalchemy.orm import DeclarativeBase, relationship, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


# Tier limits: {tier_name: {max_file_size_mb, max_conversions_per_hour, max_concurrent_jobs}}
TIER_LIMITS: Dict[str, dict] = {
    "free": {
        "max_file_size_mb": 10,
        "max_conversions_per_hour": 5,
        "max_concurrent_jobs": 1,
        "rate_limit_per_minute": 10,
    },
    "premium": {
        "max_file_size_mb": 50,
        "max_conversions_per_hour": 100,
        "max_concurrent_jobs": 5,
        "rate_limit_per_minute": 100,
    },
    "enterprise": {
        "max_file_size_mb": 100,
        "max_conversions_per_hour": 1000,
        "max_concurrent_jobs": 20,
        "rate_limit_per_minute": 1000,
    },
}


class User(Base):
    """User account model."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    tier: Mapped[str] = mapped_column(String(50), default="free", nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="user", nullable=False)  # user, admin
    is_verified: Mapped[bool] = mapped_column(default=False, nullable=False)
    email_verification_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    email_verification_expires: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    password_reset_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    password_reset_expires: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    uploads: Mapped[List["Upload"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    outputs: Mapped[List["Output"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    jobs: Mapped[List["Job"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    sessions: Mapped[List["Session"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    analyses: Mapped[List["PropertyAnalysis"]] = relationship(cascade="all, delete-orphan")


class Upload(Base):
    """Uploaded file record."""
    __tablename__ = "uploads"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(255), ForeignKey("users.username"), nullable=False, index=True)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime: Mapped[str] = mapped_column(String(100), nullable=False)
    ext: Mapped[str] = mapped_column(String(20), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(50), default="upload", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="uploads")


class Output(Base):
    """Generated/converted output file record."""
    __tablename__ = "outputs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(255), ForeignKey("users.username"), nullable=False, index=True)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime: Mapped[str] = mapped_column(String(100), nullable=False)
    ext: Mapped[str] = mapped_column(String(20), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(50), default="output", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="outputs")


class Job(Base):
    """Background job record."""
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(255), ForeignKey("users.username"), index=True, nullable=True)
    task_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)  # pending, running, completed, failed
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="jobs")


class Subscription(Base):
    """Subscription record for Stripe webhook tracking."""
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(255), ForeignKey("users.username"), nullable=False, index=True)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    stripe_price_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="incomplete", nullable=False)  # incomplete, active, past_due, canceled
    tier: Mapped[str] = mapped_column(String(50), default="free", nullable=False)
    interval: Mapped[str] = mapped_column(String(20), default="monthly", nullable=False)
    current_period_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User")


class Session(Base):
    """User session for refresh-token rotation and revocation."""
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(255), ForeignKey("users.username"), nullable=False, index=True)
    refresh_token: Mapped[str] = mapped_column(String(512), unique=True, index=True, nullable=False)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User")


class PropertyAnalysis(Base):
    """Saved rental property financial analysis."""
    __tablename__ = "property_analyses"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(255), ForeignKey("users.username"), nullable=False, index=True)

    # Input parameters
    purchase_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    rental_income: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    down_payment: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    loan_term_years: Mapped[int] = mapped_column(Integer, nullable=False)
    interest_rate: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    property_tax_annual: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    insurance_annual: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    misc_opex_annual: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Calculated metrics
    monthly_cash_flow: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    annual_cash_flow: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    cap_rate: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    cash_on_cash_return: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    total_return_roi: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User")
