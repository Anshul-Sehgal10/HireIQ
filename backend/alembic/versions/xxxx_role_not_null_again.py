"""role NOT NULL again — role-less user rows no longer created

Revision ID: role_not_null_again
Revises: add_org_messages
Create Date: 2026-07-25
"""
from alembic import op

revision = "role_not_null_again"
down_revision = "add_org_messages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Any user stuck mid-signup (role IS NULL) under the old flow never
    # completed onboarding — safe to remove. Cascades to their (empty)
    # oauth_accounts/candidate_profile/org_membership rows via existing FKs.
    # REVIEW BEFORE RUNNING if you have real users in this state.
    op.execute("DELETE FROM users WHERE role IS NULL")
    op.alter_column("users", "role", nullable=False)


def downgrade() -> None:
    op.alter_column("users", "role", nullable=True)