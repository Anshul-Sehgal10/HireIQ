"""
Alembic environment — async SQLAlchemy + pgvector.

Run migrations:
    alembic upgrade head

Generate a new migration after changing models:
    alembic revision --autogenerate -m "describe your change"
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# ---------------------------------------------------------------------------
# Import Base so autogenerate can see all table metadata
# ---------------------------------------------------------------------------
from app.db.base import Base  # noqa: F401 — side-effect import for metadata
from app.core.config import settings  # your Pydantic Settings object
from app.db.models import *
# Alembic Config object (gives access to .ini values)
config = context.config

# Set the DB URL from settings (overrides alembic.ini sqlalchemy.url)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Logging config from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def include_object(object, name, type_, reflected, compare_to):
    """
    Tell Alembic to ignore pgvector's internal tables and the
    spatial_ref_sys table that PostGIS sometimes adds.
    """
    if type_ == "table" and name in ("spatial_ref_sys",):
        return False
    return True


# ---------------------------------------------------------------------------
# Offline mode (generate SQL without connecting)
# ---------------------------------------------------------------------------


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online mode (connect and run)
# ---------------------------------------------------------------------------


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
        # Render Enum types as their values in migration scripts
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()