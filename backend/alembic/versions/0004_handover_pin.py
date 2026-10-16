"""Proof-of-handover: PIN confirmation columns on pickups

Revision ID: 0004_handover_pin
Revises: 0003_pricing_audit
Create Date: 2026-10-16

Additive and idempotent: each column is guarded by an inspector check so both
existing development SQLite databases and the production Postgres database are
upgraded in place without data loss.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_handover_pin"
down_revision: Union[str, None] = "0003_pricing_audit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (name, type, nullable, server_default)
NEW_COLUMNS: list[tuple[str, sa.types.TypeEngine, bool, object]] = [
    ("pin_hash", sa.String(128), True, None),
    ("pin_attempts", sa.Integer(), False, "0"),
    ("pin_expires_at", sa.DateTime(), True, None),
    ("confirm_deadline", sa.DateTime(), True, None),
    ("confirmed_at", sa.DateTime(), True, None),
    ("disputed_at", sa.DateTime(), True, None),
    ("dispute_reason", sa.String(255), True, None),
    ("handover_weight_kg", sa.Numeric(10, 3), True, None),
    ("handover_unit_price_naira", sa.Numeric(12, 2), True, None),
    ("handover_payment_method", sa.String(20), True, None),
    ("handover_hub_id", sa.String(36), True, None),
]

NEW_INDEXES: tuple[str, ...] = ("pin_expires_at", "confirm_deadline", "disputed_at")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("pickups"):
        return

    existing = {column["name"] for column in inspector.get_columns("pickups")}
    for name, column_type, nullable, server_default in NEW_COLUMNS:
        if name not in existing:
            op.add_column(
                "pickups",
                sa.Column(
                    name,
                    column_type,
                    nullable=nullable,
                    server_default=server_default,
                ),
            )

    existing_indexes = {index["name"] for index in inspector.get_indexes("pickups")}
    for column_name in NEW_INDEXES:
        index_name = f"ix_pickups_{column_name}"
        if index_name not in existing_indexes:
            op.create_index(index_name, "pickups", [column_name])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("pickups"):
        return

    existing_indexes = {index["name"] for index in inspector.get_indexes("pickups")}
    for column_name in NEW_INDEXES:
        index_name = f"ix_pickups_{column_name}"
        if index_name in existing_indexes:
            op.drop_index(index_name, table_name="pickups")

    existing = {column["name"] for column in inspector.get_columns("pickups")}
    for name, _type, _nullable, _default in NEW_COLUMNS:
        if name in existing:
            op.drop_column("pickups", name)
