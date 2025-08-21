"""fresh baseline

Revision ID: eaf864580b38
Revises: 
Create Date: 2025-08-09 12:29:15.241704
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'eaf864580b38'
down_revision = None
branch_labels = None
depends_on = None


def _safe_drop_legacy_tables():
    """Drop old tables from the previous schema, only if they exist."""
    legacy_tables = [
        "document",
        "meeting",
        "investor_stage",
        "audit_log",
        "message",
        "match_recommendation",
        "event_registration",
        "event",
        "user",
        "tier_plan",
        "investor_profile",
        "notification",
        "investor_geographic_focus",
        "match_interaction",
        "document_access",
        "enterprise",
        "like",
        "industry",
        "event_payment",
        "stage",
        "subscription",
        "investor_industry",
    ]
    for t in legacy_tables:
        op.execute(f'DROP TABLE IF EXISTS "{t}" CASCADE;')


def upgrade():
    # 1) Extensions (needed for uuid_generate_v4 etc.)
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto";')

    # 2) Remove legacy schema if present
    _safe_drop_legacy_tables()

    # 3) Create the new schema from your models metadata
    bind = op.get_bind()

    # Prefer your declarative Base if you used `declarative_base()`.
    # Fallback to Flask-SQLAlchemy metadata if models inherit from db.Model.
    metadata = None
    try:
        # If your models live in src/models/models.py and define `Base = declarative_base()`
        from src.models.user import Base as AppBase  # adjust if your path differs
        metadata = AppBase.metadata
    except Exception:
        try:
            from src.models.user import Base as AppBase  # if you re-export Base in __init__.py
            metadata = AppBase.metadata
        except Exception:
            from src.extensions import db
            metadata = db.metadata

    # Create all tables from the *current* model definitions
    metadata.create_all(bind=bind)

    # 4) Functional unique index Alembic often misses
    # (make sure the table is named `users` in your new schema; adjust if needed)
    op.execute('CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON public.users (lower(email));')


def downgrade():
    # Best-effort drop of the new schema (no legacy recreation)
    bind = op.get_bind()
    try:
        from src.models.user import Base as AppBase
        metadata = AppBase.metadata
    except Exception:
        try:
            from src.models.user import Base as AppBase
            metadata = AppBase.metadata
        except Exception:
            from src.extensions import db
            metadata = db.metadata

    # Drop the functional index if it exists
    op.execute('DROP INDEX IF EXISTS public.uq_users_email_lower;')

    # Drop all new tables
    metadata.drop_all(bind=bind)