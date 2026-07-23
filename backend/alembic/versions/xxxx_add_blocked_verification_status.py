"""add blocked verification status

Revision ID: add_blocked_status
Revises: f8271d140caa
Create Date: 2026-07-21
"""
from alembic import op

revision = "add_blocked_status"
down_revision = "f8271d140caa"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Postgres can't ALTER TYPE ... ADD VALUE inside an implicit transaction
    # block on some versions — autocommit_block() avoids
    # "ALTER TYPE ... ADD VALUE cannot run inside a transaction block".
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE verification_status_enum ADD VALUE IF NOT EXISTS 'blocked'")


def downgrade() -> None:
    # Postgres can't drop a single enum value without recreating the whole
    # type. No-op — reverting requires a manual data migration if any org
    # was actually set to 'blocked'.
    pass