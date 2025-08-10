# migrations/env.py
from logging.config import fileConfig
from alembic import context
from sqlalchemy import engine_from_config, pool
from flask import current_app

# 👇 your declarative base (the one you called declarative_base())
from src.models.user import Base as ModelBase
# 👇 only if you also use Flask-SQLAlchemy's db.Model anywhere
from src.extensions import db

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Ensure Alembic uses the app’s DB URL
sqlalchemy_url = current_app.config.get("SQLALCHEMY_DATABASE_URI")
if sqlalchemy_url:
    config.set_main_option("sqlalchemy.url", sqlalchemy_url)

# Point Alembic at ALL your metadatas.
# If you only use ModelBase, you can set just ModelBase.metadata.
target_metadata = [ModelBase.metadata, db.metadata]

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()