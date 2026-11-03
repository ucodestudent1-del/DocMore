"""Usage tracking and quota enforcement for DocStudio.

Tracks per-user, per-month usage (conversions, storage MB) and enforces
tier-based limits:
- max file size per upload
- max conversions per hour
- max concurrent jobs

Usage records are stored in PostgreSQL via Prisma (UsageRecord model).
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models import TIER_LIMITS
from app.prisma_client import get_prisma


class QuotaExceeded(Exception):
    """Raised when a user exceeds their tier quota."""

    def __init__(self, message: str, limit_type: str, current: int, limit: int):
        super().__init__(message)
        self.limit_type = limit_type
        self.current = current
        self.limit = limit


class UsageService:
    def __init__(self) -> None:
        self._month_key = lambda: datetime.now(timezone.utc).strftime("%Y-%m")

    def _current_month(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m")

    def _hour_key(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d-%H")

    def tier_limits(self, tier: str) -> dict:
        """Return the limits dict for a given tier."""
        return TIER_LIMITS.get(tier, TIER_LIMITS["free"])

    async def get_usage(self, user_id: str) -> dict:
        """Get current usage vs limits for a user."""
        prisma = get_prisma()
        month = self._current_month()
        record = await prisma.usage_record.find_unique(
            where={"userId_month": {"userId": user_id, "month": month}},
        )
        # Note: Prisma composite unique requires a different query pattern;
        # fallback to find_many.
        if record is None:
            records = await prisma.usage_record.find_many(
                where={"userId": user_id, "month": month},
                take=1,
            )
            record = records[0] if records else None

        return {
            "month": month,
            "conversions": record.conversions if record else 0,
            "storage_mb": record.storageMB if record else 0,
            "limits": self.tier_limits("free"),
        }

    async def get_user_tier(self, user_id: str) -> str:
        """Return the user's subscription tier."""
        prisma = get_prisma()
        user = await prisma.user.find_unique(where={"id": user_id})
        if user is None:
            return "free"
        return user.tier

    async def check_upload_quota(
        self,
        user_id: str,
        file_size_bytes: int,
    ) -> None:
        """Enforce max file size per upload for the user's tier."""
        tier = await self.get_user_tier(user_id)
        limits = self.tier_limits(tier)
        max_size_mb = limits.get("max_file_size_mb", 10)
        max_size_bytes = max_size_mb * 1024 * 1024
        if file_size_bytes > max_size_bytes:
            raise QuotaExceeded(
                f"File exceeds {tier} tier limit of {max_size_mb} MB",
                "max_file_size",
                file_size_bytes,
                max_size_bytes,
            )

    async def check_conversion_quota(
        self,
        user_id: str,
    ) -> None:
        """Enforce max conversions per hour for the user's tier."""
        tier = await self.get_user_tier(user_id)
        limits = self.tier_limits(tier)
        max_per_hour = limits.get("max_conversions_per_hour", 5)

        prisma = get_prisma()
        hour_start = datetime.now(timezone.utc).replace(
            minute=0, second=0, microsecond=0
        )
        # Count jobs in the current hour
        recent_jobs = await prisma.job.count(
            where={
                "userId": user_id,
                "taskName": {"contains": "convert"},
                "createdAt": {"gte": hour_start},
            },
        )
        if recent_jobs >= max_per_hour:
            raise QuotaExceeded(
                f"Hourly conversion limit ({max_per_hour}) reached for {tier} tier",
                "max_conversions_per_hour",
                recent_jobs,
                max_per_hour,
            )

    async def check_concurrent_jobs(
        self,
        user_id: str,
    ) -> int:
        """Return the number of running/pending jobs for the user."""
        prisma = get_prisma()
        count = await prisma.job.count(
            where={
                "userId": user_id,
                "status": {"in": ["PENDING", "RUNNING"]},
            },
        )
        return count

    async def check_concurrent_job_quota(
        self,
        user_id: str,
    ) -> None:
        """Enforce max concurrent jobs for the user's tier."""
        tier = await self.get_user_tier(user_id)
        limits = self.tier_limits(tier)
        max_concurrent = limits.get("max_concurrent_jobs", 1)
        current = await self.check_concurrent_jobs(user_id)
        if current >= max_concurrent:
            raise QuotaExceeded(
                f"Concurrent job limit ({max_concurrent}) reached for {tier} tier",
                "max_concurrent_jobs",
                current,
                max_concurrent,
            )

    async def record_conversion(
        self,
        user_id: str,
        file_size_bytes: int = 0,
    ) -> None:
        """Increment the user's conversion and storage usage for the current month."""
        prisma = get_prisma()
        month = self._current_month()
        storage_mb = max(1, round(file_size_bytes / (1024 * 1024), 2))

        await prisma.usage_record.upsert(
            where={"userId_month": {"userId": user_id, "month": month}},
            data={
                "create": {
                    "userId": user_id,
                    "month": month,
                    "conversions": 1,
                    "storageMB": int(storage_mb),
                },
                "update": {
                    "conversions": {"increment": 1},
                    "storageMB": {"increment": int(storage_mb)},
                    "updatedAt": datetime.now(timezone.utc),
                },
            },
        )

    async def get_quota_status(self, user_id: str) -> dict:
        """Return a full quota status summary for the frontend."""
        tier = await self.get_user_tier(user_id)
        limits = self.tier_limits(tier)
        prisma = get_prisma()
        month = self._current_month()
        records = await prisma.usage_record.find_many(
            where={"userId": user_id, "month": month},
            take=1,
        )
        record = records[0] if records else None
        conversions = record.conversions if record else 0
        storage_mb = record.storageMB if record else 0
        running = await self.check_concurrent_jobs(user_id)

        return {
            "tier": tier,
            "limits": limits,
            "usage": {
                "conversions_this_hour": 0,  # computed separately if needed
                "conversions_this_month": conversions,
                "storage_mb": storage_mb,
                "concurrent_jobs": running,
            },
            "max_file_size_mb": limits.get("max_file_size_mb", 10),
            "max_conversions_per_hour": limits.get("max_conversions_per_hour", 5),
            "max_concurrent_jobs": limits.get("max_concurrent_jobs", 1),
        }


usage_service = UsageService()

__all__ = ["UsageService", "QuotaExceeded", "usage_service"]
