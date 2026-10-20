"""Proof-of-handover: cache the plaintext code so the seller can re-read it

Revision ID: 0007_pin_cache
Revises: 9bf46ebd695a
Create Date: 2026-10-19

The confirmation code is now shown to the seller (who reads it to the
collector) rather than the collector. Only the HMAC was stored, so the seller
could not re-read the code after a reload — add a short plaintext cache that
the seller's job payload surfaces. Additive and idempotent.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0007_pin_cache"
down_revision: Union[str, None] = "9bf46ebd695a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("pickups"):
        return

    existing = {column["name"] for column in inspector.get_columns("pickups")}
    if "pin_cache" not in existing:
        op.add_column(
            "pickups",
            sa.Column("pin_cache", sa.String(6), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("pickups"):
        return

    existing = {column["name"] for column in inspector.get_columns("pickups")}
    if "pin_cache" in existing:
        op.drop_column("pickups", "pin_cache")
