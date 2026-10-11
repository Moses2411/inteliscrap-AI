"""Weekly listing limit: add subscription and weekly tracking columns

Revision ID: ef06a62f8acf
Revises: 0001_initial
Create Date: 2026-10-11 13:12:50.259821
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ef06a62f8acf'
down_revision: Union[str, None] = '0001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns_by_table = {
        "users": [
            ("address_text", sa.String(320), True, None),
            ("subscription_plan", sa.String(20), False, "freemium"),
            ("subscription_status", sa.String(20), False, "active"),
            ("subscription_expires_at", sa.DateTime(), True, None),
            ("listings_this_week", sa.Integer(), False, "0"),
            ("listings_week_start", sa.Date(), True, None),
        ],
        "transactions": [
            ("brand_id", sa.String(36), True, None),
            ("gtin", sa.String(64), True, None),
        ],
        "compliance_partners": [
            ("allow_category_aggregate", sa.Boolean(), False, sa.false()),
        ],
    }
    for table_name, columns in columns_by_table.items():
        existing_columns = {
            column["name"] for column in inspector.get_columns(table_name)
        }
        for name, column_type, nullable, server_default in columns:
            if name not in existing_columns:
                op.add_column(
                    table_name,
                    sa.Column(
                        name,
                        column_type,
                        nullable=nullable,
                        server_default=server_default,
                    ),
                )

    indexes_by_table = {
        "users": ("subscription_plan", "subscription_status"),
        "transactions": ("brand_id", "gtin"),
    }
    for table_name, column_names in indexes_by_table.items():
        existing_indexes = {
            index["name"] for index in sa.inspect(bind).get_indexes(table_name)
        }
        for column_name in column_names:
            index_name = f"ix_{table_name}_{column_name}"
            if index_name not in existing_indexes:
                op.create_index(index_name, table_name, [column_name])


def downgrade() -> None:
    op.drop_column('compliance_partners', 'allow_category_aggregate')
    op.drop_index(op.f('ix_users_subscription_status'), table_name='users')
    op.drop_index(op.f('ix_users_subscription_plan'), table_name='users')
    op.drop_column('users', 'listings_week_start')
    op.drop_column('users', 'listings_this_week')
    op.drop_column('users', 'subscription_expires_at')
    op.drop_column('users', 'subscription_status')
    op.drop_column('users', 'subscription_plan')
    op.drop_column('users', 'address_text')
    op.drop_index(op.f('ix_transactions_gtin'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_brand_id'), table_name='transactions')
    op.drop_column('transactions', 'gtin')
    op.drop_column('transactions', 'brand_id')
    op.drop_column('compliance_partners', 'allow_category_aggregate')