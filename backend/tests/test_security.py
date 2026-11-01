"""Unit tests for security validation."""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.security import validate_upload, SecurityError, sanitize_filename, is_path_safe


def test_valid_txt():
    ext, mime, size = validate_upload(b"hello world", "note.txt")
    assert ext == "txt"
    assert size == 11


def test_valid_pdf():
    ext, mime, size = validate_upload(b"%PDF-1.4\n%%EOF", "doc.pdf")
    assert ext == "pdf"
    assert size > 0


def test_valid_png():
    ext, mime, size = validate_upload(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100, "img.png")
    assert ext == "png"


def test_rejects_exe():
    try:
        validate_upload(b"MZ\x90\x00\x03", "evil.exe")
        assert False, "should have raised"
    except SecurityError:
        pass


def test_rejects_empty():
    try:
        validate_upload(b"", "empty.txt")
        assert False, "should have raised"
    except SecurityError:
        pass


def test_rejects_unsupported_extension():
    try:
        validate_upload(b"\x89PNG\r\n\x1a\n" + b"\x00" * 10, "weird.xyz")
        assert False, "should have raised"
    except SecurityError:
        pass


def test_sanitize_filename():
    assert sanitize_filename("../evil.txt") == "evil.txt"
    assert sanitize_filename("a/b/c.txt") == "c.txt"
    assert sanitize_filename("") == "file"


def test_is_path_safe():
    assert is_path_safe("file.txt") is True
    assert is_path_safe("../etc/passwd") is False
    assert is_path_safe("/etc/passwd") is False
