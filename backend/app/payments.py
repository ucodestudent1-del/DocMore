"""Payment processing with Stripe — idempotent webhooks, customer portal, subscription management."""

import os
from typing import Optional
from fastapi import HTTPException
from datetime import datetime, timezone

try:
    import stripe
    _HAS_STRIPE = True
except ImportError:
    stripe = None
    _HAS_STRIPE = False

from app.config import STRIPE_SECRET_KEY, FRONTEND_URL
from app.prisma_client import get_prisma

if _HAS_STRIPE and STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


# Subscription tier pricing (in cents)
TIER_PRICING = {
    "free": {"monthly": 0, "yearly": 0},
    "premium": {"monthly": 999, "yearly": 9990},   # $9.99/mo, $99.90/yr
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
            customer_email=None,
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


def create_customer_portal_session(customer_id: str) -> dict:
    """Create a Stripe customer portal session for subscription management."""
    if not _HAS_STRIPE or not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payment processing not configured")

    try:
        portal_session = stripe.billingportal.Session.create(
            customer=customer_id,
            return_url=f"{FRONTEND_URL}/settings",
        )
        return {"portal_url": portal_session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Portal session error: {str(e)}")


async def handle_webhook(payload: bytes, sig_header: str) -> dict:
    """Handle Stripe webhook events with idempotency.

    Tracks processed events in the audit log / a dedicated events table
    (via Prisma) so duplicate webhook deliveries are safely ignored.
    """
    if not _HAS_STRIPE:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_id = event.get("id")
    event_type = event.get("type")

    # Idempotency: check if we already processed this event
    prisma = get_prisma()
    existing = await prisma.auditlog.find_first(
        where={
            "action": "STRIPE_WEBHOOK",
            "target": event_id,
        },
    )
    if existing:
        return {"status": "ignored", "event_type": event_type, "reason": "already_processed"}

    data = event.get("data", {}).get("object", {})
    metadata = data.get("metadata", {})
    user_id = metadata.get("user_id")
    tier = metadata.get("tier")

    try:
        if event_type == "checkout.session.completed":
            if user_id and tier:
                await _update_user_tier_prisma(user_id, tier)
                await _record_webhook_event(prisma, event_id, event_type, user_id, tier)
                return {"status": "success", "action": "subscription_updated", "user_id": user_id, "tier": tier}

        elif event_type == "customer.subscription.updated":
            if user_id and tier:
                await _update_user_tier_prisma(user_id, tier)
                await _record_webhook_event(prisma, event_id, event_type, user_id, tier)
                return {"status": "success", "action": "subscription_updated", "user_id": user_id, "tier": tier}

        elif event_type == "customer.subscription.deleted":
            if user_id:
                await _update_user_tier_prisma(user_id, "free")
                await _record_webhook_event(prisma, event_id, event_type, user_id, "free")
                return {"status": "success", "action": "subscription_cancelled", "user_id": user_id}

        await _record_webhook_event(prisma, event_id, event_type, user_id, tier or "ignored")
        return {"status": "ignored", "event_type": event_type}
    finally:
        await prisma.disconnect()


async def _update_user_tier_prisma(user_id: str, tier: str) -> None:
    """Update user tier in PostgreSQL via Prisma."""
    prisma = get_prisma()
    try:
        await prisma.user.update(
            where={"id": user_id},
            data={"tier": tier},
        )
    except Exception:
        # User may not exist yet; try by username
        await prisma.user.update(
            where={"username": user_id},
            data={"tier": tier},
        )
    finally:
        await prisma.disconnect()


async def _record_webhook_event(prisma, event_id: str, event_type: str, user_id: Optional[str], tier: Optional[str]) -> None:
    """Record a processed webhook event for idempotency."""
    await prisma.auditlog.create({
        "action": "STRIPE_WEBHOOK",
        "target": event_id,
        "targetId": None,
        "metadata": {
            "event_type": event_type,
            "user_id": user_id,
            "tier": tier,
        },
        "createdAt": datetime.now(timezone.utc),
    })


def get_tier_pricing(tier: str, interval: str = "monthly") -> int:
    """Return price in cents for a tier/interval."""
    return TIER_PRICING.get(tier, {}).get(interval, 0)


def is_configured() -> bool:
    return bool(STRIPE_SECRET_KEY) and _HAS_STRIPE


__all__ = [
    "create_checkout_session",
    "create_customer_portal_session",
    "handle_webhook",
    "get_tier_pricing",
    "is_configured",
    "TIER_PRICING",
    "TIER_NAMES",
]
