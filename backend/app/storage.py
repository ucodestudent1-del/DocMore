"""File storage: save uploads, serve outputs, track history, cleanup.

Uses PostgreSQL database for metadata, filesystem or S3-compatible storage for files.
"""

import time
import asyncio
import io
from pathlib import Path
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.config import (
    UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR,
    CLEANUP_AFTER_HOURS,
    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
    AWS_S3_BUCKET, AWS_S3_REGION, AWS_S3_ENDPOINT_URL,
)
from app.security import validate_upload, sanitize_filename, randomized_name
from app.database import async_session
from app.models import Upload, Output, User

# Optional S3 support
try:
    import boto3
    from botocore.exceptions import ClientError
    _HAS_S3 = bool(AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and AWS_S3_BUCKET)
    if _HAS_S3:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_S3_REGION,
            endpoint_url=AWS_S3_ENDPOINT_URL,
        )
    else:
        s3_client = None
except ImportError:
    _HAS_S3 = False
    s3_client = None


class Storage:
    """File storage using PostgreSQL for metadata and filesystem or S3 for files."""

    # --- Uploads -----------------------------------------------------
    async def save_upload(self, file_bytes: bytes, original_name: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Save uploaded file to disk and record in database."""
        from app.security import validate_upload

        ext, mime, size = validate_upload(file_bytes, original_name)
        file_id = randomized_name(original_name).rsplit(".", 1)[0]
        dest = UPLOAD_DIR / f"{file_id}{('.' + ext) if ext else ''}"
        dest = dest.resolve()
        dest.write_bytes(file_bytes)

        async with async_session() as db:
            entry = Upload(
                id=file_id,
                user_id=user_id,
                original_name=original_name,
                stored_name=dest.name,
                path=str(dest),
                mime=mime,
                ext=ext,
                size=size,
                kind="upload",
            )
            db.add(entry)
            await db.commit()
            await db.refresh(entry)

        return {
            "id": entry.id,
            "user_id": entry.user_id,
            "original_name": entry.original_name,
            "stored_name": entry.stored_name,
            "path": entry.path,
            "mime": entry.mime,
            "ext": entry.ext,
            "size": entry.size,
            "kind": entry.kind,
            "ts": entry.created_at.timestamp() if entry.created_at else time.time(),
        }

    def read_file(self, file_id: str) -> Optional[Path]:
        """Find a file on disk by its ID."""
        for directory in (UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR):
            for p in directory.iterdir():
                if p.is_file() and p.stem == file_id:
                    return p
        return None

    async def save_output(self, file_id: str, content: bytes, ext: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Save converted output file to disk and record in database."""
        dest = OUTPUT_DIR / f"{file_id}{('.' + ext) if ext else ''}"
        dest.write_bytes(content)

        async with async_session() as db:
            entry = Output(
                id=file_id,
                user_id=user_id,
                original_name=file_id,
                stored_name=dest.name,
                path=str(dest),
                mime="application/octet-stream",
                ext=ext,
                size=len(content),
                kind="output",
            )
            db.add(entry)
            await db.commit()
            await db.refresh(entry)

        return {
            "id": entry.id,
            "user_id": entry.user_id,
            "stored_name": entry.stored_name,
            "path": entry.path,
            "ext": entry.ext,
            "size": entry.size,
            "kind": entry.kind,
            "ts": entry.created_at.timestamp() if entry.created_at else time.time(),
        }

    def delete_file(self, file_id: str) -> bool:
        """Delete a file from disk."""
        removed = False
        for directory in (UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR):
            for p in list(directory.iterdir()):
                if p.is_file() and p.stem == file_id:
                    try:
                        p.unlink()
                        removed = True
                    except Exception:
                        pass
        return removed

    # --- History -----------------------------------------------------
    async def list_history(self, limit: int = 100, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List upload history, optionally filtered by user."""
        async with async_session() as db:
            query = select(Upload).order_by(desc(Upload.created_at)).limit(limit)
            if user_id:
                query = query.where(Upload.user_id == user_id)
            result = await db.execute(query)
            uploads = result.scalars().all()
            return [
                {
                    "id": u.id,
                    "user_id": u.user_id,
                    "original_name": u.original_name,
                    "stored_name": u.stored_name,
                    "path": u.path,
                    "mime": u.mime,
                    "ext": u.ext,
                    "size": u.size,
                    "kind": u.kind,
                    "ts": u.created_at.timestamp() if u.created_at else time.time(),
                }
                for u in uploads
            ]

    async def get_file_entry(self, file_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get file entry by ID, optionally filtered by user_id."""
        async with async_session() as db:
            query = select(Upload).where(Upload.id == file_id)
            if user_id:
                query = query.where(Upload.user_id == user_id)
            result = await db.execute(query)
            entry = result.scalar_one_or_none()
            if entry:
                return {
                    "id": entry.id,
                    "user_id": entry.user_id,
                    "original_name": entry.original_name,
                    "stored_name": entry.stored_name,
                    "path": entry.path,
                    "mime": entry.mime,
                    "ext": entry.ext,
                    "size": entry.size,
                    "kind": entry.kind,
                    "ts": entry.created_at.timestamp() if entry.created_at else time.time(),
                }
            return None

    # --- Cleanup -----------------------------------------------------
    def cleanup_old(self) -> int:
        """Remove files older than CLEANUP_AFTER_HOURS. Returns count removed."""
        import time as _time
        cutoff = _time.time() - (CLEANUP_AFTER_HOURS * 3600)
        removed = 0
        for directory in (UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR):
            for p in list(directory.iterdir()):
                if not p.is_file():
                    continue
                try:
                    if p.stat().st_mtime < cutoff:
                        p.unlink()
                        removed += 1
                except Exception:
                    pass
        return removed


storage = Storage()