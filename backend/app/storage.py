"""File storage: save uploads, serve outputs, track history, cleanup.

Delegates to the configured `StorageBackend` (local filesystem or S3).
Metadata lives in PostgreSQL via Prisma. All methods are async.
"""

from pathlib import Path
from typing import Optional, List, Dict, Any

from app.storage_backends import get_storage_backend, StorageBackend

_backend: Optional[StorageBackend] = None


def _get_backend() -> StorageBackend:
    global _backend
    if _backend is None:
        _backend = get_storage_backend()
    return _backend


class Storage:
    """Async storage facade over the configured StorageBackend."""

    async def save_upload(
        self,
        file_bytes: bytes,
        original_name: str,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return await _get_backend().save_upload(file_bytes, original_name, user_id=user_id)

    async def read_file(self, file_id: str) -> Optional[Path]:
        return await _get_backend().read_file(file_id)

    async def save_output(
        self,
        file_id: str,
        content: bytes,
        ext: str,
        user_id: Optional[str] = None,
        original_name: Optional[str] = None,
        document_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return await _get_backend().save_output(
            file_id, content, ext,
            user_id=user_id,
            original_name=original_name,
            document_id=document_id,
        )

    async def delete_file(self, file_id: str, user_id: Optional[str] = None) -> bool:
        return await _get_backend().delete_file(file_id, user_id=user_id)

    async def list_history(
        self,
        limit: int = 100,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        return await _get_backend().list_history(limit=limit, user_id=user_id)

    async def get_file_entry(
        self,
        file_id: str,
        user_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        return await _get_backend().get_file_entry(file_id, user_id=user_id)

    async def get_download_url(
        self,
        file_id: str,
        expires_in: int = 3600,
    ) -> str:
        return await _get_backend().get_download_url(file_id, expires_in=expires_in)

    async def cleanup_old(self, hours: int = 24) -> int:
        return await _get_backend().cleanup_old(hours=hours)


storage = Storage()

__all__ = ["Storage", "storage"]
