"""Storage backend abstraction for DocStudio.

Defines a `StorageBackend` interface with two implementations:
- `LocalStorageBackend`: filesystem storage + Prisma metadata (default)
- `S3StorageBackend`: S3-compatible object storage + Prisma metadata

Metadata (file records, ownership, timestamps) always lives in PostgreSQL
via Prisma. Only the binary payload differs between backends.
"""

import os
import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, Dict, List

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.config import (
    UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR,
    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET,
    AWS_S3_REGION, AWS_S3_ENDPOINT_URL,
)
from app.security import validate_upload, randomized_name
from app.prisma_client import get_prisma


class StorageError(Exception):
    pass


class FileRecord(Dict[str, Any]):
    """Typed dict for a stored file record."""
    pass


class StorageBackend(ABC):
    """Abstract interface for document storage backends."""

    @abstractmethod
    async def save_upload(
        self,
        file_bytes: bytes,
        original_name: str,
        user_id: Optional[str] = None,
    ) -> FileRecord:
        """Save an uploaded file. Returns a file record dict."""
        raise NotImplementedError

    @abstractmethod
    async def save_output(
        self,
        file_id: str,
        content: bytes,
        ext: str,
        user_id: Optional[str] = None,
        original_name: Optional[str] = None,
        document_id: Optional[str] = None,
    ) -> FileRecord:
        """Save a processed output file. Returns a file record dict."""
        raise NotImplementedError

    @abstractmethod
    async def read_file(self, file_id: str) -> Optional[Path]:
        """Resolve a file's local path for serving. Returns None if not found."""
        raise NotImplementedError

    @abstractmethod
    async def get_file_entry(
        self,
        file_id: str,
        user_id: Optional[str] = None,
    ) -> Optional[FileRecord]:
        """Get a file record by ID, optionally filtered by owner."""
        raise NotImplementedError

    @abstractmethod
    async def list_history(
        self,
        limit: int = 100,
        user_id: Optional[str] = None,
    ) -> List[FileRecord]:
        """List file records, optionally filtered by owner."""
        raise NotImplementedError

    @abstractmethod
    async def delete_file(self, file_id: str, user_id: Optional[str] = None) -> bool:
        """Delete a file and its record. Returns True if deleted."""
        raise NotImplementedError

    @abstractmethod
    async def get_download_url(
        self,
        file_id: str,
        expires_in: int = 3600,
    ) -> str:
        """Return a (possibly signed) URL for downloading a file."""
        raise NotImplementedError

    @abstractmethod
    async def cleanup_old(self, hours: int = 24) -> int:
        """Remove files older than `hours`. Returns count removed."""
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Local filesystem backend
# ---------------------------------------------------------------------------

class LocalStorageBackend(StorageBackend):
    """Filesystem storage with PostgreSQL metadata via Prisma."""

    async def save_upload(
        self,
        file_bytes: bytes,
        original_name: str,
        user_id: Optional[str] = None,
    ) -> FileRecord:
        ext, mime, size = validate_upload(file_bytes, original_name)
        file_id = randomized_name(original_name).rsplit(".", 1)[0]
        dest = UPLOAD_DIR / f"{file_id}{('.' + ext) if ext else ''}"
        dest = dest.resolve()
        dest.write_bytes(file_bytes)

        prisma = get_prisma()
        record = await prisma.document.create({
            "id": file_id,
            "userId": user_id,
            "kind": "UPLOAD",
            "originalName": original_name,
            "storedName": dest.name,
            "mime": mime,
            "ext": ext,
            "size": size,
            "storagePath": str(dest),
            "storageBackend": "local",
        })
        return {
            "id": record.id,
            "user_id": record.userId,
            "original_name": record.originalName,
            "stored_name": record.storedName,
            "path": record.storagePath,
            "mime": record.mime,
            "ext": record.ext,
            "size": record.size,
            "kind": record.kind,
            "ts": record.createdAt.timestamp(),
        }

    async def save_output(
        self,
        file_id: str,
        content: bytes,
        ext: str,
        user_id: Optional[str] = None,
        original_name: Optional[str] = None,
        document_id: Optional[str] = None,
    ) -> FileRecord:
        dest = OUTPUT_DIR / f"{file_id}{('.' + ext) if ext else ''}"
        dest.write_bytes(content)

        display_name = original_name or file_id
        prisma = get_prisma()
        record = await prisma.output.create({
            "id": file_id,
            "documentId": document_id,
            "userId": user_id,
            "originalName": display_name,
            "storedName": dest.name,
            "mime": "application/octet-stream",
            "ext": ext,
            "size": len(content),
            "storagePath": str(dest),
            "storageBackend": "local",
        })
        return {
            "id": record.id,
            "document_id": record.documentId,
            "user_id": record.userId,
            "original_name": record.originalName,
            "stored_name": record.storedName,
            "path": record.storagePath,
            "mime": record.mime,
            "ext": record.ext,
            "size": record.size,
            "kind": "output",
            "ts": record.createdAt.timestamp(),
        }

    async def read_file(self, file_id: str) -> Optional[Path]:
        for directory in (UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR):
            if not directory.exists():
                continue
            for p in directory.iterdir():
                if p.is_file() and p.stem == file_id:
                    return p
        return None

    async def get_file_entry(
        self,
        file_id: str,
        user_id: Optional[str] = None,
    ) -> Optional[FileRecord]:
        prisma = get_prisma()
        doc = await prisma.document.find_unique(
            where={"id": file_id},
            include={"user": True},
        )
        if doc and (user_id is None or doc.userId == user_id):
            return self._doc_to_record(doc)
        out = await prisma.output.find_unique(
            where={"id": file_id},
            include={"user": True},
        )
        if out and (user_id is None or out.userId == user_id):
            return self._output_to_record(out)
        return None

    async def list_history(
        self,
        limit: int = 100,
        user_id: Optional[str] = None,
    ) -> List[FileRecord]:
        prisma = get_prisma()
        docs = await prisma.document.find_many(
            where={"userId": user_id} if user_id else {},
            order={"createdAt": "desc"},
            take=limit,
            include={"user": True},
        )
        outs = await prisma.output.find_many(
            where={"userId": user_id} if user_id else {},
            order={"createdAt": "desc"},
            take=limit,
            include={"user": True},
        )
        records: List[FileRecord] = []
        for d in docs:
            records.append(self._doc_to_record(d))
        for o in outs:
            records.append(self._output_to_record(o))
        records.sort(key=lambda r: r.get("ts", 0), reverse=True)
        return records[:limit]

    async def delete_file(self, file_id: str, user_id: Optional[str] = None) -> bool:
        entry = await self.get_file_entry(file_id, user_id=user_id)
        if not entry:
            return False
        path = Path(entry["path"])
        try:
            if path.exists():
                path.unlink()
        except Exception:
            pass
        prisma = get_prisma()
        try:
            await prisma.document.delete(where={"id": file_id})
        except Exception:
            try:
                await prisma.output.delete(where={"id": file_id})
            except Exception:
                pass
        return True

    async def get_download_url(
        self,
        file_id: str,
        expires_in: int = 3600,
    ) -> str:
        # Local backend serves via the API; return the local path-based URL.
        return f"/api/download/{file_id}"

    async def cleanup_old(self, hours: int = 24) -> int:
        cutoff = time.time() - (hours * 3600)
        removed = 0
        for directory in (UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR):
            if not directory.exists():
                continue
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

    # -- helpers --

    @staticmethod
    def _doc_to_record(d: Any) -> FileRecord:
        return {
            "id": d.id,
            "user_id": d.userId,
            "original_name": d.originalName,
            "stored_name": d.storedName,
            "path": d.storagePath,
            "mime": d.mime,
            "ext": d.ext,
            "size": d.size,
            "kind": d.kind,
            "ts": d.createdAt.timestamp(),
        }

    @staticmethod
    def _output_to_record(o: Any) -> FileRecord:
        return {
            "id": o.id,
            "user_id": o.userId,
            "original_name": o.originalName,
            "stored_name": o.storedName,
            "path": o.storagePath,
            "mime": o.mime,
            "ext": o.ext,
            "size": o.size,
            "kind": "output",
            "ts": o.createdAt.timestamp(),
        }


# ---------------------------------------------------------------------------
# S3-compatible backend
# ---------------------------------------------------------------------------

class S3StorageBackend(StorageBackend):
    """S3-compatible object storage with PostgreSQL metadata via Prisma.

    Objects are stored in a private bucket. Downloads are served via
    temporary signed URLs (presigned GET) so the bucket never needs public
    read access.
    """

    def __init__(self) -> None:
        self._s3 = None
        self._bucket = AWS_S3_BUCKET or "everydoc-uploads"

    def _client(self):
        if self._s3 is None:
            kwargs: Dict[str, Any] = {
                "aws_access_key_id": AWS_ACCESS_KEY_ID or None,
                "aws_secret_access_key": AWS_SECRET_ACCESS_KEY or None,
                "region_name": AWS_S3_REGION or "us-east-1",
                "config": Config(signature_version="s3v4"),
            }
            if AWS_S3_ENDPOINT_URL:
                kwargs["endpoint_url"] = AWS_S3_ENDPOINT_URL
            self._s3 = boto3.client("s3", **kwargs)
        return self._s3

    async def save_upload(
        self,
        file_bytes: bytes,
        original_name: str,
        user_id: Optional[str] = None,
    ) -> FileRecord:
        ext, mime, size = validate_upload(file_bytes, original_name)
        file_id = randomized_name(original_name).rsplit(".", 1)[0]
        key = f"uploads/{file_id}{('.' + ext) if ext else ''}"

        s3 = self._client()
        s3.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=file_bytes,
            ContentType=mime,
        )

        prisma = get_prisma()
        record = await prisma.document.create({
            "id": file_id,
            "userId": user_id,
            "kind": "UPLOAD",
            "originalName": original_name,
            "storedName": key,
            "mime": mime,
            "ext": ext,
            "size": size,
            "storagePath": key,
            "storageBackend": "s3",
        })
        return {
            "id": record.id,
            "user_id": record.userId,
            "original_name": record.originalName,
            "stored_name": record.storedName,
            "path": record.storagePath,
            "mime": record.mime,
            "ext": record.ext,
            "size": record.size,
            "kind": record.kind,
            "ts": record.createdAt.timestamp(),
        }

    async def save_output(
        self,
        file_id: str,
        content: bytes,
        ext: str,
        user_id: Optional[str] = None,
        original_name: Optional[str] = None,
        document_id: Optional[str] = None,
    ) -> FileRecord:
        key = f"outputs/{file_id}{('.' + ext) if ext else ''}"
        display_name = original_name or file_id

        s3 = self._client()
        s3.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=content,
            ContentType="application/octet-stream",
        )

        prisma = get_prisma()
        record = await prisma.output.create({
            "id": file_id,
            "documentId": document_id,
            "userId": user_id,
            "originalName": display_name,
            "storedName": key,
            "mime": "application/octet-stream",
            "ext": ext,
            "size": len(content),
            "storagePath": key,
            "storageBackend": "s3",
        })
        return {
            "id": record.id,
            "document_id": record.documentId,
            "user_id": record.userId,
            "original_name": record.originalName,
            "stored_name": record.storedName,
            "path": record.storagePath,
            "mime": record.mime,
            "ext": record.ext,
            "size": record.size,
            "kind": "output",
            "ts": record.createdAt.timestamp(),
        }

    async def read_file(self, file_id: str) -> Optional[Path]:
        # S3 objects have no local path. Return None; use get_download_url.
        return None

    async def get_file_entry(
        self,
        file_id: str,
        user_id: Optional[str] = None,
    ) -> Optional[FileRecord]:
        prisma = get_prisma()
        doc = await prisma.document.find_unique(
            where={"id": file_id},
            include={"user": True},
        )
        if doc and (user_id is None or doc.userId == user_id):
            return {
                "id": doc.id,
                "user_id": doc.userId,
                "original_name": doc.originalName,
                "stored_name": doc.storedName,
                "path": doc.storagePath,
                "mime": doc.mime,
                "ext": doc.ext,
                "size": doc.size,
                "kind": doc.kind,
                "ts": doc.createdAt.timestamp(),
            }
        out = await prisma.output.find_unique(
            where={"id": file_id},
            include={"user": True},
        )
        if out and (user_id is None or out.userId == user_id):
            return {
                "id": out.id,
                "user_id": out.userId,
                "original_name": out.originalName,
                "stored_name": out.storedName,
                "path": out.storagePath,
                "mime": out.mime,
                "ext": out.ext,
                "size": out.size,
                "kind": "output",
                "ts": out.createdAt.timestamp(),
            }
        return None

    async def list_history(
        self,
        limit: int = 100,
        user_id: Optional[str] = None,
    ) -> List[FileRecord]:
        prisma = get_prisma()
        docs = await prisma.document.find_many(
            where={"userId": user_id} if user_id else {},
            order={"createdAt": "desc"},
            take=limit,
            include={"user": True},
        )
        outs = await prisma.output.find_many(
            where={"userId": user_id} if user_id else {},
            order={"createdAt": "desc"},
            take=limit,
            include={"user": True},
        )
        records: List[FileRecord] = []
        for d in docs:
            records.append({
                "id": d.id, "user_id": d.userId, "original_name": d.originalName,
                "stored_name": d.storedName, "path": d.storagePath,
                "mime": d.mime, "ext": d.ext, "size": d.size,
                "kind": d.kind, "ts": d.createdAt.timestamp(),
            })
        for o in outs:
            records.append({
                "id": o.id, "user_id": o.userId, "original_name": o.originalName,
                "stored_name": o.storedName, "path": o.storagePath,
                "mime": o.mime, "ext": o.ext, "size": o.size,
                "kind": "output", "ts": o.createdAt.timestamp(),
            })
        records.sort(key=lambda r: r.get("ts", 0), reverse=True)
        return records[:limit]

    async def delete_file(self, file_id: str, user_id: Optional[str] = None) -> bool:
        entry = await self.get_file_entry(file_id, user_id=user_id)
        if not entry:
            return False
        s3 = self._client()
        try:
            s3.delete_object(Bucket=self._bucket, Key=entry["path"])
        except ClientError:
            pass
        prisma = get_prisma()
        try:
            await prisma.document.delete(where={"id": file_id})
        except Exception:
            try:
                await prisma.output.delete(where={"id": file_id})
            except Exception:
                pass
        return True

    async def get_download_url(
        self,
        file_id: str,
        expires_in: int = 3600,
    ) -> str:
        entry = await self.get_file_entry(file_id)
        if not entry:
            raise StorageError("File not found")
        s3 = self._client()
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": entry["path"]},
            ExpiresIn=expires_in,
        )
        return url

    async def cleanup_old(self, hours: int = 24) -> int:
        # S3 cleanup relies on bucket lifecycle rules; local metadata cleanup.
        prisma = get_prisma()
        cutoff = datetime.now(timezone.utc) - __import__("datetime").timedelta(hours=hours)
        docs = await prisma.document.find_many(
            where={"createdAt": {"lt": cutoff}},
            select={"id": True, "storagePath": True},
        )
        outs = await prisma.output.find_many(
            where={"createdAt": {"lt": cutoff}},
            select={"id": True, "storagePath": True},
        )
        removed = 0
        s3 = self._client()
        for d in docs:
            try:
                s3.delete_object(Bucket=self._bucket, Key=d.storagePath)
                await prisma.document.delete(where={"id": d.id})
                removed += 1
            except Exception:
                pass
        for o in outs:
            try:
                s3.delete_object(Bucket=self._bucket, Key=o.storagePath)
                await prisma.output.delete(where={"id": o.id})
                removed += 1
            except Exception:
                pass
        return removed


# ---------------------------------------------------------------------------
# Backend factory
# ---------------------------------------------------------------------------

_backend: Optional[StorageBackend] = None


def get_storage_backend() -> StorageBackend:
    """Return the configured storage backend (singleton)."""
    global _backend
    if _backend is None:
        backend_name = os.getenv("STORAGE_BACKEND", "local").lower()
        if backend_name == "s3":
            _backend = S3StorageBackend()
        else:
            _backend = LocalStorageBackend()
    return _backend


__all__ = [
    "StorageBackend",
    "LocalStorageBackend",
    "S3StorageBackend",
    "StorageError",
    "get_storage_backend",
    "FileRecord",
]
