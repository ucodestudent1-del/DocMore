"""Email service using SendGrid for transactional emails."""

import os
from typing import Optional, List
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, From, To, Subject, PlainTextContent, HtmlContent

from app.config import SENDGRID_API_KEY, SENDGRID_FROM_EMAIL


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    plain_text_content: Optional[str] = None,
) -> bool:
    """Send an email via SendGrid."""
    if not SENDGRID_API_KEY or SENDGRID_API_KEY == "your-sendgrid-api-key":
        # In development, just log the email
        print(f"[EMAIL] To: {to_email}")
        print(f"[EMAIL] Subject: {subject}")
        print(f"[EMAIL] Content: {plain_text_content or html_content[:200]}...")
        return True

    try:
        message = Mail(
            from_email=From(SENDGRID_FROM_EMAIL, "EveryDoc"),
            to_emails=To(to_email),
            subject=Subject(subject),
            plain_text_content=PlainTextContent(plain_text_content or ""),
            html_content=HtmlContent(html_content),
        )
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        return response.status_code in (200, 201, 202)
    except Exception as e:
        print(f"Email send error: {e}")
        return False


def send_welcome_email(to_email: str, username: str) -> bool:
    """Send welcome email after registration."""
    html = f"""
    <h1>Welcome to EveryDoc, {username}!</h1>
    <p>Welcome to Universal Document Studio. You can now convert, generate, and manage documents.</p>
    <p>Get started by uploading your first document at <a href="{os.getenv('FRONTEND_URL', 'http://localhost:3000')}">{os.getenv('FRONTEND_URL', 'http://localhost:3000')}</a></p>
    """
    return send_email(to_email, "Welcome to EveryDoc", html, f"Welcome to EveryDoc, {username}! Welcome to Universal Document Studio.")

async def send_password_reset(to_email: str, username: str, reset_token: str) -> bool:
    """Send password reset email."""
    reset_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token={reset_token}"
    html = f"""
    <h1>Password Reset</h1>
    <p>You requested a password reset for your EveryDoc account.</p>
    <p>Click the link below to reset your password:</p>
    <p><a href="{reset_url}">Reset Password</a></p>
    <p>If you didn't request this, please ignore this email.</p>
    """
    return send_email(to_email, "Reset Your Password", html, f"Reset your password at {reset_url}")


async def send_subscription_confirmation(to_email: str, username: str, tier: str) -> bool:
    """Send subscription confirmation email."""
    html = f"""
    <h1>Subscription Confirmed</h1>
    <p>Hi {username},</p>
    <p>Your EveryDoc subscription has been upgraded to <strong>{tier.capitalize()}</strong>!</p>
    <p>Enjoy your enhanced document processing capabilities.</p>
    """
    return send_email(to_email, "Subscription Confirmed", html, f"Hi {username}, your EveryDoc subscription has been upgraded to {tier}!")