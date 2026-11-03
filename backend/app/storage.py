"""File storage: save uploads, serve outputs, track history, cleanup.

Uses local filesystem for files and JSON for metadata. No database required.
"""

import time
import json
import threading
from pathlib import Path
from typing import Optional, List, Dict, Any

from app.config import (
    UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR,
    CLEANUP_AFTER_HOURS,
)
from app.security import validate_upload, sanitize_filename, randomized_name

_lock = threading.Lock()
HISTORY_FILE = Path(__file__).resolve().parent.parent / "data" / "history.json"

# In-memory history: list of dicts
_history: List[Dict[str, Any]] = []


def _load_history() -> None:
    """Load history from disk into memory."""
    global _history
    if HISTORY_FILE.exists():
        try:
            _history = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        except Exception:
            _history = []
    else:
        _history = []


def _save_history() -> None:
    """Persist history to disk."""
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    HISTORY_FILE.write_text(json.dumps(_history, indent=2), encoding="utf-8")


def _now_ts() -> float:
    return time.time()


class Storage:
    """File storage using local filesystem and JSON metadata."""

    # --- Uploads -----------------------------------------------------
    def save_upload(self, file_bytes: bytes, original_name: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Save uploaded file to disk and record in history."""
        from app.security import validate_upload

        ext, mime, size = validate_upload(file_bytes, original_name)
        file_id = randomized_name(original_name).rsplit(".", 1)[0]
        dest = UPLOAD_DIR / f"{file_id}{('.' + ext) if ext else ''}"
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
            "ts": _now_ts(),
        }

        with _lock:
            _history.insert(0, entry)
            _save_history()

        return entry

    def read_file(self, file_id: str) -> Optional[Path]:
        """Find a file on disk by its ID."""
        for directory in (UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR):
            if not directory.exists():
                continue
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
        original_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Save converted output file to disk and record in history."""
        dest = OUTPUT_DIR / f"{file_id}{('.' + ext) if ext else ''}"
        dest.write_bytes(content)

        display_name = original_name or file_id

        entry = {
            "id": file_id,
            "user_id": user_id,
            "original_name": display_name,
            "stored_name": dest.name,
            "path": str(dest),
            "mime": "application/octet-stream",
            "ext": ext,
            "size": len(content),
            "kind": "output",
            "ts": _now_ts(),
        }

        with _lock:
            _history.insert(0, entry)
            _save_history()

        return entry

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
    def list_history(self, limit: int = 100, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List processing history, optionally filtered by user.
        Auth user records (kind="user") are excluded — they are not document history.
        """
        with _lock:
            items = _history
            if user_id:
                items = [e for e in items if e.get("user_id") == user_id]
            items = [e for e in items if e.get("kind") != "user"]
            return list(items[:limit])

    def get_file_entry(self, file_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get file entry by ID, optionally filtered by user_id."""
        with _lock:
            for entry in _history:
                if entry.get("id") == file_id:
                    if user_id is not None and entry.get("user_id") != user_id:
                        return None
                    return entry
            return None

    # --- Cleanup -----------------------------------------------------
    def cleanup_old(self) -> int:
        """Remove files older than CLEANUP_AFTER_HOURS. Returns count removed."""
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


storage = Storage()

# Load any previously persisted history so uploads/outputs survive restarts.
_load_history()


# Expose module-level items for auth module
__all__ = ["Storage", "storage", "_history", "_save_history", "_lock"]