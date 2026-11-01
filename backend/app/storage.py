"""File storage: save uploads, serve outputs, track history, cleanup."""

import json
import time
import threading
from pathlib import Path
from typing import Dict, Any, Optional, List

from app.config import (
    UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR, HISTORY_FILE,
    CLEANUP_AFTER_HOURS,
)
from app.security import is_path_safe, sanitize_filename, randomized_name

_lock = threading.Lock()


class Storage:
    def __init__(self) -> None:
        self._history: List[Dict[str, Any]] = self._load_history()

    # --- history -----------------------------------------------------
    def _load_history(self) -> List[Dict[str, Any]]:
        if HISTORY_FILE.exists():
            try:
                return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
            except Exception:
                return []
        return []

    def _save_history(self) -> None:
        tmp = HISTORY_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(self._history, indent=2), encoding="utf-8")
        tmp.replace(HISTORY_FILE)

    def record(self, entry: Dict[str, Any]) -> None:
        with _lock:
            entry["ts"] = entry.get("ts") or time.time()
            self._history.insert(0, entry)
            self._history = self._history[:1000]
            self._save_history()

    def list_history(self, limit: int = 100, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with _lock:
            items = self._history
            if user_id:
                items = [e for e in items if e.get("user_id") == user_id]
            return list(items[:limit])

    def get_file_entry(self, file_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Find a history entry by file id, optionally filtered by user_id."""
        with _lock:
            for entry in self._history:
                if entry.get("id") == file_id:
                    if user_id is not None and entry.get("user_id") != user_id:
                        return None
                    return entry
            return None

    # --- uploads -----------------------------------------------------
    def save_upload(self, file_bytes: bytes, original_name: str, user_id: Optional[str] = None) -> Dict[str, Any]:
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
            "ts": time.time(),
        }
        self.record(entry)
        return entry

    def read_file(self, file_id: str) -> Optional[Path]:
        for directory in (UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR):
            for p in directory.iterdir():
                if p.is_file() and p.stem == file_id:
                    return p
        return None

    def save_output(self, file_id: str, content: bytes, ext: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        dest = OUTPUT_DIR / f"{file_id}{('.' + ext) if ext else ''}"
        dest.write_bytes(content)
        entry = {
            "id": file_id,
            "user_id": user_id,
            "stored_name": dest.name,
            "path": str(dest),
            "ext": ext,
            "size": len(content),
            "kind": "output",
            "ts": time.time(),
        }
        self.record(entry)
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

    # --- cleanup -----------------------------------------------------
    def cleanup_old(self) -> int:
        """Remove files older than CLEANUP_AFTER_HOURS. Returns count removed."""
        import time as _time
        cutoff = _time.time() - (CLEANUP_AFTER_HOURS * 3600)
        removed = 0
        with _lock:
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
