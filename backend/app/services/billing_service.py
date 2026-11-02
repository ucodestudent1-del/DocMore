"""Billing service skeleton.

Wraps Stripe payment processing behind a stable interface.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from app.payments import create_checkout_session as _create_checkout_session
from app.payments import handle_webhook as _handle_webhook


class BillingService:
    TIER_PRICING = {
        "free": {"monthly": 0, "yearly": 0},
        "premium": {"monthly": 999, "yearly": 9990},
        "enterprise": {"monthly": 4999, "yearly": 49990},
    }

    def create_checkout_session(
        self,
        user_id: str,
        tier: str,
        interval: str = "monthly",
    ) -> Dict[str, Any]:
        return _create_checkout_session(user_id, tier, interval)

    def handle_webhook(self, payload: bytes, sig_header: str) -> Dict[str, Any]:
        return _handle_webhook(payload, sig_header)

    def tier_pricing(self, tier: str, interval: str = "monthly") -> int:
        return self.TIER_PRICING.get(tier, {}).get(interval, 0)

    def is_configured(self) -> bool:
        import os
        return bool(os.getenv("STRIPE_SECRET_KEY"))
