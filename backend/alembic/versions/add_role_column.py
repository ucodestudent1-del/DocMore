"""Add role column to users table

Revision ID: add_role_column
Revises: 14426b91ddcc
Create Date: 2026-11-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_role_column'
down_revision: Union[str, None] = '14426b91ddcc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add role column if it doesn't exist (handles databases created before baseline migration)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'role'
            ) THEN
                ALTER TABLE users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user';
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.drop_column("users", "role")
