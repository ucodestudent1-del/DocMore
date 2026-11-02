"""baseline

Revision ID: 14426b91ddcc
Revises: 
Create Date: 2026-11-02 14:18:49.619741

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '14426b91ddcc'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("username", sa.String(length=255), unique=True, index=True, nullable=False),
        sa.Column("email", sa.String(length=255), unique=True, index=True, nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("tier", sa.String(length=50), nullable=False, server_default="free"),
        sa.Column("role", sa.String(length=50), nullable=False, server_default="user"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("email_verification_token", sa.String(length=255), nullable=True, index=True),
        sa.Column("email_verification_expires", sa.DateTime(), nullable=True),
        sa.Column("password_reset_token", sa.String(length=255), nullable=True, index=True),
        sa.Column("password_reset_expires", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "uploads",
        sa.Column("id", sa.String(length=64), primary_key=True, index=True),
        sa.Column("user_id", sa.String(length=255), sa.ForeignKey("users.username"), nullable=False, index=True),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("stored_name", sa.String(length=255), nullable=False),
        sa.Column("path", sa.String(length=500), nullable=False),
        sa.Column("mime", sa.String(length=100), nullable=False),
        sa.Column("ext", sa.String(length=20), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=50), nullable=False, server_default="upload"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "outputs",
        sa.Column("id", sa.String(length=64), primary_key=True, index=True),
        sa.Column("user_id", sa.String(length=255), sa.ForeignKey("users.username"), nullable=False, index=True),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("stored_name", sa.String(length=255), nullable=False),
        sa.Column("path", sa.String(length=500), nullable=False),
        sa.Column("mime", sa.String(length=100), nullable=False),
        sa.Column("ext", sa.String(length=20), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=50), nullable=False, server_default="output"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "jobs",
        sa.Column("id", sa.String(length=64), primary_key=True, index=True),
        sa.Column("user_id", sa.String(length=255), sa.ForeignKey("users.username"), nullable=True, index=True),
        sa.Column("task_name", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.String(length=64), primary_key=True, index=True),
        sa.Column("user_id", sa.String(length=255), sa.ForeignKey("users.username"), nullable=False, index=True),
        sa.Column("stripe_customer_id", sa.String(length=255), nullable=True, index=True),
        sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True, index=True),
        sa.Column("stripe_price_id", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="incomplete"),
        sa.Column("tier", sa.String(length=50), nullable=False, server_default="free"),
        sa.Column("interval", sa.String(length=20), nullable=False, server_default="monthly"),
        sa.Column("current_period_start", sa.DateTime(), nullable=True),
        sa.Column("current_period_end", sa.DateTime(), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("subscriptions")
    op.drop_table("jobs")
    op.drop_table("outputs")
    op.drop_table("uploads")
    op.drop_table("users")
