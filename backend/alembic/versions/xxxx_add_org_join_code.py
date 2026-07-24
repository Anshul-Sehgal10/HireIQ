"""add organization join_code

Revision ID: add_org_join_code
Revises: add_blocked_status
Create Date: 2026-07-21
"""
import secrets

import sqlalchemy as sa
from alembic import op

revision = "add_org_join_code"
down_revision = "add_blocked_status"   # <-- confirm this matches your actual chain
branch_labels = None
depends_on = None

# Excludes 0/O and 1/I — avoids codes that are ambiguous when read aloud
# or typed on a phone keypad.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _gen_code(length: int = 8) -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))


def upgrade() -> None:
    op.add_column(
        "organizations", sa.Column("join_code", sa.String(length=12), nullable=True)
    )
    op.create_index(
        "ix_organizations_join_code", "organizations", ["join_code"], unique=True
    )

    # Backfill existing orgs so every org has a code post-migration, not
    # just ones created after this point.
    conn = op.get_bind()
    existing_codes = {
        row[0]
        for row in conn.execute(
            sa.text("SELECT join_code FROM organizations WHERE join_code IS NOT NULL")
        )
    }
    rows = conn.execute(
        sa.text("SELECT id FROM organizations WHERE join_code IS NULL")
    ).fetchall()
    for (org_id,) in rows:
        code = _gen_code()
        while code in existing_codes:
            code = _gen_code()
        existing_codes.add(code)
        conn.execute(
            sa.text("UPDATE organizations SET join_code = :code WHERE id = :id"),
            {"code": code, "id": org_id},
        )


def downgrade() -> None:
    op.drop_index("ix_organizations_join_code", table_name="organizations")
    op.drop_column("organizations", "join_code")