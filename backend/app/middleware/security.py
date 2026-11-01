"""Security middleware: CSRF protection, security headers, rate limiting."""

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import time
import hmac
import hashlib

# CSRF token secret - in production, this should come from environment variable
CSRF_SECRET = b"csrf-secret-key-change-in-production"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # HSTS - only in production (HTTPS)
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Content Security Policy
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none';"
        )
        response.headers["Content-Security-Policy"] = csp

        return response


class CSRFMiddleware(BaseHTTPMiddleware):
    """CSRF protection for state-changing methods (POST, PUT, DELETE, PATCH)."""

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    def _get_csrf_token(self, request: Request) -> str | None:
        """Extract CSRF token from header or cookie."""
        # Try header first
        token = request.headers.get("X-CSRF-Token")
        if token:
            return token
        # Try cookie
        token = request.cookies.get("csrf_token")
        return token

    def _validate_token(self, token: str | None, secret: bytes) -> bool:
        """Validate CSRF token using HMAC."""
        if not token:
            return False
        try:
            # Token format: timestamp.hmac
            parts = token.split(".")
            if len(parts) != 2:
                return False
            timestamp_str, hmac_hex = parts
            timestamp = float(timestamp_str)
            # Token expires after 24 hours
            if time.time() - timestamp > 86400:
                return False
            expected = hmac.new(secret, timestamp_str.encode(), hashlib.sha256).hexdigest()
            return hmac.compare_digest(expected, hmac_hex)
        except Exception:
            return False

    def _generate_token(self, secret: bytes) -> str:
        """Generate a CSRF token."""
        timestamp = str(time.time())
        token_hmac = hmac.new(secret, timestamp.encode(), hashlib.sha256).hexdigest()
        return f"{timestamp}.{token_hmac}"

    async def dispatch(self, request: Request, call_next):
        # Only protect state-changing methods
        if request.method in ("POST", "PUT", "DELETE", "PATCH"):
            # Skip CSRF for auth endpoints (login/register don't have a token yet)
            if request.url.path.startswith("/api/auth/"):
                response = await call_next(request)
                # Set CSRF token cookie on login/register responses
                if response.status_code in (200, 201):
                    token = self._generate_token(CSRF_SECRET)
                    response.set_cookie(
                        "csrf_token",
                        token,
                        httponly=True,
                        secure=request.url.scheme == "https",
                        samesite="strict",
                        path="/",
                    )
                return response

            # For other state-changing endpoints, require CSRF token
            token = self._get_csrf_token(request)
            if not self._validate_token(token, CSRF_SECRET):
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "CSRF token missing or invalid"},
                )

        response = await call_next(request)

        # Set CSRF token cookie on GET requests to /api/auth/token
        if request.method == "GET" and request.url.path == "/api/auth/token":
            token = self._generate_token(CSRF_SECRET)
            response.set_cookie(
                "csrf_token",
                token,
                httponly=True,
                secure=request.url.scheme == "https",
                samesite="strict",
                path="/",
            )

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware - delegates to app.rate_limiter."""

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        # Get user identifier from auth header or IP
        user_id = None
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
            try:
                from app.auth import verify_token
                username = verify_token(token)
                if username:
                    user_id = username
            except Exception:
                pass

        if not user_id:
            # Fall back to IP for unauthenticated requests
            user_id = request.client.host if request.client else "unknown"

        from app.rate_limiter import check_rate_limit
        allowed, message = check_rate_limit(user_id)
        if not allowed:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": message},
                headers={"Retry-After": "60"},
            )

        response = await call_next(request)
        return response