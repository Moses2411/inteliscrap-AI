"""Mobile-money subscription payments: payment_transactions table

Revision ID: 0005_payments
Revises: 0004_handover_pin
Create Date: 2026-10-16

Additive and idempotent: the table is only created when missing, so existing
development SQLite databases and the production Postgres database are upgraded
in place without data loss.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_payments"
down_revision: Union[str, None] = "0004_handover_pin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEXED_COLUMNS = ("user_id", "hub_id", "purpose", "status")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("payment_transactions"):
        return

    op.create_table(
        "payment_transactions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("hub_id", sa.String(36), nullable=True),
        # Non-native enums stored as their string values.
        sa.Column("purpose", sa.String(20), nullable=False),
        sa.Column("plan", sa.String(40), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False, server_default="EUR"),
        sa.Column("provider", sa.String(30), nullable=False, server_default="mtn_momo"),
        sa.Column("reference_id", sa.String(64), nullable=False),
        sa.Column("external_id", sa.String(64), nullable=True),
        sa.Column("payer_msisdn", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("provider_status", sa.String(30), nullable=True),
        sa.Column("provider_financial_tx_id", sa.String(120), nullable=True),
        sa.Column("failure_reason", sa.String(255), nullable=True),
        sa.Column("applied", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("raw_payload", sa.JSON(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["hub_id"], ["recycling_hubs.id"]),
    )
    op.create_index(
        "ix_payment_transactions_reference_id",
        "payment_transactions",
        ["reference_id"],
        unique=True,
    )
    for column_name in INDEXED_COLUMNS:
        op.create_index(
            f"ix_payment_transactions_{column_name}",
            "payment_transactions",
            [column_name],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("payment_transactions"):
        op.drop_table("payment_transactions")
