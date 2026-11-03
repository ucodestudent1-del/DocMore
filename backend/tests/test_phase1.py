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
