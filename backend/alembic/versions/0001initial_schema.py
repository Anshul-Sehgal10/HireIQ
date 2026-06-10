"""Initial schema — all tables, enums, indexes, and pgvector extension.

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Extensions (must come before any table that uses these types)
    # ------------------------------------------------------------------
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")         # pgvector
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")        # fuzzy text search (future)
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')    # gen_random_uuid()

    # ------------------------------------------------------------------
    # Enums
    # ------------------------------------------------------------------
    user_role_enum = postgresql.ENUM(
        "admin", "employer", "candidate", name="user_role_enum", create_type=False
    )
    user_role_enum.create(op.get_bind(), checkfirst=True)

    oauth_provider_enum = postgresql.ENUM(
        "google", "linkedin", "local", name="oauth_provider_enum", create_type=False
    )
    oauth_provider_enum.create(op.get_bind(), checkfirst=True)

    verification_status_enum = postgresql.ENUM(
        "pending", "verified", "rejected",
        name="verification_status_enum", create_type=False
    )
    verification_status_enum.create(op.get_bind(), checkfirst=True)

    org_subscription_tier_enum = postgresql.ENUM(
        "free", "pro", "premium", "enterprise",
        name="org_subscription_tier_enum", create_type=False
    )
    org_subscription_tier_enum.create(op.get_bind(), checkfirst=True)

    org_role_enum = postgresql.ENUM(
        "owner", "recruiter", "viewer", name="org_role_enum", create_type=False
    )
    org_role_enum.create(op.get_bind(), checkfirst=True)

    job_status_enum = postgresql.ENUM(
        "draft", "published", "paused", "closed",
        name="job_status_enum", create_type=False
    )
    job_status_enum.create(op.get_bind(), checkfirst=True)

    work_mode_enum = postgresql.ENUM(
        "remote", "onsite", "hybrid", name="work_mode_enum", create_type=False
    )
    work_mode_enum.create(op.get_bind(), checkfirst=True)

    job_level_enum = postgresql.ENUM(
        "intern", "fresher", "junior", "mid", "senior", "lead", "manager",
        name="job_level_enum", create_type=False
    )
    job_level_enum.create(op.get_bind(), checkfirst=True)

    application_status_enum = postgresql.ENUM(
        "pending", "resume_rejected", "resume_passed",
        "scenario_pending", "scenario_submitted",
        "shortlisted", "assessment", "interview", "offer",
        "rejected", "withdrawn",
        name="application_status_enum", create_type=False
    )
    application_status_enum.create(op.get_bind(), checkfirst=True)

    pipeline_stage_enum = postgresql.ENUM(
        "shortlisted", "assessment", "interview", "offer", "closed",
        name="pipeline_stage_enum", create_type=False
    )
    pipeline_stage_enum.create(op.get_bind(), checkfirst=True)

    message_type_enum = postgresql.ENUM(
        "broadcast", "direct", "system",
        name="message_type_enum", create_type=False
    )
    message_type_enum.create(op.get_bind(), checkfirst=True)

    # ------------------------------------------------------------------
    # users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", postgresql.ENUM(name="user_role_enum", create_type=False), nullable=False),
        sa.Column("oauth_provider",
                  postgresql.ENUM(name="oauth_provider_enum", create_type=False),
                  nullable=False, server_default="local"),
        sa.Column("oauth_provider_id", sa.String(255), nullable=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("oauth_provider", "oauth_provider_id",
                            name="uq_oauth_identity"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_oauth_provider_id", "users",
                    ["oauth_provider", "oauth_provider_id"])

    # ------------------------------------------------------------------
    # organizations
    # ------------------------------------------------------------------
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("domain", sa.String(255), nullable=True),
        sa.Column("verification_status",
                  postgresql.ENUM(name="verification_status_enum", create_type=False),
                  nullable=False, server_default="pending"),
        sa.Column("subscription_tier",
                  postgresql.ENUM(name="org_subscription_tier_enum", create_type=False),
                  nullable=False, server_default="free"),
        sa.Column("token_budget", sa.Integer(), nullable=False, server_default="100000"),
        sa.Column("tokens_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_organizations_owner_id", "organizations", ["owner_id"])
    op.create_index("ix_organizations_domain", "organizations", ["domain"])

    # ------------------------------------------------------------------
    # org_members
    # ------------------------------------------------------------------
    op.create_table(
        "org_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", postgresql.ENUM(name="org_role_enum", create_type=False),
                  nullable=False, server_default="recruiter"),
        sa.Column("joined_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", name="uq_org_members_user"),
        sa.UniqueConstraint("org_id", "user_id", name="uq_org_members_org_user"),
    )
    op.create_index("ix_org_members_org_id", "org_members", ["org_id"])
    op.create_index("ix_org_members_user_id", "org_members", ["user_id"])

    # ------------------------------------------------------------------
    # resume_versions (before candidate_profiles — FK dependency)
    # ------------------------------------------------------------------
    op.create_table(
        "resume_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("s3_key", sa.String(512), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("candidate_id", "version_number",
                            name="uq_resume_version"),
    )
    op.create_index("ix_resume_versions_candidate_id", "resume_versions", ["candidate_id"])

    # ------------------------------------------------------------------
    # candidate_profiles
    # ------------------------------------------------------------------
    op.create_table(
        "candidate_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("current_resume_version_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("resume_versions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resume_embedding", Vector(1536), nullable=True),
        sa.Column("subscription_tier", sa.String(50),
                  nullable=False, server_default="free"),
        sa.Column("override_apps_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("override_apps_limit", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("resume_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_candidate_profiles_user_id", "candidate_profiles", ["user_id"])
    # IVFFlat vector index for cosine similarity (candidate feed matching)
    op.execute("""
        CREATE INDEX ix_candidate_profiles_resume_embedding
        ON candidate_profiles
        USING ivfflat (resume_embedding vector_cosine_ops)
        WITH (lists = 100)
    """)

    # Add FK from resume_versions → candidate_profiles now that the table exists
    op.create_foreign_key(
        "fk_resume_versions_candidate_id",
        "resume_versions", "candidate_profiles",
        ["candidate_id"], ["id"],
        ondelete="CASCADE",
    )

    # ------------------------------------------------------------------
    # job_postings
    # ------------------------------------------------------------------
    op.create_table(
        "job_postings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("jd_embedding", Vector(1536), nullable=True),
        sa.Column("status",
                  postgresql.ENUM(name="job_status_enum", create_type=False),
                  nullable=False, server_default="draft"),
        sa.Column("work_mode",
                  postgresql.ENUM(name="work_mode_enum", create_type=False), nullable=True),
        sa.Column("job_level",
                  postgresql.ENUM(name="job_level_enum", create_type=False), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("salary_min", sa.Integer(), nullable=True),
        sa.Column("salary_max", sa.Integer(), nullable=True),
        sa.Column("hiring_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("scenario_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("match_threshold", sa.Float(), nullable=False, server_default="0.65"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_job_postings_status", "job_postings", ["status"])
    op.create_index("ix_job_postings_org_id", "job_postings", ["org_id"])
    op.create_index("ix_job_postings_org_status", "job_postings", ["org_id", "status"])
    op.execute("""
        CREATE INDEX ix_job_postings_jd_embedding
        ON job_postings
        USING ivfflat (jd_embedding vector_cosine_ops)
        WITH (lists = 100)
    """)

    # ------------------------------------------------------------------
    # applications
    # ------------------------------------------------------------------
    op.create_table(
        "applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("resume_version_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("resume_versions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("match_score", sa.Float(), nullable=True),
        sa.Column("status",
                  postgresql.ENUM(name="application_status_enum", create_type=False),
                  nullable=False, server_default="pending"),
        sa.Column("is_override", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("applied_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("job_id", "candidate_id", name="uq_application_job_candidate"),
    )
    op.create_index("ix_applications_job_id_match_score", "applications",
                    ["job_id", "match_score"])
    op.create_index("ix_applications_candidate_id", "applications", ["candidate_id"])
    op.create_index("ix_applications_status", "applications", ["status"])

    # ------------------------------------------------------------------
    # scenario_questions
    # ------------------------------------------------------------------
    op.create_table(
        "scenario_questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("time_limit_seconds", sa.Integer(), nullable=False, server_default="300"),
        sa.Column("generated_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_scenario_questions_job_id_generated_at", "scenario_questions",
                    ["job_id", "generated_at"])

    # ------------------------------------------------------------------
    # scenario_responses
    # ------------------------------------------------------------------
    op.create_table(
        "scenario_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("application_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("applications.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("question_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("scenario_questions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("response_text", sa.Text(), nullable=False),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("paste_detected", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("tab_switches", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("time_taken_seconds", sa.Integer(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_scenario_responses_application_id", "scenario_responses",
                    ["application_id"])
    op.create_index("ix_scenario_responses_question_id", "scenario_responses",
                    ["question_id"])

    # ------------------------------------------------------------------
    # pipeline_channels
    # ------------------------------------------------------------------
    op.create_table(
        "pipeline_channels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("job_postings.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("stage",
                  postgresql.ENUM(name="pipeline_stage_enum", create_type=False),
                  nullable=False, server_default="shortlisted"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_pipeline_channels_job_id", "pipeline_channels", ["job_id"])

    # ------------------------------------------------------------------
    # channel_members
    # ------------------------------------------------------------------
    op.create_table(
        "channel_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("pipeline_channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("joined_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("channel_id", "application_id", name="uq_channel_member"),
    )
    op.create_index("ix_channel_members_channel_id_active", "channel_members",
                    ["channel_id", "is_active"])
    op.create_index("ix_channel_members_application_id", "channel_members",
                    ["application_id"])

    # ------------------------------------------------------------------
    # channel_messages
    # ------------------------------------------------------------------
    op.create_table(
        "channel_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("pipeline_channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("recipient_application_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("applications.id", ondelete="SET NULL"), nullable=True),
        sa.Column("message_type",
                  postgresql.ENUM(name="message_type_enum", create_type=False),
                  nullable=False, server_default="broadcast"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_channel_messages_channel_id_sent_at", "channel_messages",
                    ["channel_id", "sent_at"])
    op.create_index(
        "ix_channel_messages_recipient",
        "channel_messages",
        ["recipient_application_id"],
        postgresql_where=sa.text("recipient_application_id IS NOT NULL"),
    )

    # ------------------------------------------------------------------
    # audit_logs
    # ------------------------------------------------------------------
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_resource", "audit_logs",
                    ["resource_type", "resource_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    # ------------------------------------------------------------------
    # token_usage_logs
    # ------------------------------------------------------------------
    op.create_table(
        "token_usage_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("job_postings.id", ondelete="SET NULL"), nullable=True),
        sa.Column("operation", sa.String(100), nullable=False),
        sa.Column("tokens_used", sa.Integer(), nullable=False),
        sa.Column("cost_usd", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_token_usage_logs_org_id", "token_usage_logs", ["org_id"])
    op.create_index("ix_token_usage_logs_org_id_job_id", "token_usage_logs",
                    ["org_id", "job_id"])
    op.create_index("ix_token_usage_logs_created_at", "token_usage_logs", ["created_at"])


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("token_usage_logs")
    op.drop_table("audit_logs")
    op.drop_table("channel_messages")
    op.drop_table("channel_members")
    op.drop_table("pipeline_channels")
    op.drop_table("scenario_responses")
    op.drop_table("scenario_questions")
    op.drop_table("applications")
    op.drop_table("job_postings")
    op.drop_table("candidate_profiles")

    op.drop_constraint("fk_resume_versions_candidate_id", "resume_versions",
                       type_="foreignkey")
    op.drop_table("resume_versions")
    op.drop_table("org_members")
    op.drop_table("organizations")
    op.drop_table("users")

    for enum_name in [
        "message_type_enum", "pipeline_stage_enum", "application_status_enum",
        "job_level_enum", "work_mode_enum", "job_status_enum",
        "org_role_enum", "org_subscription_tier_enum", "verification_status_enum",
        "oauth_provider_enum", "user_role_enum",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")