"""Pricing audit trail, freshness metadata and comms/outbox reliability fields

Revision ID: 0003_pricing_audit
Revises: ef06a62f8acf
Create Date: 2026-10-14

Additive and idempotent: every column/table is guarded by an inspector check so
existing development SQLite databases are upgraded in place without data loss.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_pricing_audit"
down_revision: Union[str, None] = "ef06a62f8acf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


COLUMNS_BY_TABLE: dict[str, list[tuple[str, sa.types.TypeEngine, bool, object]]] = {
    "material_categories": [
        ("price_last_updated_at", sa.DateTime(), True, None),
        ("price_source", sa.String(32), False, "seed"),
        ("price_version", sa.Integer(), False, "1"),
        ("price_updated_by_id", sa.String(36), True, None),
    ],
    "ngo_impact_logs": [
        ("carbon_kg_co2e_per_kg_used", sa.Numeric(10, 4), True, None),
    ],
    "compliance_partners": [
        ("api_keys_hash", sa.Text(), True, None),
        ("scopes", sa.JSON(), True, None),
        ("last_used_at", sa.DateTime(), True, None),
    ],
    "sync_outbox": [
        ("max_attempts", sa.Integer(), False, "5"),
        ("sent_at", sa.DateTime(), True, None),
        ("provider_message_id", sa.String(120), True, None),
        ("error_code", sa.String(40), True, None),
        ("last_error", sa.Text(), True, None),
    ],
}


INDEXES_BY_TABLE: dict[str, tuple[str, ...]] = {
    "material_categories": ("price_last_updated_at",),
    "transactions": ("settled_at",),
}


def _add_missing_columns(inspector: sa.Inspector) -> None:
    for table_name, columns in COLUMNS_BY_TABLE.items():
        if not inspector.has_table(table_name):
            continue
        existing = {column["name"] for column in inspector.get_columns(table_name)}
        for name, column_type, nullable, server_default in columns:
            if name not in existing:
                op.add_column(
                    table_name,
                    sa.Column(name, column_type, nullable=nullable, server_default=server_default),
                )


def _create_price_history(inspector: sa.Inspector) -> None:
    if inspector.has_table("price_history"):
        return
    op.create_table(
        "price_history",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("material_category_id", sa.Integer(), nullable=False),
        sa.Column("price_per_kg_naira", sa.Numeric(12, 2), nullable=False),
        sa.Column("carbon_kg_co2e_per_kg", sa.Numeric(10, 4), nullable=False, server_default="0"),
        sa.Column("source", sa.String(32), nullable=False, server_default="admin"),
        sa.Column("reason", sa.String(255), nullable=True),
        sa.Column("updated_by_id", sa.String(36), nullable=True),
        sa.Column("changed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["material_category_id"], ["material_categories.id"]),
        sa.ForeignKeyConstraint(["updated_by_id"], ["users.id"]),
    )
    op.create_index(
        "ix_price_history_material_category_id", "price_history", ["material_category_id"]
    )
    op.create_index("ix_price_history_changed_at", "price_history", ["changed_at"])


def _create_indexes(inspector: sa.Inspector) -> None:
    for table_name, column_names in INDEXES_BY_TABLE.items():
        if not inspector.has_table(table_name):
            continue
        existing = {index["name"] for index in inspector.get_indexes(table_name)}
        for column_name in column_names:
            index_name = f"ix_{table_name}_{column_name}"
            if index_name not in existing:
                op.create_index(index_name, table_name, [column_name])


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    _add_missing_columns(inspector)
    _create_price_history(inspector)
    _create_indexes(sa.inspect(bind))

    # Ensure any tables added to the models since the initial migration exist on
    # pre-existing databases (create_all is additive and never alters columns).
    from app import models  # noqa: F401
    from app.database import Base

    Base.metadata.create_all(bind=bind)

    if inspector.has_table("material_categories"):
        # Backfill freshness for rows that predate the price-versioning columns so
        # existing seed prices are not falsely reported as stale.
        op.execute(
            sa.text(
                "UPDATE material_categories "
                "SET price_last_updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP) "
                "WHERE price_last_updated_at IS NULL"
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for table_name, column_names in INDEXES_BY_TABLE.items():
        if not inspector.has_table(table_name):
            continue
        existing = {index["name"] for index in inspector.get_indexes(table_name)}
        for column_name in column_names:
            index_name = f"ix_{table_name}_{column_name}"
            if index_name in existing:
                op.drop_index(index_name, table_name=table_name)

    if inspector.has_table("price_history"):
        op.drop_table("price_history")

    for table_name, columns in COLUMNS_BY_TABLE.items():
        if not inspector.has_table(table_name):
            continue
        existing = {column["name"] for column in inspector.get_columns(table_name)}
        for name, _type, _nullable, _default in columns:
            if name in existing:
                op.drop_column(table_name, name)
