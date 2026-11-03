"""Payment routes: Stripe checkout, customer portal, webhooks, subscription."""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.payments import (
    create_checkout_session,
    create_customer_portal_session,
    handle_webhook,
    is_configured,
    TIER_PRICING,
)
from app.api.routes.auth import get_current_user
from app.prisma_client import get_prisma

router = APIRouter(tags=["payments"])


class CheckoutRequest(BaseModel):
    tier: str
    interval: str = "monthly"


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class PortalResponse(BaseModel):
    portal_url: str


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    request: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a Stripe Checkout session for subscription upgrade."""
    result = create_checkout_session(current_user["username"], request.tier, request.interval)
    return CheckoutResponse(checkout_url=result["checkout_url"], session_id=result["session_id"])


@router.post("/portal", response_model=PortalResponse)
async def customer_portal(
    current_user: dict = Depends(get_current_user),
):
    """Create a Stripe customer portal session for subscription management."""
    prisma = get_prisma()
    try:
        user = await prisma.user.find_unique(where={"id": current_user["username"]})
        if not user:
            user = await prisma.user.find_unique(where={"username": current_user["username"]})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Find or create Stripe customer
        stripe_customer_id = None
        # Check subscription for stripe customer id
        sub = await prisma.subscription.find_first(where={"userId": current_user["username"]})
        if sub and sub.stripeCustomerId:
            stripe_customer_id = sub.stripeCustomerId

        if not stripe_customer_id:
            # Create a Stripe customer
            import stripe as stripe_lib
            customer = stripe_lib.Customer.create(
                email=user.email,
                metadata={"user_id": user.id},
            )
            stripe_customer_id = customer.id
            await prisma.subscription.upsert(
                where={"userId": current_user["username"]},
                data={
                    "create": {
                        "userId": current_user["username"],
                        "stripeCustomerId": stripe_customer_id,
                        "status": "incomplete",
                        "tier": user.tier,
                    },
                    "update": {
                        "stripeCustomerId": stripe_customer_id,
                    },
                },
            )

        result = create_customer_portal_session(stripe_customer_id)
        return PortalResponse(portal_url=result["portal_url"])
    finally:
        await prisma.disconnect()


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events (idempotent)."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    result = await handle_webhook(payload, sig_header)
    return JSONResponse(content=result)


@router.get("/subscription")
async def get_subscription(
    current_user: dict = Depends(get_current_user),
):
    """Get the current user's subscription status."""
    prisma = get_prisma()
    try:
        sub = await prisma.subscription.find_first(where={"userId": current_user["username"]})
        if not sub:
            return {
                "tier": current_user.get("tier", "free"),
                "status": "inactive",
                "stripeCustomerId": None,
                "stripeSubscriptionId": None,
                "currentPeriodStart": None,
                "currentPeriodEnd": None,
                "cancelAtPeriodEnd": False,
            }
        return {
            "tier": sub.tier,
            "status": sub.status,
            "stripeCustomerId": sub.stripeCustomerId,
            "stripeSubscriptionId": sub.stripeSubscriptionId,
            "currentPeriodStart": sub.currentPeriodStart.isoformat() if sub.currentPeriodStart else None,
            "currentPeriodEnd": sub.currentPeriodEnd.isoformat() if sub.currentPeriodEnd else None,
            "cancelAtPeriodEnd": sub.cancelAtPeriodEnd,
        }
    finally:
        await prisma.disconnect()


@router.get("/pricing")
async def get_pricing():
    """Public pricing endpoint — returns tier pricing."""
    return {
        "tiers": [
            {
                "id": tier,
                "name": TIER_PRICING[tier],
                "monthly": TIER_PRICING[tier].get("monthly", 0),
                "yearly": TIER_PRICING[tier].get("yearly", 0),
            }
            for tier in ("free", "premium", "enterprise")
        ],
    }


@router.get("/configured")
async def is_configured_endpoint():
    """Check if Stripe is configured."""
    return {"configured": is_configured()}


__all__ = ["router"]
