"""Database models for Universal Document Studio.

Uses SQLAlchemy with async support for PostgreSQL.
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, String, DateTime, Float, Text, ForeignKey, Index
)
from sqlalchemy.orm import DeclarativeBase, relationship, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    """User account model."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    tier: Mapped[str] = mapped_column(String(50), default="free", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    uploads: Mapped[List["Upload"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    outputs: Mapped[List["Output"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    jobs: Mapped[List["Job"]] = relationship(back_populates="user", cascade="all, delete-orphan")


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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="outputs")


class Job(Base):
    """Background job record."""
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(255), index=True, nullable=True)
    task_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)  # pending, running, completed, failed
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="jobs")