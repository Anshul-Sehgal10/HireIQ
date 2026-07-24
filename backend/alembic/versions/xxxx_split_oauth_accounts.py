"""split oauth into oauth_accounts table; nullable role

Revision ID: split_oauth_accounts
Revises: add_org_join_code
Create Date: 2026-07-23
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision = "split_oauth_accounts"
down_revision = "add_org_join_code"   # <-- confirm against your actual chain
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. New table — reuses the existing oauth_provider_enum Postgres type
    # (created originally by the old users.oauth_provider column, not
    # dropped until step 3).
    op.create_table(
        "oauth_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                   server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", postgresql.ENUM(name="oauth_provider_enum", create_type=False), nullable=False),
        sa.Column("provider_account_id", sa.String(length=255), nullable=False),
        sa.Column("provider_email", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("provider", "provider_account_id", name="uq_oauth_account_identity"),
    )
    op.create_index("ix_oauth_accounts_user_id", "oauth_accounts", ["user_id"])

    # 2. Backfill every existing OAuth-linked user into the new table.
    op.execute("""
        INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, provider_email, created_at)
        SELECT gen_random_uuid(), id, oauth_provider, oauth_provider_id, email, now()
        FROM users
        WHERE oauth_provider != 'local' AND oauth_provider_id IS NOT NULL
    """)

    # 3. Drop the old single-provider columns/constraint/index on users.
    op.drop_constraint("uq_oauth_identity", "users", type_="unique")
    op.drop_index("ix_users_oauth_provider_id", table_name="users")
    op.drop_column("users", "oauth_provider")
    op.drop_column("users", "oauth_provider_id")

    # 4. role becomes nullable — new OAuth signups exist without a role
    # until POST /auth/select-role.
    op.alter_column("users", "role", nullable=True)


def downgrade() -> None:
    op.alter_column("users", "role", nullable=False)
    op.add_column(
        "users",
        sa.Column(
            "oauth_provider",
            postgresql.ENUM(name="oauth_provider_enum", create_type=False),
            nullable=False,
            server_default="local",
        ),
    )
    op.add_column("users", sa.Column("oauth_provider_id", sa.String(length=255), nullable=True))
    op.create_index("ix_users_oauth_provider_id", "users", ["oauth_provider", "oauth_provider_id"])
    op.create_unique_constraint("uq_oauth_identity", "users", ["oauth_provider", "oauth_provider_id"])

    # Best-effort: restore each user's single most-recent linked account.
    op.execute("""
        UPDATE users u
        SET oauth_provider = sub.provider, oauth_provider_id = sub.provider_account_id
        FROM (
            SELECT DISTINCT ON (user_id) user_id, provider, provider_account_id
            FROM oauth_accounts
            ORDER BY user_id, created_at DESC
        ) sub
        WHERE u.id = sub.user_id
    """)

    op.drop_index("ix_oauth_accounts_user_id", table_name="oauth_accounts")
    op.drop_table("oauth_accounts")