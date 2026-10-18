"""Location fallback precision: add location_precision to users and listings

Revision ID: 0006_location_fallback
Revises: 0005_payments
Create Date: 2026-10-18

Additive and idempotent: the columns are only added when missing, so existing
development SQLite databases and the production Postgres database are upgraded
in place without data loss. Records how a coordinate was obtained ("gps",
"hub" or "address") so dispatch can widen its radius for approximate
area-level fallbacks and the offer UI can label them.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006_location_fallback"
down_revision: Union[str, None] = "0005_payments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


COLUMNS_BY_TABLE = {
    "users": "location_precision",
    "listings": "location_precision",
}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table_name, column_name in COLUMNS_BY_TABLE.items():
        existing_columns = {
            column["name"] for column in inspector.get_columns(table_name)
        }
        if column_name not in existing_columns:
            op.add_column(
                table_name,
                sa.Column(column_name, sa.String(12), nullable=True),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table_name, column_name in COLUMNS_BY_TABLE.items():
        existing_columns = {
            column["name"] for column in inspector.get_columns(table_name)
        }
        if column_name in existing_columns:
            op.drop_column(table_name, column_name)
