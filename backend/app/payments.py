"""Payment processing with Stripe."""

import os
from typing import Dict, Any, Optional
from fastapi import HTTPException

try:
    import stripe
    _HAS_STRIPE = True
except ImportError:
    stripe = None
    _HAS_STRIPE = False

from app.config import STRIPE_SECRET_KEY, FRONTEND_URL

if _HAS_STRIPE and STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


# Subscription tier pricing (in cents)
TIER_PRICING = {
    "free": {"monthly": 0, "yearly": 0},
    "premium": {"monthly": 999, "yearly": 9990},  # $9.99/mo, $99.90/yr
    "enterprise": {"monthly": 4999, "yearly": 49990},  # $49.99/mo, $499.90/yr
}

TIER_NAMES = {
    "free": "Free",
    "premium": "Premium",
    "enterprise": "Enterprise",
}


def create_checkout_session(user_id: str, tier: str, interval: str = "monthly") -> dict:
    """Create a Stripe Checkout session for subscription."""
    if not _HAS_STRIPE or not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payment processing not configured")

    if tier not in TIER_PRICING:
        raise ValueError(f"Invalid tier: {tier}")

    price_cents = TIER_PRICING[tier].get(interval, 0)
    if price_cents == 0:
        raise ValueError(f"Invalid tier/interval combination: {tier}/{interval}")

    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"{TIER_NAMES[tier]} Subscription",
                        "description": f"{tier.capitalize()} tier subscription ({interval})",
                    },
                    "unit_amount": price_cents,
                    "recurring": {"interval": interval},
                },
                "quantity": 1,
            }],
            mode="subscription",
            customer_email=None,  # Will be set by customer
            metadata={
                "user_id": user_id,
                "tier": tier,
                "interval": interval,
            },
            success_url=f"{FRONTEND_URL}/settings?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/settings?payment=cancelled",
        )
        return {"checkout_url": checkout_session.url, "session_id": checkout_session.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payment processing error: {str(e)}")


def handle_webhook(payload: bytes, sig_header: str) -> dict:
    """Handle Stripe webhook events."""
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_placeholder")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        # Subscription checkout completed
        metadata = data.get("metadata", {})
        user_id = metadata.get("user_id")
        tier = metadata.get("tier")

        if user_id and tier:
            _update_user_tier(user_id, tier)
            return {"status": "success", "action": "subscription_updated", "user_id": user_id, "tier": tier}

    elif event_type == "customer.subscription.updated":
        # Subscription updated
        metadata = data.get("metadata", {})
        user_id = metadata.get("user_id")
        tier = metadata.get("tier")

        if user_id and tier:
            _update_user_tier(user_id, tier)
            return {"status": "success", "action": "subscription_updated", "user_id": user_id, "tier": tier}

    elif event_type == "customer.subscription.deleted":
        # Subscription cancelled - downgrade to free
        metadata = data.get("metadata", {})
        user_id = metadata.get("user_id")

        if user_id:
            _update_user_tier(user_id, "free")
            return {"status": "success", "action": "subscription_cancelled", "user_id": user_id}

    return {"status": "ignored", "event_type": event_type}


def _update_user_tier(user_id: str, tier: str) -> None:
    """Update user tier in database (synchronous, called from webhook handler)."""
    import asyncio
    from app.database import async_session
    from app.models import User
    from sqlalchemy import update as sql_update

    async def _do_update():
        async with async_session() as db:
            stmt = sql_update(User).where(User.username == user_id).values(tier=tier)
            await db.execute(stmt)
            await db.commit()

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # We're in an async context; schedule but don't await
            asyncio.ensure_future(_do_update())
        else:
            loop.run_until_complete(_do_update())
    except RuntimeError:
        asyncio.run(_do_update())
