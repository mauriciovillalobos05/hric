"""merge heads

Revision ID: 20fe292287af
Revises: 03f3588b38ed, 2f7725d42bb6, 314b2edbf95c, 78aa9cbb343c
Create Date: 2025-08-21 07:52:56.654310

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20fe292287af'
down_revision = ('03f3588b38ed', '2f7725d42bb6', '314b2edbf95c', '78aa9cbb343c')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
