"""Security utilities: file validation, sanitization, safe paths."""

import os
import re
import secrets
import mimetypes
from pathlib import Path
from typing import Tuple, Set

from app.config import (
    UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR, MAX_FILE_SIZE,
    ALLOWED_EXTENSIONS, MAGIC_SIGNATURES,
)

try:
    import magic  # type: ignore
    _HAS_MAGIC = True
except Exception:  # libmagic not available (e.g. Windows)
    _HAS_MAGIC = False

FORBIDDEN_NAME_PATTERNS = re.compile(r"[<>:\"\\|\?\*/\x00-\x1f]")
PATH_TRAVERSAL = re.compile(r"(\.\./|%2e%2e|\\\\|\.\\)")


class SecurityError(Exception):
    pass


def sanitize_filename(filename: str) -> str:
    """Return a safe basename, stripping directory components."""
    name = os.path.basename(filename)
    name = FORBIDDEN_NAME_PATTERNS.sub("_", name).strip()
    if not name or name in {".", ".."}:
        name = "file"
    return name[:200]


def randomized_name(original: str) -> str:
    """Generate a randomized filename preserving the original extension."""
    ext = os.path.splitext(original)[1].lower()
    return f"{secrets.token_urlsafe(16)}{ext}"


def is_path_safe(relative_path: str) -> bool:
    """Reject path traversal attempts."""
    if not relative_path:
        return False
    if PATH_TRAVERSAL.search(relative_path):
        return False
    if relative_path.startswith(("/", "\\")):
        return False
    normalized = os.path.normpath(relative_path)
    return normalized == relative_path and not normalized.startswith("..")


def validate_upload(file_bytes: bytes, filename: str) -> Tuple[str, str, int]:
    """Validate an uploaded file. Returns (detected_extension, mime_type, size).

    Raises SecurityError on any validation failure.
    """
    size = len(file_bytes)
    if size == 0:
        raise SecurityError("Empty file")
    if size > MAX_FILE_SIZE:
        raise SecurityError(f"File too large: {size} bytes (max {MAX_FILE_SIZE})")

    safe_name = sanitize_filename(filename)
    ext = os.path.splitext(safe_name)[1].lower().lstrip(".")
    if ext and ext not in ALLOWED_EXTENSIONS:
        raise SecurityError(f"Unsupported file extension: .{ext}")

    # MIME detection via magic bytes (with pure-Python fallback)
    if _HAS_MAGIC:
        try:
            mime = magic.from_buffer(file_bytes, mime=True)
        except Exception:
            mime = "application/octet-stream"
    else:
        mime = mimetypes.guess_type(safe_name)[0] or "application/octet-stream"

    # Magic-byte signature check for known binary formats
    for sig, exts in MAGIC_SIGNATURES.items():
        if file_bytes.startswith(sig):
            if sig == b"RIFF":
                # WEBP: check for WEBP marker at offset 8
                if file_bytes[8:12] != b"WEBP":
                    raise SecurityError("Invalid RIFF/WebP file")
                if ext and ext not in {"webp"}:
                    raise SecurityError(f"Extension .{ext} does not match WebP content")
                return "webp", mime, size
            if ext and ext not in exts:
                raise SecurityError(
                    f"Extension .{ext} does not match detected content type"
                )
            detected = ext if ext in exts else (next(iter(exts)) if exts else ext)
            return detected, mime, size

    # Text-based files: validate by extension and content heuristic
    if ext in {"txt", "md", "html", "htm", "xml", "json", "csv", "tsv", "rtf"}:
        try:
            file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                file_bytes.decode("latin-1")
            except UnicodeDecodeError:
                raise SecurityError("File content is not valid text")
        return ext, mime, size

    # Unknown binary extension: allow if extension is in allowlist
    if ext:
        return ext, mime, size

    raise SecurityError("Could not determine file type")


def safe_output_path(file_id: str, output_dir: Path = OUTPUT_DIR) -> Path:
    """Build a safe output path from a file id (no user-controlled segments)."""
    safe = FORBIDDEN_NAME_PATTERNS.sub("_", file_id)
    if not safe or safe in {".", ".."}:
        raise SecurityError("Invalid file id")
    return output_dir / f"{safe}"


def ensure_within(base: Path, target: Path) -> Path:
    """Ensure target path resolves within base directory."""
    base_resolved = base.resolve()
    target_resolved = target.resolve()
    try:
        target_resolved.relative_to(base_resolved)
    except ValueError:
        raise SecurityError("Path escapes allowed directory")
    return target_resolved
