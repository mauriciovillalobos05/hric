# migrations/env.py
import os
from logging.config import fileConfig
from alembic import context
from sqlalchemy import create_engine, pool
from dotenv import load_dotenv

# Load .env so Alembic sees the same vars as your app
load_dotenv()

import src.models.user as models  # must import WITHOUT creating the Flask app

config = context.config

# Prefer DATABASE_URL (same as your Flask app), fallback to SUPABASE_DB_URL
DB_URL = os.environ.get("DATABASE_URL")

if not DB_URL:
    raise RuntimeError(
        "Set DATABASE_URL for Alembic.\n"
        "Example: postgresql+psycopg2://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres?sslmode=require"
    )

# Normalize scheme
if DB_URL.startswith("postgres://"):
    DB_URL = DB_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DB_URL.startswith("postgresql://"):
    DB_URL = DB_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

config.set_main_option("sqlalchemy.url", DB_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = models.Base.metadata

def include_object(obj, name, type_, reflected, compare_to):
    # If a table exists in the DB (reflected=True) but not in metadata (compare_to is None),
    # skip it so autogenerate does NOT propose dropping it.
    if type_ == "table" and reflected and compare_to is None:
        return False
    return True

def run_migrations_offline():
    context.configure(
        url=DB_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    engine = create_engine(
        DB_URL,
        poolclass=pool.NullPool,
        connect_args={"sslmode": "require"},
    )
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()