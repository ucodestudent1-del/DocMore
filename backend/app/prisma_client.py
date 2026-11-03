"""Prisma client wrapper — singleton database client for DocStudio.

Co-exists with the existing SQLAlchemy layer during migration. New code
( sessions, documents, folders, usage, audit ) uses Prisma; legacy code
continues to use SQLAlchemy until it is refactored behind stable interfaces.
"""

from typing import Optional

from prisma import Prisma

_client: Optional[Prisma] = None


def get_prisma() -> Prisma:
    """Return a connected Prisma client (singleton)."""
    global _client
    if _client is None:
        _client = Prisma()
        # Prisma Python connects lazily; connect() is idempotent-safe.
    return _client


async def connect_db() -> None:
    """Connect the Prisma client to the database."""
    client = get_prisma()
    if not client.is_connected():
        await client.connect()


async def disconnect_db() -> None:
    """Disconnect the Prisma client."""
    global _client
    if _client is not None and _client.is_connected():
        await _client.disconnect()
        _client = None


__all__ = ["get_prisma", "connect_db", "disconnect_db"]
