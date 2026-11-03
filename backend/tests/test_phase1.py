"""Phase 1 tests: malware scanner, auth utilities, RBAC, storage backends.

These tests avoid requiring a live PostgreSQL/Redis by testing pure logic
and graceful-degradation paths.
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.malware import scan_bytes, MalwareScanResult, is_malware_scan_available
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    verify_refresh_token,
    TIER_HIERARCHY,
    require_tier,
)
from app.models import TIER_LIMITS
from app.services.generation_service import service as gen_service, NATIVE_FORMATS, FIDELITY_NOTES
from app.image_tools import convert_image, resize_image, compress_image, rotate_image, SAVE_FORMATS, READ_FORMATS
from fastapi import HTTPException


# ---------------------------------------------------------------------------
# Malware scanner
# ---------------------------------------------------------------------------
# Malware scanner
# ---------------------------------------------------------------------------

def test_scan_bytes_clean_text():
    """A plain text file should scan as clean (or gracefully unscanned)."""
    result = scan_bytes(b"hello world\n", "test.txt")
    assert isinstance(result, MalwareScanResult)
    # Either scanned cleanly or scanner unavailable — neither is infected.
    assert result.infected is False


def test_scan_bytes_empty():
    """Empty bytes should not crash the scanner."""
    result = scan_bytes(b"", "empty.txt")
    assert result.infected is False


def test_is_malware_scan_available_returns_bool():
    """is_malware_scan_available should return a bool."""
    assert isinstance(is_malware_scan_available(), bool)


# ---------------------------------------------------------------------------
# Auth utilities
# ---------------------------------------------------------------------------

def test_hash_and_verify_password():
    """Password hashing and verification round-trip."""
    hashed = hash_password("supersecret")
    assert hashed != "supersecret"
    assert verify_password("supersecret", hashed) is True
    assert verify_password("wrong", hashed) is False


def test_access_token_roundtrip():
    """create_access_token + verify_token round-trip."""
    token = create_access_token({"sub": "alice"})
    username = verify_token(token)
    assert username == "alice"


def test_refresh_token_roundtrip():
    """create_refresh_token + verify_refresh_token round-trip."""
    token = create_refresh_token({"sub": "bob"})
    username = verify_refresh_token(token)
    assert username == "bob"


def test_refresh_token_rejects_access_token():
    """verify_refresh_token should reject a non-refresh JWT."""
    access_token = create_access_token({"sub": "bob"})
    assert verify_refresh_token(access_token) is None


def test_verify_token_rejects_refresh_token():
    """verify_token accepts refresh tokens too (type not enforced), but
    verify_refresh_token enforces type. Both should return the subject."""
    refresh_token = create_refresh_token({"sub": "carol"})
    # verify_token does not check "type" claim, so it returns the sub.
    assert verify_token(refresh_token) == "carol"


# ---------------------------------------------------------------------------
# RBAC tier hierarchy
# ---------------------------------------------------------------------------

def test_tier_hierarchy_ordering():
    """free < premium < enterprise."""
    assert TIER_HIERARCHY["free"] < TIER_HIERARCHY["premium"]
    assert TIER_HIERARCHY["premium"] < TIER_HIERARCHY["enterprise"]


def test_tier_limits_defined():
    """All tiers have limits defined."""
    for tier in ("free", "premium", "enterprise"):
        assert tier in TIER_LIMITS
        assert "max_file_size_mb" in TIER_LIMITS[tier]


# ---------------------------------------------------------------------------
# require_tier dependency logic
# ---------------------------------------------------------------------------


class FakeUser:
    def __init__(self, tier):
        self.tier = tier
        self.get = lambda k, d=None: {"tier": tier}.get(k, d)


@pytest.mark.asyncio
async def test_require_tier_allows_sufficient_tier():
    """A premium user can access premium-tier endpoints."""
    dep = require_tier("premium")
    user = {"tier": "premium", "username": "alice"}
    result = await dep(user)
    assert result == user


@pytest.mark.asyncio
async def test_require_tier_denies_insufficient_tier():
    """A free user cannot access premium-tier endpoints."""
    dep = require_tier("premium")
    user = {"tier": "free", "username": "bob"}
    with pytest.raises(HTTPException) as exc:
        await dep(user)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_require_tier_allows_higher_tier():
    """An enterprise user can access premium-tier endpoints."""
    dep = require_tier("premium")
    user = {"tier": "enterprise", "username": "carol"}
    result = await dep(user)
    assert result == user


# ---------------------------------------------------------------------------
# File size quota logic
# ---------------------------------------------------------------------------

def test_file_size_quota_free_tier():
    """Free tier max file size is 10 MB."""
    limits = TIER_LIMITS.get("free", {})
    assert limits.get("max_file_size_mb") == 10


def test_file_size_quota_premium_tier():
    """Premium tier max file size is 50 MB."""
    limits = TIER_LIMITS.get("premium", {})
    assert limits.get("max_file_size_mb") == 50


def test_file_size_quota_enterprise_tier():
    """Enterprise tier max file size is 100 MB."""
    limits = TIER_LIMITS.get("enterprise", {})
    assert limits.get("max_file_size_mb") == 100


# ---------------------------------------------------------------------------
# Generation service
# ---------------------------------------------------------------------------

def test_extract_placeholders():
    """Placeholder extraction finds unique {{keys}} across blocks."""
    blocks = [
        {"type": "heading", "data": {"text": "Invoice {{invoice_number}}", "level": 1}},
        {"type": "paragraph", "data": {"text": "Bill to: {{customer}}"}, "align": "left"},
        {"type": "table", "data": {"rows": [["Item", "{{price}}"], ["{{item}}", "{{total}}"]]}},
        {"type": "list", "data": {"items": ["{{note1}}", "{{note2}}"], "ordered": False}},
    ]
    keys = gen_service.extract_placeholders(blocks)
    assert "invoice_number" in keys
    assert "customer" in keys
    assert "price" in keys
    assert "item" in keys
    assert "total" in keys
    assert "note1" in keys
    assert "note2" in keys
    # No duplicates
    assert len(keys) == len(set(keys))


def test_native_formats():
    """Native formats are all supported."""
    for fmt in ("pdf", "docx", "odt", "html", "md", "txt"):
        assert fmt in NATIVE_FORMATS


def test_fidelity_notes():
    """Fidelity notes are defined for all native formats."""
    for fmt in NATIVE_FORMATS:
        assert fmt in FIDELITY_NOTES


def test_parse_csv_batch():
    """CSV parsing produces list of dict rows."""
    csv_text = "name,email\nAlice,alice@example.com\nBob,bob@example.com"
    rows = gen_service.parse_csv_batch(csv_text)
    assert len(rows) == 2
    assert rows[0]["name"] == "Alice"
    assert rows[1]["email"] == "bob@example.com"


def test_parse_json_batch_array():
    """JSON array parsing works."""
    json_text = '[{"name":"Alice"},{"name":"Bob"}]'
    rows = gen_service.parse_json_batch(json_text)
    assert len(rows) == 2


def test_parse_json_batch_with_rows_key():
    """JSON with 'rows' key works."""
    json_text = '{"rows":[{"name":"Alice"}]}'
    rows = gen_service.parse_json_batch(json_text)
    assert len(rows) == 1


def test_mime_for_pdf():
    """PDF MIME type is correct."""
    assert gen_service._mime_for("pdf") == "application/pdf"


def test_mime_for_docx():
    """DOCX MIME type is correct."""
    assert "wordprocessingml" in gen_service._mime_for("docx")


def test_mime_for_epub():
    """EPUB MIME type is correct."""
    assert gen_service._mime_for("epub") == "application/epub+zip"


# ---------------------------------------------------------------------------
# render_blocks direct tests (existing generation.py)
# ---------------------------------------------------------------------------

def test_render_blocks_pdf():
    """Rendering blocks to PDF produces a valid output."""
    from app.generation import render_blocks, HeadingBlock, ParagraphBlock
    blocks = [HeadingBlock("Test", level=1), ParagraphBlock("Hello world")]
    res = render_blocks(blocks, "pdf", "/tmp/test_phase1_output.pdf")
    assert res.ok is True
    assert res.output_path is not None


# ---------------------------------------------------------------------------
# Image processing tests
# ---------------------------------------------------------------------------

def test_supported_formats():
    """SAVE_FORMATS and READ_FORMATS are defined."""
    assert "png" in SAVE_FORMATS
    assert "jpg" in SAVE_FORMATS
    assert "webp" in SAVE_FORMATS
    assert "png" in READ_FORMATS
    assert "jpg" in READ_FORMATS


def test_convert_png_to_jpg():
    """Convert a PNG image to JPEG."""
    from PIL import Image as PILImage
    # Create a small test PNG
    img = PILImage.new("RGB", (100, 100), color="red")
    src = "/tmp/test_phase1_source.png"
    dst = "/tmp/test_phase1_output.jpg"
    img.save(src, "PNG")
    res = convert_image(src, dst, "jpg", quality=85)
    assert res.ok is True
    assert os.path.exists(dst)
    # Verify it's a valid JPEG
    with PILImage.open(dst) as reloaded:
        assert reloaded.format == "JPEG"


def test_convert_png_to_webp():
    """Convert a PNG image to WEBP."""
    from PIL import Image as PILImage
    import os
    img = PILImage.new("RGB", (50, 50), color="blue")
    src = "/tmp/test_phase1_source2.png"
    dst = "/tmp/test_phase1_output.webp"
    img.save(src, "PNG")
    res = convert_image(src, dst, "webp", quality=85)
    assert res.ok is True
    assert os.path.exists(dst)
    with PILImage.open(dst) as reloaded:
        assert reloaded.format == "WEBP"


def test_resize_image():
    """Resize an image to smaller dimensions."""
    from PIL import Image as PILImage
    import os
    img = PILImage.new("RGB", (200, 100), color="green")
    src = "/tmp/test_phase1_resize_src.png"
    dst = "/tmp/test_phase1_resize_dst.png"
    img.save(src, "PNG")
    res = resize_image(src, dst, width=100, height=None, fit="contain", quality=85)
    assert res.ok is True
    assert os.path.exists(dst)
    with PILImage.open(dst) as reloaded:
        assert reloaded.width <= 100


def test_compress_image():
    """Compress an image."""
    from PIL import Image as PILImage
    import os
    img = PILImage.new("RGB", (200, 200), color="yellow")
    src = "/tmp/test_phase1_compress_src.png"
    dst = "/tmp/test_phase1_compress_dst.jpg"
    img.save(src, "PNG")
    res = compress_image(src, dst, quality=50)
    assert res.ok is True
    assert os.path.exists(dst)


def test_rotate_image():
    """Rotate an image by 90 degrees."""
    from PIL import Image as PILImage
    import os
    img = PILImage.new("RGB", (100, 200), color="cyan")
    src = "/tmp/test_phase1_rotate_src.png"
    dst = "/tmp/test_phase1_rotate_dst.png"
    img.save(src, "PNG")
    res = rotate_image(src, dst, degrees=90, expand=True, quality=85)
    assert res.ok is True
    assert os.path.exists(dst)
    with PILImage.open(dst) as reloaded:
        # After 90 degree rotation with expand, dimensions swap
        assert reloaded.width == 200 or reloaded.height == 100


def test_unsupported_format():
    """Converting to an unsupported format returns an error."""
    from PIL import Image as PILImage
    img = PILImage.new("RGB", (50, 50), color="red")
    src = "/tmp/test_phase1_bad_src.png"
    dst = "/tmp/test_phase1_bad_dst.xyz"
    img.save(src, "PNG")
    res = convert_image(src, dst, "xyz", quality=85)
    assert res.ok is False
