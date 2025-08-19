# migrations/env.py
from logging.config import fileConfig
from alembic import context
from sqlalchemy import engine_from_config, pool
import os

# 🟢 import your app factory and models Base
from src.main import create_app            
from src.models.user import Base as ModelBase

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = ModelBase.metadata

def get_url():
    # prefer env var if provided (CI/CLI friendly)
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url
    app = create_app()
    with app.app_context():
        return app.config["SQLALCHEMY_DATABASE_URI"]

def run_migrations_offline():
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(
        {"sqlalchemy.url": get_url()},
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