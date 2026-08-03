"""Add question_pool and violation_count to scenario_questions

Revision ID: add_question_pool
Revises: role_not_null_again
Create Date: 2026-08-03 16:08:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "add_question_pool"
down_revision: Union[str, None] = "role_not_null_again"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "scenario_questions",
        sa.Column(
            "question_pool",
            postgresql.JSONB(),
            nullable=True,
        ),
    )

    op.add_column(
        "scenario_questions",
        sa.Column(
            "violation_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    # Optional: Remove the server default after existing rows are populated.
    # Uncomment if you want future inserts to require an explicit value
    # or rely on your application default.
    #
    # op.alter_column(
    #     "scenario_questions",
    #     "violation_count",
    #     server_default=None,
    # )


def downgrade() -> None:
    op.drop_column("scenario_questions", "violation_count")
    op.drop_column("scenario_questions", "question_pool")