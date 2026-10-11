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
    # Add missing columns to users table
    op.add_column('users', sa.Column('address_text', sa.String(length=320), nullable=True))
    op.add_column('users', sa.Column('subscription_plan', sa.Enum('freemium', 'quarterly', name='subscriptionplan', native_enum=False, length=20), nullable=False, server_default='freemium'))
    op.add_column('users', sa.Column('subscription_status', sa.Enum('active', 'expired', 'cancelled', 'pending', name='subscriptionstatus', native_enum=False, length=20), nullable=False, server_default='active'))
    op.add_column('users', sa.Column('subscription_expires_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('listings_this_week', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('listings_week_start', sa.Date(), nullable=True))
    op.create_index(op.f('ix_users_subscription_plan'), 'users', ['subscription_plan'], unique=False)
    op.create_index(op.f('ix_users_subscription_status'), 'users', ['subscription_status'], unique=False)

    # Add missing columns to transactions table
    op.add_column('transactions', sa.Column('brand_id', sa.String(length=36), nullable=True))
    op.add_column('transactions', sa.Column('gtin', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_transactions_brand_id'), 'transactions', ['brand_id'], unique=False)
    op.create_index(op.f('ix_transactions_gtin'), 'transactions', ['gtin'], unique=False)

    # Add missing columns to compliance_partners table
    op.add_column('compliance_partners', sa.Column('allow_category_aggregate', sa.Boolean(), nullable=False, server_default=sa.false()))


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