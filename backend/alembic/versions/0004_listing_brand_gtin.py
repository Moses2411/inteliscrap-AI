"""Add brand/gtin and listing-fee columns to listings and compliance_partners

The Listing and CompliancePartner models gained brand_id/gtin (brand attribution)
and is_large_quantity/listing_fee_naira (large-quantity listing fees), but no
migration added them. This adds them idempotently so existing databases catch up.

Revision ID: 0004_listing_brand_gtin
Revises: 0003_pricing_audit
Create Date: 2026-10-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0004_listing_brand_gtin'
down_revision: Union[str, None] = '0003_pricing_audit'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns_by_table = {
        "listings": [
            ("brand_id", sa.String(36), True, None),
            ("gtin", sa.String(64), True, None),
            ("is_large_quantity", sa.Boolean(), False, sa.false()),
            ("listing_fee_naira", sa.Numeric(12, 2), False, sa.text("0")),
        ],
        "compliance_partners": [
            ("brand_id", sa.String(36), True, None),
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
        "listings": ("brand_id", "gtin"),
        "compliance_partners": ("brand_id",),
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
    op.drop_index(op.f("ix_compliance_partners_brand_id"), table_name="compliance_partners")
    op.drop_column("compliance_partners", "brand_id")
    op.drop_index(op.f("ix_listings_gtin"), table_name="listings")
    op.drop_index(op.f("ix_listings_brand_id"), table_name="listings")
    op.drop_column("listings", "listing_fee_naira")
    op.drop_column("listings", "is_large_quantity")
    op.drop_column("listings", "gtin")
    op.drop_column("listings", "brand_id")
