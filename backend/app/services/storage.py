"""Storage backend abstraction.

Defines the StorageBackend interface and provides two implementations:
LocalStorageBackend (default, existing behavior) and S3StorageBackend
(boto3, S3/MinIO-compatible).  Selectable via STORAGE_BACKEND env var.
"""

from __future__ import annotations

import os
import secrets
import threading
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import (
    AWS_S3_BUCKET,
    AWS_S3_ENDPOINT_URL,
    AWS_S3_REGION,
    MAX_FILE_SIZE,
    OUTPUT_DIR,
    STORAGE_BACKEND,
    TEMP_DIR,
    UPLOAD_DIR,
)
from app.security import SecurityError, sanitize_filename, validate_upload


class StorageBackend(ABC):
    """Abstract interface for document storage backends."""

    @abstractmethod
    def save_upload(
        self, file_bytes: bytes, original_name: str, user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Save an uploaded file. Returns a file entry dict."""

    @abstractmethod
    def read_file(self, file_id: str) -> Optional[Path]:
        """Find a stored file on disk (or bucket key) by its ID."""

    @abstractmethod
    def save_output(
        self,
        file_id: str,
        content: bytes,
        ext: str,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Save a generated/converted output file."""

    @abstractmethod
    def delete_file(self, file_id: str) -> bool:
        """Delete a file by ID. Returns True if removed."""

    @abstractmethod
    def list_history(
        self, limit: int = 100, user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List processing history, optionally filtered by user."""

    @abstractmethod
    def get_file_entry(
        self, file_id: str, user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get a single file entry by ID, optionally filtered by user."""

    @abstractmethod
    def cleanup_old(self) -> int:
        """Remove files older than the retention window. Returns count removed."""


class LocalStorageBackend(StorageBackend):
    """Local filesystem storage (default, matches previous behavior)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._history: List[Dict[str, Any]] = []
        self._history_loaded = False

    # -- internal helpers -------------------------------------------------

    def _now_ts(self) -> float:
        return time.time()

    def _load_history(self) -> None:
        from app.storage import HISTORY_FILE as _HF

        if self._history_loaded:
            return
        self._history_loaded = True
        if _HF.exists():
            try:
                self._history = __import__("json").loads(
                    _HF.read_text(encoding="utf-8")
                )
            except Exception:
                self._history = []
        else:
            self._history = []

    def _save_history(self) -> None:
        from app.storage import HISTORY_FILE as _HF

        _HF.parent.mkdir(parents=True, exist_ok=True)
        _HF.write_text(__import__("json").dumps(self._history, indent=2), encoding="utf-8")

    # -- StorageBackend API ----------------------------------------------

    def save_upload(
        self, file_bytes: bytes, original_name: str, user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        ext, mime, size = validate_upload(file_bytes, original_name)
        file_id = secrets.token_urlsafe(16)
        dest = UPLOAD_DIR / f"{file_id}.{ext}" if ext else UPLOAD_DIR / file_id
        dest = dest.resolve()
        dest.write_bytes(file_bytes)

        entry = {
            "id": file_id,
            "user_id": user_id,
            "original_name": original_name,
            "stored_name": dest.name,
            "path": str(dest),
            "mime": mime,
            "ext": ext,
            "size": size,
            "kind": "upload",
            "ts": self._now_ts(),
        }

        with self._lock:
            self._load_history()
            self._history.insert(0, entry)
            self._save_history()

        return entry

    def read_file(self, file_id: str) -> Optional[Path]:
        for directory in (UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR):
            for p in directory.iterdir():
                if p.is_file() and p.stem == file_id:
                    return p
        return None

    def save_output(
        self,
        file_id: str,
        content: bytes,
        ext: str,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        dest = OUTPUT_DIR / f"{file_id}.{ext}" if ext else OUTPUT_DIR / file_id
        dest.write_bytes(content)

        entry = {
            "id": file_id,
            "user_id": user_id,
            "original_name": file_id,
            "stored_name": dest.name,
            "path": str(dest),
            "mime": "application/octet-stream",
            "ext": ext,
            "size": len(content),
            "kind": "output",
            "ts": self._now_ts(),
        }

        with self._lock:
            self._load_history()
            self._history.insert(0, entry)
            self._save_history()

        return entry

    def delete_file(self, file_id: str) -> bool:
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

    def list_history(
        self, limit: int = 100, user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        with self._lock:
            self._load_history()
            items = self._history
            if user_id:
                items = [e for e in items if e.get("user_id") == user_id]
            return list(items[:limit])

    def get_file_entry(
        self, file_id: str, user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        with self._lock:
            self._load_history()
            for entry in self._history:
                if entry.get("id") == file_id:
                    if user_id is not None and entry.get("user_id") != user_id:
                        return None
                    return entry
        return None

    def cleanup_old(self) -> int:
        from app.config import CLEANUP_AFTER_HOURS

        cutoff = time.time() - (CLEANUP_AFTER_HOURS * 3600)
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


class S3StorageBackend(StorageBackend):
    """S3-compatible object storage backend (MinIO, AWS S3, etc.)."""

    def __init__(self) -> None:
        import boto3
        from botocore.client import Config

        self._s3 = boto3.client(
            "s3",
            endpoint_url=AWS_S3_ENDPOINT_URL or None,
            region_name=AWS_S3_REGION,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", ""),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", ""),
            config=Config(signature_version="s3v4"),
        )
        self._bucket = AWS_S3_BUCKET
        self._lock = threading.Lock()
        self._history: List[Dict[str, Any]] = []
        self._history_loaded = False

    def _object_key(self, file_id: str, ext: str) -> str:
        return f"{file_id}.{ext}" if ext else file_id

    def save_upload(
        self, file_bytes: bytes, original_name: str, user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        ext, mime, size = validate_upload(file_bytes, original_name)
        file_id = secrets.token_urlsafe(16)
        key = self._object_key(file_id, ext)

        self._s3.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=file_bytes,
            ContentType=mime,
        )

        entry = {
            "id": file_id,
            "user_id": user_id,
            "original_name": original_name,
            "stored_name": key,
            "path": f"s3://{self._bucket}/{key}",
            "mime": mime,
            "ext": ext,
            "size": size,
            "kind": "upload",
            "ts": time.time(),
        }

        with self._lock:
            entry["ts"] = entry["ts"]
            self._history.insert(0, entry)

        return entry

    def read_file(self, file_id: str) -> Optional[Path]:
        """S3 backend does not return local paths. Returns None."""
        return None

    def save_output(
        self,
        file_id: str,
        content: bytes,
        ext: str,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        key = self._object_key(file_id, ext)

        self._s3.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=content,
            ContentType="application/octet-stream",
        )

        entry = {
            "id": file_id,
            "user_id": user_id,
            "original_name": file_id,
            "stored_name": key,
            "path": f"s3://{self._bucket}/{key}",
            "mime": "application/octet-stream",
            "ext": ext,
            "size": len(content),
            "kind": "output",
            "ts": time.time(),
        }

        with self._lock:
            self._history.insert(0, entry)

        return entry

    def delete_file(self, file_id: str) -> bool:
        removed = False
        with self._lock:
            for entry in list(self._history):
                if entry.get("id") == file_id:
                    try:
                        self._s3.delete_object(
                            Bucket=self._bucket, Key=entry.get("stored_name", "")
                        )
                        self._history.remove(entry)
                        removed = True
                    except Exception:
                        pass
        return removed

    def list_history(
        self, limit: int = 100, user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        with self._lock:
            items = self._history
            if user_id:
                items = [e for e in items if e.get("user_id") == user_id]
            return list(items[:limit])

    def get_file_entry(
        self, file_id: str, user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        with self._lock:
            for entry in self._history:
                if entry.get("id") == file_id:
                    if user_id is not None and entry.get("user_id") != user_id:
                        return None
                    return entry
        return None

    def cleanup_old(self) -> int:
        from app.config import CLEANUP_AFTER_HOURS

        cutoff = time.time() - (CLEANUP_AFTER_HOURS * 3600)
        removed = 0
        with self._lock:
            for entry in list(self._history):
                try:
                    if entry.get("ts", 0) < cutoff:
                        self._s3.delete_object(
                            Bucket=self._bucket, Key=entry.get("stored_name", "")
                        )
                        self._history.remove(entry)
                        removed += 1
                except Exception:
                    pass
        return removed


def get_storage_backend() -> StorageBackend:
    """Factory: return the configured storage backend."""
    backend = (STORAGE_BACKEND or "local").lower()
    if backend == "s3":
        return S3StorageBackend()
    return LocalStorageBackend()


storage = get_storage_backend()
