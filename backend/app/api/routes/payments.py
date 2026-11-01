"""Payment routes: Stripe checkout and webhooks."""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.payments import create_checkout_session, handle_webhook
from app.api.routes.auth import get_current_user

router = APIRouter(tags=["payments"])


class CheckoutRequest(BaseModel):
    tier: str
    interval: str = "monthly"


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    request: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a Stripe Checkout session for subscription upgrade."""
    result = await create_checkout_session(current_user["username"], request.tier, request.interval)
    return CheckoutResponse(checkout_url=result["checkout_url"], session_id=result["session_id"])


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    result = await handle_webhook(payload, sig_header)
    return JSONResponse(content=result)