"""merge listing_brand_gtin and handover_pin branches

Revision ID: 9bf46ebd695a
Revises: 0004_listing_brand_gtin, 0006_location_fallback
Create Date: 2026-10-19 00:34:27.384581
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9bf46ebd695a'
down_revision: Union[str, None] = ('0004_listing_brand_gtin', '0006_location_fallback')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
