"""Payment processing with Stripe."""

import stripe
from decimal import Decimal
from typing import Dict, Any, Optional
from fastapi import HTTPException

from app.config import STRIPE_SECRET_KEY

stripe.api_key = SECRET_KEY


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
            ],
            mode="subscription",
            customer_email=None,  # Will be set by customer
            metadata={
                "user_id": user_id,
                "tier": tier,
                "interval": interval,
            },
            success_url=f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/settings?payment=success&session_id={CHECKOUT_SESSION_ID_PLACEHOLDER}",
            cancel_url=f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/settings?payment=cancelled",
        )
        return {"checkout_url": checkout_session.url, "session_id": checkout_session.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payment processing error: {str(e)}")


def handle_webhook(payload: bytes, sig_header: str) -> dict:
    """Handle Stripe webhook events."""
    import os
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
        interval = metadata.get("interval", "monthly")

        if user_id and tier:
            from app.database import async_session
            from app.models import User
            from sqlalchemy import update

            async def _update_tier():
                async with async_session() as db:
                    from sqlalchemy import update as sql_update
                    stmt = sql_update(User).where(User.username == user_id).values(tier=tier)
                    await db.execute(stmt)
                    await db.commit()

            import asyncio
            asyncio.create_task(_update_tier())

            return {"status": "success", "action": "subscription_updated", "user_id": user_id, "tier": tier}

    elif event_type == "customer.subscription.updated":
        # Subscription updated
        metadata = data.get("metadata", {})
        user_id = metadata.get("user_id")
        tier = metadata.get("tier")

        if user_id and tier:
            async def _update_tier():
                async with async_session() as db:
                    from sqlalchemy import update as sql_update
                    stmt = sql_update(User).where(User.username == user_id).values(tier=tier)
                    await db.execute(stmt)
                    await db.commit()

            import asyncio
            asyncio.create_task(_update_tier())

            return {"status": "success", "action": "subscription_updated", "user_id": user_id, "tier": tier}

    elif event_type == "customer.subscription.deleted":
        # Subscription cancelled - downgrade to free
        metadata = data.get("metadata", {})
        user_id = metadata.get("user_id")

        if user_id:
            async def _downgrade():
                async with async_session() as db:
                    from sqlalchemy import update as sql_update
                    stmt = sql_update(User).where(User.username == user_id).values(tier="free")
                    await db.execute(stmt)
                    await db.commit()

            import asyncio
            asyncio.create_task(_downgrade())

            return {"status": "success", "action": "subscription_cancelled", "user_id": user_id}

    return {"status": "ignored", "event_type": event_type}