from datetime import datetime, date
from decimal import Decimal
from enum import Enum
import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy import event, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, INET  # you already use these
from sqlalchemy import Numeric  # if not already imported as Numeric
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date,
    Numeric, ForeignKey, CheckConstraint, UniqueConstraint,
    Index, JSON, ARRAY, func, text
)
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB, DATERANGE
from sqlalchemy.orm import declarative_base, relationship, validates
from sqlalchemy.ext.hybrid import hybrid_property
import sqlalchemy as sa
from sqlalchemy.orm import backref

# =========================
# BASE / MIXINS / ENUMS
# =========================
Base = declarative_base()

class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class UUIDMixin:
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
                server_default=text("uuid_generate_v4()"))

class SupabaseUserMixin:
    @classmethod
    def create_from_supabase_user(cls, u):
        return cls(
            id=u.get('id'),
            email=u.get('email'),
            first_name=u.get('user_metadata', {}).get('first_name', ''),
            last_name=u.get('user_metadata', {}).get('last_name', ''),
            phone=u.get('phone'),
        )

class EnterpriseType(str, Enum):
    INVESTOR  = "investor"
    STARTUP   = "startup"
    VALIDATOR = "validator"
    BOTH      = "both"

class UserRole(str, Enum):
    OWNER="owner"; ADMIN="admin"; MEMBER="member"; VIEWER="viewer"

class FundingRoundType(str, Enum):
    PRE_SEED="pre_seed"; SEED="seed"; SERIES_A="series_a"; SERIES_B="series_b"
    SERIES_C="series_c"; SERIES_D="series_d"; BRIDGE="bridge"; GROWTH="growth"; IPO="ipo"

class SubscriptionStatus(str, Enum):
    ACTIVE="active"; TRIALING="trialing"; CANCELED="canceled"; INCOMPLETE="incomplete"
    INCOMPLETE_EXPIRED="incomplete_expired"; PAST_DUE="past_due"; UNPAID="unpaid"; PAUSED="paused"

# =========================
# LOOKUPS
# =========================
class Industry(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'industry'
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    category = Column(String(50))
    is_active = Column(Boolean, default=True, nullable=False)

class Stage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'stage'
    name = Column(String(50), nullable=False, unique=True)
    description = Column(Text)
    order_sequence = Column(Integer, nullable=False)
    stage_type = Column(String(20), CheckConstraint("stage_type IN ('startup','investor','both')"))
    is_active = Column(Boolean, default=True, nullable=False)

class GeographicArea(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'geographic_area'
    name = Column(String(150), nullable=False, unique=True, index=True)
    type = Column(String(30))  # country|region|city|custom
    is_active = Column(Boolean, default=True, nullable=False)

# =========================
# USERS / ENTERPRISE
# =========================
class User(Base, UUIDMixin, TimestampMixin, SupabaseUserMixin):
    __tablename__ = 'users'
    email = Column(String(255), nullable=False, unique=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name  = Column(String(100), nullable=False)
    phone = Column(String(20))
    role = Column(String(30), CheckConstraint("role IN ('startup','investor','validator')"))
    location = Column(String(200), index=True)
    stripe_customer_id = Column(String(100), index=True)
    profile_image_url = Column(String(500))
    bio = Column(Text)
    linkedin_url = Column(String(255))
    twitter_url  = Column(String(255))
    website_url  = Column(String(255))
    timezone = Column(String(50), default='UTC')
    language_preference = Column(String(10), default='en')
    notification_preferences = Column(JSONB, default=dict)
    onboarding_completed = Column(Boolean, default=False)
    last_active_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True, index=True)
    intelleges_status = Column(String(50), index=True)

Index('uq_users_email_lower', func.lower(User.email), unique=True)

class Enterprise(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'enterprise'
    name = Column(String(200), nullable=False, index=True)
    enterprise_type = Column(String(20), nullable=False, index=True)
    description = Column(Text)
    founded_date = Column(Date)
    location = Column(String(200), index=True)
    website  = Column(String(255))
    logo_url = Column(String(500))
    employee_count = Column(Integer)
    # Legal
    legal_name = Column(String(200))
    tax_id = Column(String(50))
    registration_number = Column(String(100))
    # Profile fields that used to live in EnterpriseProfile
    industry_id = Column(UUID(as_uuid=True), ForeignKey('industry.id', ondelete="SET NULL"), index=True)
    stage_id    = Column(UUID(as_uuid=True), ForeignKey('stage.id', ondelete="SET NULL"), index=True)
    contact_info = Column(JSONB, default=dict)
    social_media = Column(JSONB, default=dict)
    # Status
    is_verified = Column(Boolean, default=False, index=True)
    verification_date = Column(DateTime(timezone=True))
    status = Column(String(20), default='active', index=True)

    __table_args__ = (
        CheckConstraint("enterprise_type IN ('investor','startup','validator','both')", name='check_enterprise_type'),
        CheckConstraint("status IN ('active','inactive','pending','suspended')", name='check_status'),
    )

class EnterpriseUser(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'enterprise_user'
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False, index=True)
    permissions = Column(JSONB, default=dict)
    joined_date = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True, index=True)
    invited_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="SET NULL"), index=True)
    __table_args__ = (
        UniqueConstraint('enterprise_id','user_id', name='uq_enterprise_user'),
        CheckConstraint("role IN ('owner','admin','member','viewer')"),
        Index('uq_enterprise_one_owner','enterprise_id', unique=True, postgresql_where=text("role='owner'"))
    )

# =========================
# INVESTOR & STARTUP PROFILES (slim — operational data only)
# =========================
class InvestorProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'investor_profile'
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, unique=True)
    investment_thesis = Column(Text)  # optional “headline”; canonical detail lives in FormAnswers
    min_investment = Column(Numeric(15,2), index=True)
    max_investment = Column(Numeric(15,2), index=True)
    typical_check_size = Column(Numeric(15,2))
    years_experience = Column(Integer)
    total_investments = Column(Integer, default=0)
    successful_exits  = Column(Integer, default=0)

class InvestorIndustry(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'investor_industry'
    investor_profile_id = Column(UUID(as_uuid=True), ForeignKey('investor_profile.id', ondelete="CASCADE"), nullable=False, index=True)
    industry_id = Column(UUID(as_uuid=True), ForeignKey('industry.id', ondelete="CASCADE"), nullable=False, index=True)
    __table_args__ = (UniqueConstraint('investor_profile_id','industry_id', name='uq_investor_industry'),)

class InvestorStage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'investor_stage'
    investor_profile_id = Column(UUID(as_uuid=True), ForeignKey('investor_profile.id', ondelete="CASCADE"), nullable=False, index=True)
    stage_id = Column(UUID(as_uuid=True), ForeignKey('stage.id', ondelete="CASCADE"), nullable=False, index=True)
    __table_args__ = (UniqueConstraint('investor_profile_id','stage_id', name='uq_investor_stage'),)

class InvestorGeographicFocus(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'investor_geographic_focus'
    investor_profile_id = Column(UUID(as_uuid=True), ForeignKey('investor_profile.id', ondelete="CASCADE"), nullable=False, index=True)
    geographic_area_id  = Column(UUID(as_uuid=True), ForeignKey('geographic_area.id', ondelete="CASCADE"), nullable=False, index=True)
    __table_args__ = (UniqueConstraint('investor_profile_id','geographic_area_id', name='uq_investor_geo'),)

class StartupProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'startup_profile'
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, unique=True)
    team_size = Column(Integer)  # operational/quick stats
    current_revenue = Column(Numeric(15,2))  # optional cache for dashboards (authoritative metrics live below)
    verified_status = Column(String(20), default='unverified', index=True)

class StartupMetrics(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'startup_metrics'
    startup_profile_id = Column(UUID(as_uuid=True), ForeignKey('startup_profile.id', ondelete="CASCADE"), nullable=False, index=True)
    metric_name = Column(String(100), nullable=False, index=True)  # e.g., 'MRR','ARR','ARPU','Churn'
    value = Column(Numeric(20,4), nullable=False)
    unit = Column(String(20))
    period_start = Column(Date)
    period_end   = Column(Date)
    recorded_at  = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    __table_args__ = (
        UniqueConstraint('startup_profile_id','metric_name','period_start','period_end', name='uq_startup_metric_period'),
    )

class FundingRound(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'funding_round'
    startup_profile_id = Column(UUID(as_uuid=True), ForeignKey('startup_profile.id', ondelete="CASCADE"), nullable=False, index=True)
    round_type = Column(String(20), nullable=False, index=True)
    amount_raised = Column(Numeric(15,2), index=True)
    pre_money_valuation  = Column(Numeric(15,2))
    post_money_valuation = Column(Numeric(15,2))
    lead_investor = Column(String(200))
    investors = Column(JSONB, default=list)
    close_date  = Column(Date, index=True)
    announcement_date = Column(Date)

# =========================
# QUESTIONNAIRES (canonical source of truth)
# =========================

class IntellegesRegistration(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "intelleges_registration"

    # Intelleges-issued id (nullable until first successful initiate)
    registration_id = Column(String(80), unique=True, index=True)

    # Who this belongs to
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    email = Column(String(255), nullable=False, index=True)

    # Inputs / config
    country_of_origin = Column(String(3))
    product_tier = Column(String(64), default="HRIC_STARTUP_BASIC_UNVERIFIED")

    # Lifecycle
    status = Column(String(40), nullable=False, default="NOT_STARTED", index=True)
    questionnaire_link = Column(Text)
    link_expires_at = Column(DateTime(timezone=True))
    last_synced_at = Column(DateTime(timezone=True))

    # Idempotency (e.g., sha256(lower(email)+'|'+yyyy-mm-dd))
    idempotency_key = Column(String(128), unique=True, index=True)

    # Where we saved the delivered CSV (optional but practical)
    answers_csv_path = Column(String(1000))
    answers_csv_received_at = Column(DateTime(timezone=True))

    __table_args__ = (
        # Guard status values you use in code
        CheckConstraint(
            "status IN "
            "('NOT_STARTED','EMAIL_SUBMITTED','EMAIL_VERIFIED',"
            "'QUESTIONNAIRE_LINK_ISSUED','IN_PROGRESS','COMPLETED')",
            name="ck_intelleges_status_values",
        ),
        # Only one *active* (non-completed) registration per email/tier
        Index(
            "uq_intelleges_active_per_email_tier",
            func.lower(email),
            product_tier,
            unique=True,
            postgresql_where=text("status <> 'COMPLETED'")
        ),
    )

class IntellegesEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "intelleges_event"

    event_id = Column(String(120), nullable=False, unique=True, index=True)  # from Intelleges
    registration_id = Column(String(80), index=True)                         # Intelleges reg id
    type = Column(String(64), nullable=False, index=True)                    # registration.progress|registration.completed
    occurred_at_utc = Column(DateTime(timezone=True), index=True)
    payload_json = Column(JSONB, default=dict)
    registration_db_id = Column(UUID(as_uuid=True), ForeignKey("intelleges_registration.id", ondelete="SET NULL"))

class FormDefinition(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'form_definition'
    key = Column(String(80), nullable=False, unique=True, index=True)
    name = Column(String(160), nullable=False)
    role = Column(String(20), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, default=True)
    # rename the *attribute*, keep DB column name if you want
    form_metadata = Column("metadata", JSONB, default=dict)

class FormSection(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'form_section'
    form_id = Column(UUID(as_uuid=True), ForeignKey('form_definition.id', ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(160), nullable=False)
    order = Column(Integer, default=0)

class FormQuestion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'form_question'
    form_id = Column(UUID(as_uuid=True), ForeignKey('form_definition.id', ondelete="CASCADE"), nullable=False, index=True)
    section_id = Column(UUID(as_uuid=True), ForeignKey('form_section.id', ondelete="SET NULL"), index=True)
    key   = Column(String(120), nullable=False, index=True)  # 'arpu','churn','moats', etc.
    text  = Column(Text, nullable=False)
    qtype = Column(String(20), nullable=False)  # text|number|currency|single|multi|percent|url|date
    required = Column(Boolean, default=False)
    order = Column(Integer, default=0)

class FormOption(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'form_option'
    question_id = Column(UUID(as_uuid=True), ForeignKey('form_question.id', ondelete="CASCADE"), nullable=False, index=True)
    value = Column(String(160), nullable=False)
    label = Column(String(200))
    order = Column(Integer, default=0)
    __table_args__ = (UniqueConstraint('question_id','value', name='uq_option_per_question'),)

class FormResponse(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'form_response'
    form_id = Column(UUID(as_uuid=True), ForeignKey('form_definition.id', ondelete="CASCADE"), nullable=False, index=True)
    respondent_enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), index=True)
    respondent_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), index=True)
    source = Column(String(30), default='upload')  # upload|direct|api
    raw_payload = Column(JSONB, default=dict)      # original CSV row
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    __table_args__ = (
        CheckConstraint("(respondent_enterprise_id IS NOT NULL) <> (respondent_user_id IS NOT NULL)", name='ck_form_resp_subject'),
    )

class FormAnswer(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'form_answer'
    response_id = Column(UUID(as_uuid=True), ForeignKey('form_response.id', ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(UUID(as_uuid=True), ForeignKey('form_question.id', ondelete="CASCADE"), nullable=False, index=True)
    value_text = Column(Text)
    value_number = Column(Numeric(20,4))
    value_percent = Column(Numeric(6,3))
    value_currency_usd = Column(Numeric(20,2))
    value_date = Column(Date)
    extra = Column(JSONB, default=dict)
    __table_args__ = (UniqueConstraint('response_id','question_id', name='uq_answer_once'),)

class FormAnswerOption(Base, UUIDMixin):
    __tablename__ = 'form_answer_option'
    answer_id = Column(UUID(as_uuid=True), ForeignKey('form_answer.id', ondelete="CASCADE"), nullable=False, index=True)
    option_id = Column(UUID(as_uuid=True), ForeignKey('form_option.id', ondelete="CASCADE"), nullable=False, index=True)
    __table_args__ = (UniqueConstraint('answer_id','option_id', name='uq_answer_option'),)

class QuestionnaireImportBatch(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'questionnaire_import_batch'
    provider = Column(String(50), nullable=False, default='intelleges')
    role = Column(String(20), nullable=False)
    form_id = Column(UUID(as_uuid=True), ForeignKey('form_definition.id', ondelete="SET NULL"))
    file_path = Column(String(500))
    total_rows = Column(Integer, default=0)
    imported_rows = Column(Integer, default=0)
    error_rows = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True))
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="SET NULL"))

class QuestionnaireImportError(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'questionnaire_import_error'
    batch_id = Column(UUID(as_uuid=True), ForeignKey('questionnaire_import_batch.id', ondelete="CASCADE"), nullable=False, index=True)
    row_number = Column(Integer, nullable=False)
    row_data = Column(JSONB, default=dict)
    error_msg = Column(Text, nullable=False)

# =========================
# VALIDATOR NETWORK + SERVICES
# =========================
class VerificationDimension(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'verification_dimension'
    key = Column(String(64), nullable=False, unique=True, index=True)  # financial_health, legal_compliance, etc.
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    is_active = Column(Boolean, default=True, nullable=False)

class ValidatorCategory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'validator_category'
    key = Column(String(64), nullable=False, unique=True, index=True)  # business_legal|financial|technical|ip|sme
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    default_dimension_id = Column(UUID(as_uuid=True), ForeignKey('verification_dimension.id', ondelete="SET NULL"))
    is_active = Column(Boolean, default=True, nullable=False)

class ValidatorProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'validator_profile'
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, unique=True, index=True)
    category_id   = Column(UUID(as_uuid=True), ForeignKey('validator_category.id', ondelete="SET NULL"), index=True)
    headline = Column(String(200))
    bio = Column(Text)
    years_experience = Column(Integer)
    rating_avg   = Column(Numeric(3,2), default=0)
    rating_count = Column(Integer, default=0)
    response_sla_h = Column(Integer, default=72)
    geographies = Column(ARRAY(String), default=list)
    is_public   = Column(Boolean, default=True, index=True)
    application_id = sa.Column(UUID(as_uuid=True), sa.ForeignKey("validator_application.id"))
    application    = sa.orm.relationship("ValidatorApplication")


class ValidatorApplication(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "validator_application"

    applicant_user_id = sa.Column(UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    enterprise_id     = sa.Column(UUID(as_uuid=True), sa.ForeignKey("enterprise.id", ondelete="SET NULL"))
    status            = sa.Column(sa.Enum("draft","submitted","in_review","needs_more_info","approved","rejected","withdrawn",
                                         name="validator_application_status"), nullable=False, default="draft")
    submitted_at      = sa.Column(sa.DateTime(timezone=True))
    reviewed_by       = sa.Column(UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at       = sa.Column(sa.DateTime(timezone=True))
    decision_reason   = sa.Column(sa.Text)
    application_data  = sa.Column(JSONB, default=dict)
    intelleges_questionnaire_id = sa.Column(sa.String(255))
    intelleges_status           = sa.Column(sa.String(50))
    intelleges_completed_at     = sa.Column(sa.DateTime(timezone=True))
    intelleges_response_data    = sa.Column(JSONB)

    applicant   = sa.orm.relationship("User", foreign_keys=[applicant_user_id])
    reviewer    = sa.orm.relationship("User", foreign_keys=[reviewed_by])
    enterprise  = sa.orm.relationship("Enterprise")

class ValidatorIndustry(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'validator_industry'
    validator_profile_id = Column(UUID(as_uuid=True), ForeignKey('validator_profile.id', ondelete="CASCADE"), nullable=False, index=True)
    industry_id = Column(UUID(as_uuid=True), ForeignKey('industry.id', ondelete="CASCADE"), nullable=False, index=True)
    __table_args__ = (UniqueConstraint('validator_profile_id','industry_id', name='uq_validator_industry'),)

class ValidatorService(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'validator_service'
    validator_profile_id = Column(UUID(as_uuid=True), ForeignKey('validator_profile.id', ondelete="CASCADE"), nullable=False, index=True)
    dimension_id = Column(UUID(as_uuid=True), ForeignKey('verification_dimension.id', ondelete="SET NULL"), index=True)
    name = Column(String(160), nullable=False)
    description = Column(Text)
    price_usd = Column(Numeric(10,2))
    currency  = Column(String(3), default='USD')
    base_sla_h = Column(Integer, default=72)
    is_active = Column(Boolean, default=True, index=True)
    __table_args__ = (UniqueConstraint('validator_profile_id','name', name='uq_validator_service_per_firm'),)

class ValidationRequest(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'validation_request'
    id = sa.Column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    requester_enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, index=True)
    validator_enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, index=True)
    validator_service_id    = Column(UUID(as_uuid=True), ForeignKey('validator_service.id', ondelete="SET NULL"), index=True)
    status = Column(String(30), nullable=False, default='requested', index=True)  # requested|accepted|in_review|delivered|rejected|cancelled|refunded
    price_agreed = Column(Numeric(10,2))
    currency = Column(String(3), default='USD')
    due_at = Column(DateTime(timezone=True))
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    payout_split_validator_pct = Column(Numeric(5,2), default=62.5)
    payout_split_hric_pct = Column(Numeric(5,2), default=37.5)
    stripe_payment_intent_id = Column(String(100), index=True)
    stripe_transfer_group    = Column(String(100))
    notes = Column(Text)

    deliverables = sa.orm.relationship(
        "ValidationDeliverable",
        back_populates="validation_request",
        cascade="all, delete-orphan",
        passive_deletes=True,
        # optional, helps explicitness:
        foreign_keys="ValidationDeliverable.validation_request_id",
    )

class ValidationDeliverable(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "validation_deliverable"

    id = sa.Column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))

    # keep only this FK
    validation_request_id = sa.Column(
        UUID(as_uuid=True),
        sa.ForeignKey("validation_request.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title       = sa.Column(sa.String(200), nullable=False)
    description = sa.Column(sa.Text)
    document_id = sa.Column(UUID(as_uuid=True), sa.ForeignKey("document.id", ondelete="SET NULL"))

    deliverable_metadata = sa.Column("metadata", JSONB, default=dict)

    validation_request = sa.orm.relationship(
        "ValidationRequest",
        back_populates="deliverables",
        foreign_keys=[validation_request_id],
    )
    document = sa.orm.relationship("Document")

class ValidationReview(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'validation_review'
    request_id  = Column(UUID(as_uuid=True), ForeignKey('validation_request.id', ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text)
    is_verified = Column(Boolean, default=True)
    __table_args__ = (CheckConstraint("rating BETWEEN 1 AND 5"),)

# =========================
# SERVICES RECOMMENDED + DEAL DOCS
# =========================
class ServiceCatalog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'service_catalog'
    key = Column(String(80), nullable=False, unique=True, index=True)
    name = Column(String(160), nullable=False)
    description = Column(Text)
    default_dimension_id = Column(UUID(as_uuid=True), ForeignKey('verification_dimension.id', ondelete="SET NULL"))
    applies_to_roles = Column(ARRAY(String), default=['startup','investor'])
    suggested_price_low_usd  = Column(Numeric(10,2))
    suggested_price_high_usd = Column(Numeric(10,2))
    sla_hours = Column(Integer)

class ServiceRecommendation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'service_recommendation'
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, index=True)
    service_key   = Column(String(80), ForeignKey('service_catalog.key', ondelete="CASCADE"), nullable=False, index=True)
    source  = Column(String(40), default='questionnaire')  # questionnaire|rule|ml|manual
    reason  = Column(Text)
    score   = Column(Numeric(5,4))
    status  = Column(String(20), default='suggested')      # suggested|dismissed|converted
    __table_args__ = (UniqueConstraint('enterprise_id','service_key', name='uq_service_reco_once'),)

class TermSheet(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'term_sheet'
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, index=True)
    round_type = Column(String(20), index=True)
    investment_amount_usd = Column(Numeric(12,2))
    valuation_cap_usd     = Column(Numeric(12,2))
    discount_pct          = Column(Numeric(5,2))
    milestones = Column(JSONB, default=list)
    notes = Column(Text)
    status  = Column(String(20), default='draft', index=True)  # draft|issued|accepted|superseded
    version = Column(Integer, default=1)
    pdf_path = Column(String(500))

class SafeAgreement(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'safe_agreement'
    term_sheet_id = Column(UUID(as_uuid=True), ForeignKey('term_sheet.id', ondelete="CASCADE"), nullable=False, index=True)
    template_key  = Column(String(50), default='safe_standard')
    post_money    = Column(Boolean, default=True)
    governing_law = Column(String(80))
    currency      = Column(String(3), default='USD')
    esign_status  = Column(String(20), default='draft', index=True)
    executed_at   = Column(DateTime(timezone=True))
    file_path     = Column(String(500))
    # rename attribute
    agreement_metadata = Column("metadata", JSONB, default=dict)
    term_sheet   = relationship("TermSheet")

# =========================
# DOCUMENTS / MESSAGING / ACCESS
# =========================
class Document(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'document'
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), index=True)
    uploaded_by   = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="SET NULL"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    document_type = Column(String(50), index=True)
    file_path     = Column(String(1000), nullable=False)
    file_name     = Column(String(255), nullable=False)
    file_size     = Column(Integer)
    mime_type     = Column(String(100))
    file_hash     = Column(String(64))
    version_number= Column(Integer, default=1)
    is_public     = Column(Boolean, default=False, index=True)
    access_level  = Column(String(20), default='private', index=True)
    description   = Column(Text)
    tags          = Column(ARRAY(Text))
    doc_metadata = Column("metadata", JSONB, default=dict)
    uploaded_at   = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    __table_args__ = (
        CheckConstraint("document_type IN ('pitch_deck','financial_model','business_plan','legal_doc','due_diligence','term_sheet','contract','report','other')"),
        CheckConstraint("access_level IN ('public','enterprise','private','confidential')"),
        UniqueConstraint('enterprise_id','file_name','version_number', name='uq_doc_version'),
        Index('idx_document_metadata', doc_metadata, postgresql_using='gin'),
        Index('idx_doc_tags','tags', postgresql_using='gin'),
    )

class Messaging(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'messaging'
    sender_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    recipient_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    thread_id = Column(UUID(as_uuid=True), index=True)
    parent_message_id = Column(UUID(as_uuid=True), ForeignKey('messaging.id', ondelete="SET NULL"))
    subject = Column(String(200))
    content = Column(Text, nullable=False)
    message_type = Column(String(20), default='direct')
    priority = Column(String(10), default='normal')
    is_read = Column(Boolean, default=False, index=True)
    is_archived = Column(Boolean, default=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    __table_args__ = (
        CheckConstraint("message_type IN ('direct','system','notification','announcement')"),
        CheckConstraint("priority IN ('low','normal','high','urgent')"),
        Index('idx_messaging_thread','thread_id','sent_at'),
    )

class SecuredAccess(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'secured_access'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False)
    resource_id   = Column(UUID(as_uuid=True), nullable=False)
    access_level  = Column(String(20), nullable=False)
    permissions   = Column(JSONB, default=dict)
    granted_by    = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="SET NULL"))
    granted_date  = Column(DateTime(timezone=True), server_default=func.now())
    expires_date  = Column(DateTime(timezone=True))
    is_active     = Column(Boolean, default=True)
    __table_args__ = (
        UniqueConstraint('user_id','resource_type','resource_id', name='uq_user_resource'),
        CheckConstraint("access_level IN ('read','write','admin','owner')"),
    )

# =========================
# BILLING (kept minimal)
# =========================
class UserPlan(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'user_plan'
    plan_key = Column(String(50), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    monthly_price = Column(Numeric(10,2))
    annual_price  = Column(Numeric(10,2))
    features = Column(JSONB, default=list)
    is_active = Column(Boolean, default=True)

class Subscription(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'subscription'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    user_plan_id = Column(UUID(as_uuid=True), ForeignKey('user_plan.id', ondelete="SET NULL"), nullable=False, index=True)
    status = Column(String(30), default=SubscriptionStatus.ACTIVE.value, index=True)
    start_date = Column(DateTime(timezone=True), nullable=False)
    current_period_end = Column(DateTime(timezone=True))
    amount = Column(Numeric(10,2), nullable=False)
    currency = Column(String(3), default='USD')
    stripe_subscription_id = Column(String(100), index=True)
    stripe_customer_id = Column(String(100), index=True)
    __table_args__ = (
        CheckConstraint("status IN ('active','trialing','canceled','incomplete','incomplete_expired','past_due','unpaid','paused')"),
        CheckConstraint("amount >= 0"),
    )

class StripeEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'stripe_event'
    stripe_event_id = Column(String(255), nullable=False, unique=True, index=True)
    type = Column(String(100), index=True)
    payload = Column(JSONB, nullable=False)
    received_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(DateTime(timezone=True))
    status = Column(String(20), default='received')  # received|processed|error
    error = Column(Text)

# =========================
# (OPTIONAL) KYC/AML VERIFICATION – kept but slim
# =========================
class VerificationLevel(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'verification_levels'
    name = Column(String(50), nullable=False)
    user_type = Column(String(20), nullable=False)  # investor|startup
    price_usd = Column(Numeric(10,2), nullable=False, default=0)
    features = Column(JSONB, default=dict)
    processing_time_days = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    __table_args__ = (CheckConstraint("user_type IN ('investor','startup')"),)

class Verification(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'verifications'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    verification_level_id = Column(UUID(as_uuid=True), ForeignKey('verification_levels.id'), nullable=False, index=True)
    user_type = Column(String(20), nullable=False)  # investor|startup
    status = Column(String(30), nullable=False, default="pending", index=True)
    risk_score = Column(Integer)
    verification_data = Column(JSONB, default=dict)
    initiated_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint("user_type IN ('investor','startup')"),
        CheckConstraint("status IN ('pending','in_progress','under_review','approved','rejected','expired')"),
        CheckConstraint("risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100)"),
    )

class DocumentType(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'document_types'
    name = Column(String(100), nullable=False)
    user_type = Column(String(20), nullable=False)  # investor|startup
    verification_level = Column(String(50), nullable=False)
    is_required = Column(Boolean, nullable=False, default=True)
    accepted_formats = Column(ARRAY(String), default=["pdf","jpg","jpeg","png"])
    max_file_size_mb = Column(Integer, default=50)
    __table_args__ = (CheckConstraint("user_type IN ('investor','startup')"),)

class VerificationDocument(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'verification_documents'
    verification_id = Column(UUID(as_uuid=True), ForeignKey('verifications.id', ondelete="CASCADE"), nullable=False, index=True)
    document_type_id = Column(UUID(as_uuid=True), ForeignKey('document_types.id'), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    status = Column(String(30), nullable=False, default="pending", index=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    processed_at = Column(DateTime(timezone=True))
    __table_args__ = (CheckConstraint("status IN ('pending','processing','approved','rejected')"),)

class ExternalService(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'external_services'
    service_name = Column(String(100), nullable=False, unique=True)
    service_type = Column(String(50), nullable=False)
    api_endpoint = Column(String(500), nullable=False)
    api_version = Column(String(20))
    configuration = Column(JSONB, default=dict)
    is_active = Column(Boolean, default=True, nullable=False)

class ExternalServiceCall(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'external_service_calls'
    verification_id = Column(UUID(as_uuid=True), ForeignKey('verifications.id', ondelete="CASCADE"), nullable=False, index=True)
    service_id = Column(UUID(as_uuid=True), ForeignKey('external_services.id'), nullable=False, index=True)
    call_type = Column(String(100), nullable=False)
    request_data = Column(JSONB, default=dict)
    response_data= Column(JSONB, default=dict)
    status = Column(String(30), nullable=False)  # pending|success|failed|timeout
    response_time_ms = Column(Integer)
    cost_usd = Column(Numeric(10,2))
    __table_args__ = (CheckConstraint("status IN ('pending','success','failed','timeout')"),)