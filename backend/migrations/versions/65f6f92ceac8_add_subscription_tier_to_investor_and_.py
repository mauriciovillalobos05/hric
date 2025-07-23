"""Add subscription tier to investor and enterprise

Revision ID: 65f6f92ceac8
Revises: 
Create Date: 2025-07-22 18:01:39.835004

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '65f6f92ceac8'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        'user',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(length=120), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('user_type', sa.String(length=20), nullable=False),
        sa.Column('first_name', sa.String(length=50), nullable=False),
        sa.Column('last_name', sa.String(length=50), nullable=False),
        sa.Column('phone', sa.String(length=20)),
        sa.Column('location', sa.String(length=100)),
        sa.Column('profile_image', sa.String(length=255)),
        sa.Column('bio', sa.Text()),
        sa.Column('linkedin_url', sa.String(length=255)),
        sa.Column('website_url', sa.String(length=255)),
        sa.Column('is_verified', sa.Boolean(), default=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('subscription_tier', sa.String(length=20), default='free'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('last_login', sa.DateTime())
    )

    op.create_table(
        'investor_profile',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('headline', sa.String(length=150)),
        sa.Column('investment_stages', sa.Text()),
        sa.Column('industries', sa.Text()),
        sa.Column('geographic_focus', sa.Text()),
        sa.Column('investment_range_min', sa.Integer()),
        sa.Column('investment_range_max', sa.Integer()),
        sa.Column('risk_tolerance', sa.String(length=20)),
        sa.Column('investor_type', sa.String(length=50)),
        sa.Column('accredited_status', sa.Boolean(), default=False),
        sa.Column('net_worth', sa.Integer()),
        sa.Column('annual_income', sa.Integer()),
        sa.Column('investment_experience', sa.String(length=20)),
        sa.Column('portfolio_size', sa.Integer()),
        sa.Column('expertise_areas', sa.Text()),
        sa.Column('advisory_availability', sa.Boolean(), default=False),
        sa.Column('board_experience', sa.Boolean(), default=False),
        sa.Column('communication_frequency', sa.String(length=20), default='monthly'),
        sa.Column('meeting_preference', sa.String(length=20), default='virtual'),
        sa.Column('subscription_tier', sa.String(length=20), default='tier_1'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now())
    )

    op.create_table(
        'enterprise',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('headline', sa.String(length=150)),
        sa.Column('company_name', sa.String(length=100), nullable=False),
        sa.Column('company_description', sa.Text()),
        sa.Column('industry', sa.String(length=50)),
        sa.Column('business_model', sa.String(length=50)),
        sa.Column('stage', sa.String(length=20)),
        sa.Column('founded_date', sa.Date()),
        sa.Column('employee_count', sa.Integer()),
        sa.Column('location', sa.String(length=100)),
        sa.Column('funding_stage', sa.String(length=20)),
        sa.Column('funding_amount_seeking', sa.Integer()),
        sa.Column('funding_amount_raised', sa.Integer()),
        sa.Column('previous_funding_rounds', sa.Text()),
        sa.Column('use_of_funds', sa.Text()),
        sa.Column('monthly_revenue', sa.Integer()),
        sa.Column('monthly_growth_rate', sa.Float()),
        sa.Column('gross_margin', sa.Float()),
        sa.Column('burn_rate', sa.Integer()),
        sa.Column('runway_months', sa.Integer()),
        sa.Column('team_size', sa.Integer()),
        sa.Column('key_team_members', sa.Text()),
        sa.Column('advisors', sa.Text()),
        sa.Column('target_market', sa.Text()),
        sa.Column('market_size', sa.String(length=100)),
        sa.Column('competitors', sa.Text()),
        sa.Column('competitive_advantage', sa.Text()),
        sa.Column('preferred_investor_types', sa.Text()),
        sa.Column('geographic_investor_preference', sa.Text()),
        sa.Column('looking_for_strategic_value', sa.Boolean(), default=True),
        sa.Column('is_actively_fundraising', sa.Boolean(), default=True),
        sa.Column('pitch_deck_url', sa.String(length=255)),
        sa.Column('demo_url', sa.String(length=255)),
        sa.Column('subscription_tier', sa.String(length=20), default='free'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now())
    )

    op.create_table(
        'like',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('investor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('enterprise_id', sa.Integer(), sa.ForeignKey('enterprise.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now())
    )
    
    op.create_table(
        'match',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('investor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('enterprise_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('compatibility_score', sa.Float(), nullable=False),
        sa.Column('match_reasons', sa.Text()),
        sa.Column('match_algorithm_version', sa.String(length=20)),
        sa.Column('match_score_breakdown', sa.Text()),
        sa.Column('status', sa.String(length=20), default='pending'),
        sa.Column('investor_interest', sa.String(length=20)),
        sa.Column('enterprise_interest', sa.String(length=20)),
        sa.Column('notes', sa.Text()),
        sa.Column('is_hidden', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now())
    )

    op.create_table(
        'event',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('summary', sa.String(length=300)),
        sa.Column('description', sa.Text()),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('date', sa.DateTime(), nullable=False),
        sa.Column('location', sa.String(length=200)),
        sa.Column('capacity', sa.Integer()),
        sa.Column('price', sa.Float(), default=0.0),
        sa.Column('is_members_only', sa.Boolean(), default=False),
        sa.Column('status', sa.String(length=20), default='upcoming'),
        sa.Column('agenda', sa.Text()),
        sa.Column('presenters', sa.Text()),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now())
    )

    op.create_table(
        'event_registration',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('event_id', sa.Integer(), sa.ForeignKey('event.id'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('answers', sa.JSON(), nullable=True),
        sa.Column('registration_status', sa.String(length=20)),
        sa.Column('reviewer_email', sa.String(length=120)),
        sa.Column('reviewed_at', sa.DateTime()),
        sa.Column('meeting_preference', sa.String(length=20), default='on_site'),
        sa.Column('registration_date', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now())
    )

    op.create_table(
        'document',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_size', sa.Integer()),
        sa.Column('file_type', sa.String(length=50)),
        sa.Column('mime_type', sa.String(length=100)),
        sa.Column('document_type', sa.String(length=50)),
        sa.Column('description', sa.Text()),
        sa.Column('tags', sa.Text()),
        sa.Column('is_public', sa.Boolean(), default=False),
        sa.Column('access_level', sa.String(length=20), default='private'),
        sa.Column('download_count', sa.Integer(), default=0),
        sa.Column('is_deleted', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now())
    )

    op.create_table(
        'document_access',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('document_id', sa.Integer(), sa.ForeignKey('document.id'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('granted_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('access_type', sa.String(length=20), default='view'),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('granted_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime()),
        sa.Column('revoked_at', sa.DateTime()),
        sa.Column('notes', sa.Text())
    )

    op.create_table(
        'message',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('recipient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('subject', sa.String(length=200)),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('message_type', sa.String(length=20), default='direct'),
        sa.Column('thread_id', sa.String(length=100)),
        sa.Column('attachments', sa.Text()),
        sa.Column('is_read', sa.Boolean(), default=False),
        sa.Column('read_at', sa.DateTime()),
        sa.Column('is_archived', sa.Boolean(), default=False),
        sa.Column('is_deleted', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now())
    )

def downgrade():
    op.drop_table('like')
    op.drop_table('enterprise')
    op.drop_table('investor_profile')
    op.drop_table('user')
    op.drop_table('message')
    op.drop_table('document_access')
    op.drop_table('document')
    op.drop_table('event_registration')
    op.drop_table('event')
    op.drop_table('match')
