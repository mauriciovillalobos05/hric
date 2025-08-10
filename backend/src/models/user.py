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

# ---------------------------------------
# Base
# ---------------------------------------
Base = declarative_base()

# ---------------------------------------
# Mixins
# ---------------------------------------
class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class UUIDMixin:
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
                server_default=text("uuid_generate_v4()"))

class SupabaseUserMixin:
    """Helpers to sync with Supabase Auth."""
    @classmethod
    def create_from_supabase_user(cls, supabase_user_data):
        return cls(
            id=supabase_user_data.get('id'),
            email=supabase_user_data.get('email'),
            first_name=supabase_user_data.get('user_metadata', {}).get('first_name', ''),
            last_name=supabase_user_data.get('user_metadata', {}).get('last_name', ''),
            phone=supabase_user_data.get('phone'),
        )

    def sync_with_supabase(self, supabase_user_data):
        self.email = supabase_user_data.get('email', self.email)
        self.phone = supabase_user_data.get('phone', self.phone)
        self.updated_at = datetime.utcnow()

# ---------------------------------------
# Enums
# ---------------------------------------
class EnterpriseType(str, Enum):
    INVESTOR = "investor"
    STARTUP  = "startup"
    BOTH     = "both"

class UserRole(str, Enum):
    OWNER  = "owner"
    ADMIN  = "admin"
    MEMBER = "member"
    VIEWER = "viewer"

class MeetingType(str, Enum):
    PITCH            = "pitch"
    DUE_DILIGENCE    = "due_diligence"
    NETWORKING       = "networking"
    DEMO             = "demo"
    FOLLOW_UP        = "follow_up"
    BOARD            = "board"
    INVESTOR_UPDATE  = "investor_update"

class FundingRoundType(str, Enum):
    PRE_SEED = "pre_seed"
    SEED     = "seed"
    SERIES_A = "series_a"
    SERIES_B = "series_b"
    SERIES_C = "series_c"
    SERIES_D = "series_d"
    BRIDGE   = "bridge"
    GROWTH   = "growth"
    IPO      = "ipo"

class InteractionType(str, Enum):
    VIEW                = "view"
    LIKE                = "like"
    PASS                = "pass"
    CONTACT             = "contact"
    MEETING_REQUEST     = "meeting_request"
    FOLLOW_UP           = "follow_up"
    INVESTMENT_INTEREST = "investment_interest"

# Stripe-aligned subscription statuses (mirror Stripe)
class SubscriptionStatus(str, Enum):
    ACTIVE              = "active"
    TRIALING            = "trialing"
    CANCELED            = "canceled"
    INCOMPLETE          = "incomplete"
    INCOMPLETE_EXPIRED  = "incomplete_expired"
    PAST_DUE            = "past_due"
    UNPAID              = "unpaid"
    PAUSED              = "paused"

# ---------------------------------------
# 2. LOOKUP TABLES
# ---------------------------------------
class Industry(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'industry'
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    category = Column(String(50))
    is_active = Column(Boolean, default=True, nullable=False)
    enterprise_profiles = relationship("EnterpriseProfile", back_populates="industry")

class Stage(Base, UUIDMixin):
    __tablename__ = 'stage'
    name = Column(String(50), nullable=False, unique=True)
    description = Column(Text)
    order_sequence = Column(Integer, nullable=False)
    stage_type = Column(String(20), CheckConstraint("stage_type IN ('startup','investor','both')"))
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    enterprise_profiles = relationship("EnterpriseProfile", back_populates="stage")

class VenueType(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'venue_type'
    name = Column(String(100), nullable=False)
    description = Column(Text)
    typical_capacity = Column(JSONB)
    amenities = Column(JSONB)
    is_active = Column(Boolean, default=True)
    events = relationship("Event", back_populates="venue_type")

class AchievementType(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'achievement_type'
    name = Column(String(100), nullable=False)
    description = Column(Text)
    category = Column(String(50))
    criteria = Column(JSONB, nullable=False)
    points_value = Column(Integer, default=0)
    badge_icon = Column(String(255))
    is_active = Column(Boolean, default=True)
    user_achievements = relationship("UserAchievement", back_populates="achievement_type")

class UserPlan(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'user_plan'
    plan_key = Column(String(50), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    monthly_price = Column(Numeric(10, 2))
    annual_price = Column(Numeric(10, 2))
    features = Column(JSONB, default=list)
    max_connections = Column(Integer)
    max_storage_gb = Column(Integer)
    is_active = Column(Boolean, default=True)
    # Stripe mapping
    stripe_product_id = Column(String(100))
    stripe_price_id_monthly = Column(String(100))
    stripe_price_id_annual  = Column(String(100))
    subscriptions = relationship("Subscription", back_populates="user_plan")

class SimulationParameters(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'simulation_parameters'
    name = Column(String(100), nullable=False)
    parameter_type = Column(String(50), CheckConstraint("parameter_type IN ('investor','startup','market')"))
    default_values = Column(JSONB, default=dict)
    constraints = Column(JSONB, default=dict)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    investor_simulations = relationship("InvestorSimulation", back_populates="parameters")
    startup_simulations = relationship("StartupSimulation", back_populates="parameters")

class Leaderboard(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'leaderboard'
    name = Column(String(100), nullable=False)
    category = Column(String(50))
    time_period = Column(String(20), CheckConstraint(
        "time_period IN ('daily','weekly','monthly','quarterly','yearly','all_time')"))
    start_date = Column(Date)
    end_date = Column(Date)
    is_active = Column(Boolean, default=True)
    entries = relationship("LeaderboardEntry", back_populates="leaderboard")

# ---------------------------------------
# 3. CORE USER AND ENTERPRISE MODELS
# ---------------------------------------
class User(Base, UUIDMixin, TimestampMixin, SupabaseUserMixin):
    __tablename__ = 'users'
    # Core
    email = Column(String(255), nullable=False, unique=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20))
    location = Column(String(200), index=True)
    # Stripe / billing
    stripe_customer_id = Column(String(100), index=True)
    # Profile
    profile_image_url = Column(String(500))
    bio = Column(Text)
    linkedin_url = Column(String(255))
    twitter_url = Column(String(255))
    website_url = Column(String(255))
    # Preferences
    timezone = Column(String(50), default='UTC')
    language_preference = Column(String(10), default='en')
    notification_preferences = Column(JSONB, default=dict)
    # Status
    onboarding_completed = Column(Boolean, default=False)
    last_active_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True, index=True)

    # Relationships
    enterprise_memberships = relationship(
        "EnterpriseUser",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="EnterpriseUser.user_id",
    )
    sent_messages = relationship("Messaging", foreign_keys="Messaging.sender_user_id", back_populates="sender")
    received_messages = relationship("Messaging", foreign_keys="Messaging.recipient_user_id", back_populates="recipient")
    subscriptions = relationship("Subscription", back_populates="user")
    virtual_portfolios = relationship("VirtualPortfolio", back_populates="user", cascade="all, delete-orphan")
    achievements = relationship("UserAchievement", back_populates="user")
    activities = relationship("UserActivity", back_populates="user")
    match_interactions = relationship("MatchInteraction", back_populates="user")
    dashboard_configs = relationship("DashboardConfig", back_populates="user", cascade="all, delete-orphan")
    created_meetings = relationship("Meeting", back_populates="created_by_user")
    created_events = relationship("Event", back_populates="created_by_user")
    uploaded_documents = relationship("Document", back_populates="uploaded_by_user")

    @hybrid_property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @validates('email')
    def validate_email(self, key, email):
        import re
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email or ''):
            raise ValueError('Invalid email format')
        return email.lower()

# Case-insensitive unique email
Index('uq_users_email_lower', func.lower(User.email), unique=True)

class Enterprise(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'enterprise'
    name = Column(String(200), nullable=False, index=True)
    enterprise_type = Column(String(20), nullable=False, index=True)
    description = Column(Text)
    founded_date = Column(Date)
    location = Column(String(200), index=True)
    website = Column(String(255))
    logo_url = Column(String(500))
    employee_count = Column(Integer)
    headquarters_address = Column(Text)
    # Legal
    legal_name = Column(String(200))
    tax_id = Column(String(50))
    registration_number = Column(String(100))
    # Status
    is_verified = Column(Boolean, default=False, index=True)
    verification_date = Column(DateTime(timezone=True))
    status = Column(String(20), default='active', index=True)

    __table_args__ = (
        CheckConstraint("enterprise_type IN ('investor','startup','both')", name='check_enterprise_type'),
        CheckConstraint("status IN ('active','inactive','pending','suspended')", name='check_status'),
    )

    # Relationships
    members = relationship("EnterpriseUser", back_populates="enterprise", cascade="all, delete-orphan")
    profile = relationship("EnterpriseProfile", back_populates="enterprise", uselist=False, cascade="all, delete-orphan")
    investor_profile = relationship("InvestorProfile", back_populates="enterprise", uselist=False, cascade="all, delete-orphan")
    startup_profile = relationship("StartupProfile", back_populates="enterprise", uselist=False, cascade="all, delete-orphan")
    investor_matches = relationship("MatchScore", foreign_keys="MatchScore.investor_enterprise_id", back_populates="investor_enterprise")
    startup_matches = relationship("MatchScore", foreign_keys="MatchScore.startup_enterprise_id", back_populates="startup_enterprise")
    meetings = relationship("Meeting", back_populates="enterprise", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="enterprise", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="enterprise", cascade="all, delete-orphan")
    market_recommendations = relationship("MarketRecommendation", back_populates="enterprise", cascade="all, delete-orphan")

    @validates('enterprise_type')
    def validate_enterprise_type(self, key, enterprise_type):
        valid = {'investor', 'startup', 'both'}
        if enterprise_type not in valid:
            raise ValueError(f'Enterprise type must be one of: {sorted(valid)}')
        return enterprise_type

class EnterpriseUser(Base, UUIDMixin):
    __tablename__ = 'enterprise_user'
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False, index=True)
    permissions = Column(JSONB, default=dict)
    joined_date = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True, index=True)
    invited_by    = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="SET NULL"), nullable=True, index=True)

    __table_args__ = (
        UniqueConstraint('enterprise_id', 'user_id', name='unique_enterprise_user'),
        CheckConstraint("role IN ('owner','admin','member','viewer')", name='check_role'),
        Index('uq_enterprise_owner', 'enterprise_id', unique=True, postgresql_where=text("role='owner'")),
    )

    enterprise = relationship(
        "Enterprise",
        back_populates="members",
        foreign_keys=[enterprise_id],            # 👈 explicit but not strictly required
    )
    user = relationship(
        "User",
        back_populates="enterprise_memberships",
        foreign_keys=[user_id],                  # 👈 disambiguates from invited_by
    )
    inviter = relationship(
        "User",
        foreign_keys=[invited_by],               # 👈 the OTHER user FK
    )

# ---------------------------------------
# 4. PROFILE & SPECIALIZATION
# ---------------------------------------
class EnterpriseProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'enterprise_profile'
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, unique=True)
    industry_id = Column(UUID(as_uuid=True), ForeignKey('industry.id', ondelete="SET NULL"), index=True)
    stage_id = Column(UUID(as_uuid=True), ForeignKey('stage.id', ondelete="SET NULL"), index=True)
    description = Column(Text)
    contact_info = Column(JSONB, default=dict)
    social_media = Column(JSONB, default=dict)
    key_metrics = Column(JSONB, default=dict)
    competitive_advantages = Column(ARRAY(Text))
    target_markets = Column(ARRAY(Text))
    headline_tags = Column(ARRAY(String), default=list)

    enterprise = relationship("Enterprise", back_populates="profile")
    industry = relationship("Industry", back_populates="enterprise_profiles")
    stage = relationship("Stage", back_populates="enterprise_profiles")

    __table_args__ = (
        Index('idx_enterprise_profile_key_metrics', 'key_metrics', postgresql_using='gin'),
        Index('idx_enterprise_profile_target_markets', 'target_markets', postgresql_using='gin'),
        Index('idx_enterprise_profile_headline_tags', 'headline_tags', postgresql_using='gin'),
    )

class InvestorProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'investor_profile'
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, unique=True)
    investment_thesis = Column(Text)
    min_investment = Column(Numeric(15, 2), index=True)
    max_investment = Column(Numeric(15, 2), index=True)
    typical_check_size = Column(Numeric(15, 2))
    years_experience = Column(Integer)
    total_investments = Column(Integer, default=0)
    successful_exits = Column(Integer, default=0)
    portfolio_companies = Column(JSONB, default=list)
    investment_approach = Column(Text)
    value_add_services = Column(ARRAY(Text))
    enterprise = relationship("Enterprise", back_populates="investor_profile")
    investment_preferences = relationship("InvestmentPreferences", back_populates="investor_profile", uselist=False, cascade="all, delete-orphan")
    simulations = relationship("InvestorSimulation", back_populates="investor_profile")

    __table_args__ = (
        Index('idx_investor_profile_portfolio', 'portfolio_companies', postgresql_using='gin'),
    )

class InvestorIndustry(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'investor_industry'
    investor_profile_id = Column(UUID(as_uuid=True), ForeignKey('investor_profile.id', ondelete="CASCADE"), nullable=False, index=True)
    industry_id = Column(UUID(as_uuid=True), ForeignKey('industry.id', ondelete="CASCADE"), nullable=False, index=True)
    __table_args__ = (UniqueConstraint('investor_profile_id', 'industry_id', name='uq_investor_industry'),)

class InvestorStage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'investor_stage'
    investor_profile_id = Column(UUID(as_uuid=True), ForeignKey('investor_profile.id', ondelete="CASCADE"), nullable=False, index=True)
    stage_id = Column(UUID(as_uuid=True), ForeignKey('stage.id', ondelete="CASCADE"), nullable=False, index=True)
    __table_args__ = (UniqueConstraint('investor_profile_id', 'stage_id', name='uq_investor_stage'),)

class InvestmentPreferences(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'investment_preferences'
    investor_profile_id = Column(UUID(as_uuid=True), ForeignKey('investor_profile.id', ondelete="CASCADE"), nullable=False, unique=True)
    min_deal_size = Column(Numeric(15, 2), index=True)
    max_deal_size = Column(Numeric(15, 2), index=True)
    investment_criteria = Column(JSONB, default=dict)
    exclusion_criteria = Column(JSONB, default=dict)
    due_diligence_requirements = Column(JSONB, default=dict)
    decision_timeline_days = Column(Integer)
    follow_on_strategy = Column(Text)
    investor_profile = relationship("InvestorProfile", back_populates="investment_preferences")

# --- NEW: GeographicArea + join table ---
class GeographicArea(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'geographic_area'
    name = Column(String(150), nullable=False, unique=True, index=True)  # e.g., "North America", "Germany", "SF Bay Area"
    type = Column(String(30))  # optional: country|region|city|custom
    is_active = Column(Boolean, default=True, nullable=False)

class InvestorGeographicFocus(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'investor_geographic_focus'
    investor_profile_id = Column(UUID(as_uuid=True), ForeignKey('investor_profile.id', ondelete="CASCADE"),
                                 nullable=False, index=True)
    geographic_area_id  = Column(UUID(as_uuid=True), ForeignKey('geographic_area.id', ondelete="CASCADE"),
                                 nullable=False, index=True)
    __table_args__ = (UniqueConstraint('investor_profile_id','geographic_area_id',
                                       name='uq_investor_geographic_focus'),)


class StartupProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'startup_profile'
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, unique=True)
    business_model = Column(String(100))
    value_proposition = Column(Text)
    team_size = Column(Integer)
    target_market = Column(Text)
    competitive_advantages = Column(ARRAY(Text))
    revenue_model = Column(String(100))
    current_revenue = Column(Numeric(15, 2))
    monthly_growth_rate = Column(Numeric(5, 2))
    customer_count = Column(Integer)
    market_size = Column(Numeric(15, 2))
    addressable_market = Column(Numeric(15, 2))
    traction_metrics = Column(JSONB, default=dict)
    intellectual_property = Column(JSONB, default=dict)
    regulatory_considerations = Column(Text)
    mrr_usd                 = Column(Numeric(15, 2))     # $/month, optional; UI will fall back to current_revenue
    arr_usd                 = Column(Numeric(15, 2))     # convenience (12 * MRR)
    current_valuation_usd   = Column(Numeric(15, 2))     # denormed from latest funding round (post-money if present)
    current_investors       = Column(ARRAY(String), default=list)  # denormed names for chips
    technical_founders_pct  = Column(Numeric(5, 2))      # 0–100
    previous_exits_pct      = Column(Numeric(5, 2))      # 0–100
    enterprise = relationship("Enterprise", back_populates="startup_profile")
    metrics = relationship("StartupMetrics", back_populates="startup_profile", cascade="all, delete-orphan")
    funding_rounds = relationship("FundingRound", back_populates="startup_profile", cascade="all, delete-orphan")
    simulations = relationship("StartupSimulation", back_populates="startup_profile")

    __table_args__ = (
        Index('idx_startup_metrics_traction', 'traction_metrics', postgresql_using='gin'),
    )

    # --- helpers the UI can use directly ---
    @hybrid_property
    def display_mrr_usd(self):
        """Prefer explicit mrr_usd; otherwise fall back to current_revenue."""
        return self.mrr_usd or self.current_revenue

    @hybrid_property
    def display_valuation_usd(self):
        """Prefer denormed valuation; otherwise best-effort from latest funding round."""
        if self.current_valuation_usd:
            return self.current_valuation_usd
        # If not denormed, try to read the most recent FundingRound in-memory
        if self.funding_rounds:
            latest = sorted((fr for fr in self.funding_rounds if fr.close_date or fr.announcement_date),
                            key=lambda fr: (fr.close_date or fr.announcement_date), reverse=True)[0]
            return latest.post_money_valuation or latest.pre_money_valuation
        return None
    
class StartupMetrics(Base, UUIDMixin):
    __tablename__ = 'startup_metrics'
    startup_profile_id = Column(UUID(as_uuid=True), ForeignKey('startup_profile.id', ondelete="CASCADE"), nullable=False, index=True)
    metric_type = Column(String(50), nullable=False, index=True)
    metric_name = Column(String(100), nullable=False)
    value = Column(Numeric(20, 4), nullable=False)
    unit = Column(String(20))
    period_start = Column(Date)
    period_end = Column(Date)
    is_public = Column(Boolean, default=False)
    notes = Column(Text)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="SET NULL"))

    startup_profile = relationship("StartupProfile", back_populates="metrics")
    creator = relationship("User")

    __table_args__ = (
        UniqueConstraint('startup_profile_id','metric_type','metric_name','period_start','period_end',
                         name='uq_startup_metric_period'),
        Index('idx_startup_metric_name', 'metric_name'),  # fast lookups
    )

class FundingRound(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'funding_round'
    startup_profile_id = Column(UUID(as_uuid=True), ForeignKey('startup_profile.id', ondelete="CASCADE"), nullable=False, index=True)
    round_type = Column(String(20), nullable=False, index=True)
    amount_raised = Column(Numeric(15, 2), index=True)
    pre_money_valuation = Column(Numeric(15, 2))
    post_money_valuation = Column(Numeric(15, 2))
    lead_investor = Column(String(200))
    investors = Column(JSONB, default=list)
    close_date = Column(Date, index=True)
    announcement_date = Column(Date)
    use_of_funds = Column(Text)
    terms_summary = Column(Text)
    is_public = Column(Boolean, default=False)
    notes = Column(Text)

    __table_args__ = (
        CheckConstraint("round_type IN ('pre_seed','seed','series_a','series_b','series_c','series_d','bridge','growth','ipo')", name='check_round_type'),
    )

    startup_profile = relationship("StartupProfile", back_populates="funding_rounds")

# ---------------------------------------
# 5. MATCHING & INTERACTIONS
# ---------------------------------------
class MatchScore(Base, UUIDMixin):
    __tablename__ = 'match_score'
    investor_enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, index=True)
    startup_enterprise_id  = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, index=True)
    compatibility_score = Column(Numeric(5, 4))
    fit_score           = Column(Numeric(5, 4))
    overall_score       = Column(Numeric(5, 4), index=True)
    score_breakdown     = Column(JSONB, default=dict)
    algorithm_version   = Column(String(20))
    confidence_level    = Column(Numeric(5, 4))
    calculated_at       = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    expires_at          = Column(DateTime(timezone=True))
    is_active           = Column(Boolean, default=True, index=True)
    notes               = Column(Text)

    __table_args__ = (
        UniqueConstraint('investor_enterprise_id', 'startup_enterprise_id', name='unique_match'),
        CheckConstraint('compatibility_score >= 0 AND compatibility_score <= 1', name='check_compatibility_score'),
        CheckConstraint('fit_score >= 0 AND fit_score <= 1', name='check_fit_score'),
        CheckConstraint('overall_score >= 0 AND overall_score <= 1', name='check_overall_score'),
        Index('idx_match_score_breakdown', 'score_breakdown', postgresql_using='gin'),
    )

    investor_enterprise = relationship("Enterprise", foreign_keys=[investor_enterprise_id], back_populates="investor_matches")
    startup_enterprise  = relationship("Enterprise", foreign_keys=[startup_enterprise_id], back_populates="startup_matches")
    interactions        = relationship("MatchInteraction", back_populates="match", cascade="all, delete-orphan")

class MatchInteraction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'match_interaction'
    match_id = Column(UUID(as_uuid=True), ForeignKey('match_score.id', ondelete="CASCADE"), nullable=False, index=True)
    user_id  = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    interaction_type  = Column(String(50), nullable=False, index=True)
    interaction_value = Column(JSONB, default=dict)
    notes             = Column(Text)
    is_mutual         = Column(Boolean, default=False)
    response_required = Column(Boolean, default=False)
    responded_at      = Column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("interaction_type IN ('view','like','pass','contact','meeting_request','follow_up','investment_interest')", name='check_interaction_type'),
    )

    match = relationship("MatchScore", back_populates="interactions")
    user  = relationship("User", back_populates="match_interactions")

class VirtualPortfolio(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'virtual_portfolio'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    portfolio_type = Column(String(20), default='personal')
    is_public = Column(Boolean, default=False, index=True)
    total_value = Column(Numeric(15, 2), default=0)
    total_investments = Column(Integer, default=0)
    performance_metrics = Column(JSONB, default=dict)

    __table_args__ = (
        CheckConstraint("portfolio_type IN ('personal','shared','public')", name='check_portfolio_type'),
    )

    user  = relationship("User", back_populates="virtual_portfolios")
    items = relationship("VirtualPortfolioItem", back_populates="portfolio", cascade="all, delete-orphan")

class VirtualPortfolioItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'virtual_portfolio_item'
    virtual_portfolio_id   = Column(UUID(as_uuid=True), ForeignKey('virtual_portfolio.id', ondelete="CASCADE"), nullable=False, index=True)
    startup_enterprise_id  = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, index=True)
    investment_amount      = Column(Numeric(15, 2), nullable=False)
    valuation_at_entry     = Column(Numeric(15, 2))
    current_valuation      = Column(Numeric(15, 2))
    shares_owned           = Column(Integer)
    ownership_percentage   = Column(Numeric(8, 4))
    entry_date             = Column(Date, nullable=False)
    exit_date              = Column(Date)
    exit_value             = Column(Numeric(15, 2))
    return_multiple        = Column(Numeric(8, 2))
    notes                  = Column(Text)
    performance_metrics    = Column(JSONB, default=dict)
    added_date             = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('virtual_portfolio_id', 'startup_enterprise_id', name='unique_portfolio_startup'),
    )

    portfolio = relationship("VirtualPortfolio", back_populates="items")
    startup   = relationship("Enterprise")

# ---------------------------------------
# 6. MONTE CARLO SIMULATIONS
# ---------------------------------------
class InvestorSimulation(Base, UUIDMixin):
    __tablename__ = 'investor_simulation'
    investor_profile_id   = Column(UUID(as_uuid=True), ForeignKey('investor_profile.id', ondelete="CASCADE"), nullable=False, index=True)
    startup_enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="SET NULL"), index=True)
    parameter_id          = Column(UUID(as_uuid=True), ForeignKey('simulation_parameters.id', ondelete="CASCADE"), nullable=False)
    simulation_name       = Column(String(200))
    input_parameters      = Column(JSONB, nullable=False)
    simulation_config     = Column(JSONB, default=dict)
    results               = Column(JSONB, default=dict)
    expected_return       = Column(Numeric(10, 4))
    risk_score            = Column(Numeric(5, 4))
    confidence_interval   = Column(JSONB, default=dict)
    iterations            = Column(Integer, default=10000)
    status                = Column(String(20), default='pending', index=True)
    run_date              = Column(DateTime(timezone=True), server_default=func.now())
    completion_date       = Column(DateTime(timezone=True))
    created_by            = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="SET NULL"))

    __table_args__ = (
        CheckConstraint("status IN ('pending','running','completed','failed')", name='check_simulation_status'),
        Index('idx_simulation_results', 'results', postgresql_using='gin'),
    )

    investor_profile  = relationship("InvestorProfile", back_populates="simulations")
    startup_enterprise = relationship("Enterprise")
    parameters        = relationship("SimulationParameters", back_populates="investor_simulations")
    creator           = relationship("User")

class StartupSimulation(Base, UUIDMixin):
    __tablename__ = 'startup_simulation'
    startup_profile_id   = Column(UUID(as_uuid=True), ForeignKey('startup_profile.id', ondelete="CASCADE"), nullable=False, index=True)
    parameter_id         = Column(UUID(as_uuid=True), ForeignKey('simulation_parameters.id', ondelete="CASCADE"), nullable=False)
    simulation_name      = Column(String(200))
    input_parameters     = Column(JSONB, nullable=False)
    simulation_config    = Column(JSONB, default=dict)
    growth_projections   = Column(JSONB, default=dict)
    market_scenarios     = Column(JSONB, default=dict)
    financial_projections= Column(JSONB, default=dict)
    success_probability  = Column(Numeric(5, 4))
    valuation_range      = Column(JSONB, default=dict)
    iterations           = Column(Integer, default=10000)
    status               = Column(String(20), default='pending', index=True)
    run_date             = Column(DateTime(timezone=True), server_default=func.now())
    completion_date      = Column(DateTime(timezone=True))
    created_by           = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="SET NULL"))

    __table_args__ = (
        CheckConstraint("status IN ('pending','running','completed','failed')", name='check_startup_simulation_status'),
    )

    startup_profile = relationship("StartupProfile", back_populates="simulations")
    parameters      = relationship("SimulationParameters", back_populates="startup_simulations")
    creator         = relationship("User")

# ---------------------------------------
# 7. GAMIFICATION & ANALYTICS
# ---------------------------------------
class UserAchievement(Base, UUIDMixin):
    __tablename__ = 'user_achievement'
    user_id            = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    achievement_type_id= Column(UUID(as_uuid=True), ForeignKey('achievement_type.id', ondelete="CASCADE"), nullable=False, index=True)
    earned_date        = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    evidence           = Column(JSONB, default=dict)
    points_earned      = Column(Integer, default=0)
    level_achieved     = Column(Integer, default=1)
    is_featured        = Column(Boolean, default=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'achievement_type_id', name='unique_user_achievement'),
    )

    user = relationship("User", back_populates="achievements")
    achievement_type = relationship("AchievementType", back_populates="user_achievements")

class UserActivity(Base, UUIDMixin):
    __tablename__ = 'user_activity'
    user_id          = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    activity_type    = Column(String(50), nullable=False, index=True)
    activity_category= Column(String(50))
    activity_data    = Column(JSONB, default=dict)
    ip_address       = Column(INET)
    user_agent       = Column(Text)
    session_id       = Column(String(100), index=True)
    duration_seconds = Column(Integer)
    activity_date    = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        Index('idx_user_activity_data', 'activity_data', postgresql_using='gin'),
    )

    user = relationship("User", back_populates="activities")

class LeaderboardEntry(Base, UUIDMixin):
    __tablename__ = 'leaderboard_entry'
    leaderboard_id   = Column(UUID(as_uuid=True), ForeignKey('leaderboard.id', ondelete="CASCADE"), nullable=False, index=True)
    user_id          = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    rank             = Column(Integer, nullable=False, index=True)
    score            = Column(Numeric(15, 4), nullable=False)
    metrics          = Column(JSONB, default=dict)
    calculation_period = Column(DATERANGE)
    calculated_at    = Column(DateTime(timezone=True), server_default=func.now())
    is_current       = Column(Boolean, default=True, index=True)

    __table_args__ = (
        UniqueConstraint('leaderboard_id', 'user_id', 'calculated_at', name='unique_leaderboard_entry'),
    )

    leaderboard = relationship("Leaderboard", back_populates="entries")
    user = relationship("User")

class DashboardConfig(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'dashboard_config'
    user_id            = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False)
    dashboard_name     = Column(String(100), nullable=False)
    dashboard_type     = Column(String(50), default='personal')
    layout_config      = Column(JSONB, nullable=False, default=dict)
    widget_settings    = Column(JSONB, default=list)
    is_default         = Column(Boolean, default=False)
    is_shared          = Column(Boolean, default=False)
    sharing_permissions= Column(JSONB, default=dict)
    user = relationship("User", back_populates="dashboard_configs")
    visualizations = relationship("Visualization", back_populates="dashboard_config", cascade="all, delete-orphan")

class Visualization(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'visualization'
    dashboard_config_id = Column(UUID(as_uuid=True), ForeignKey('dashboard_config.id', ondelete="CASCADE"), nullable=False)
    widget_type     = Column(String(50), nullable=False)
    chart_type      = Column(String(50))
    title           = Column(String(200))
    data_source     = Column(JSONB, nullable=False)
    display_settings= Column(JSONB, default=dict)
    filter_settings = Column(JSONB, default=dict)
    position_x      = Column(Integer, default=0)
    position_y      = Column(Integer, default=0)
    width           = Column(Integer, default=4)
    height          = Column(Integer, default=3)
    is_active       = Column(Boolean, default=True)
    dashboard_config= relationship("DashboardConfig", back_populates="visualizations")

# ---------------------------------------
# 8. EVENTS & MEETINGS
# ---------------------------------------
class Meeting(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'meeting'
    enterprise_id   = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), index=True)
    title           = Column(String(200), nullable=False)
    description     = Column(Text)
    meeting_type    = Column(String(50), index=True)
    scheduled_time  = Column(DateTime(timezone=True), nullable=False, index=True)
    duration_minutes= Column(Integer, default=60)
    location        = Column(String(500))
    meeting_url     = Column(String(500))
    agenda          = Column(Text)
    attendees       = Column(JSONB, default=list)
    status          = Column(String(20), default='scheduled', index=True)
    meeting_notes   = Column(Text)
    action_items    = Column(JSONB, default=list)
    follow_up_required = Column(Boolean, default=False)
    recording_url   = Column(String(500))
    created_by      = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="SET NULL"))

    __table_args__ = (
        CheckConstraint("meeting_type IN ('pitch','due_diligence','networking','demo','follow_up','board','investor_update')", name='check_meeting_type'),
        CheckConstraint("status IN ('scheduled','confirmed','in_progress','completed','cancelled','rescheduled')", name='check_meeting_status'),
    )

    enterprise      = relationship("Enterprise", back_populates="meetings")
    created_by_user = relationship("User", back_populates="created_meetings")
    market_recommendations = relationship("MarketRecommendation", back_populates="meeting")

class Event(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'event'
    enterprise_id   = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), index=True)
    venue_type_id   = Column(UUID(as_uuid=True), ForeignKey('venue_type.id', ondelete="SET NULL"))
    title           = Column(String(200), nullable=False)
    description     = Column(Text)
    event_type      = Column(String(50))
    start_time      = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time        = Column(DateTime(timezone=True), nullable=False)
    location        = Column(String(500))
    venue_details   = Column(JSONB, default=dict)
    ticket_price    = Column(Numeric(10, 2), default=0)
    max_attendees   = Column(Integer)
    current_attendees = Column(Integer, default=0)
    registration_deadline = Column(DateTime(timezone=True))
    event_details   = Column(JSONB, default=dict)
    agenda          = Column(JSONB, default=list)
    speakers        = Column(JSONB, default=list)
    sponsors        = Column(JSONB, default=list)
    status          = Column(String(20), default='planned', index=True)
    is_public       = Column(Boolean, default=True, index=True)
    registration_required = Column(Boolean, default=True)
    created_by      = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="SET NULL"))

    __table_args__ = (
        CheckConstraint("event_type IN ('pitch_event','networking','workshop','conference','demo_day','investor_meetup')", name='check_event_type'),
        CheckConstraint("status IN ('planned','open_registration','full','in_progress','completed','cancelled')", name='check_event_status'),
    )

    enterprise     = relationship("Enterprise", back_populates="events")
    venue_type     = relationship("VenueType", back_populates="events")
    created_by_user= relationship("User", back_populates="created_events")

# ---------------------------------------
# 9. DOCUMENTS & MESSAGING
# ---------------------------------------
class Document(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'document'
    enterprise_id   = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), index=True)
    uploaded_by     = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="SET NULL"), nullable=False, index=True)
    title           = Column(String(200), nullable=False)
    document_type   = Column(String(50), index=True)
    file_path       = Column(String(1000), nullable=False)
    file_name       = Column(String(255), nullable=False)
    file_size       = Column(Integer)
    mime_type       = Column(String(100))
    file_hash       = Column(String(64))
    version_number  = Column(Integer, default=1)
    is_public       = Column(Boolean, default=False, index=True)
    access_level    = Column(String(20), default='private', index=True)
    description     = Column(Text)
    tags            = Column(ARRAY(Text))
    doc_metadata    = Column("metadata", JSONB, default=dict)  # avoid Base.metadata clash
    download_count  = Column(Integer, default=0)
    last_accessed_at= Column(DateTime(timezone=True))
    expires_at      = Column(DateTime(timezone=True))
    uploaded_at     = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        CheckConstraint("document_type IN ('pitch_deck','financial_model','business_plan','legal_doc','due_diligence','term_sheet','contract','report','other')", name='check_document_type'),
        CheckConstraint("access_level IN ('public','enterprise','private','confidential')", name='check_access_level'),
        Index('idx_document_metadata', 'metadata', postgresql_using='gin'),
        Index('idx_document_tags', 'tags', postgresql_using='gin'),
        UniqueConstraint('enterprise_id', 'file_name', 'version_number', name='uq_doc_version'),
    )

    enterprise       = relationship("Enterprise", back_populates="documents")
    uploaded_by_user = relationship("User", back_populates="uploaded_documents")

class Messaging(Base, UUIDMixin):
    __tablename__ = 'messaging'
    sender_user_id   = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    recipient_user_id= Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    thread_id        = Column(UUID(as_uuid=True), index=True)
    parent_message_id= Column(UUID(as_uuid=True), ForeignKey('messaging.id', ondelete="SET NULL"))
    subject          = Column(String(200))
    content          = Column(Text, nullable=False)
    message_type     = Column(String(20), default='direct')
    priority         = Column(String(10), default='normal')
    is_read          = Column(Boolean, default=False, index=True)
    is_archived      = Column(Boolean, default=False)
    is_deleted       = Column(Boolean, default=False)
    attachments      = Column(JSONB, default=list)
    sent_at          = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    read_at          = Column(DateTime(timezone=True))
    replied_at       = Column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("message_type IN ('direct','system','notification','announcement')", name='check_message_type'),
        CheckConstraint("priority IN ('low','normal','high','urgent')", name='check_priority'),
        Index('idx_messaging_thread', 'thread_id', 'sent_at'),
    )

    sender         = relationship("User", foreign_keys=[sender_user_id], back_populates="sent_messages")
    recipient      = relationship("User", foreign_keys=[recipient_user_id], back_populates="received_messages")
    parent_message = relationship("Messaging", remote_side=lambda: [Messaging.id])

# ---------------------------------------
# 10. SUBSCRIPTIONS / STRIPE
# ---------------------------------------
class Subscription(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'subscription'
    user_id     = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    user_plan_id= Column(UUID(as_uuid=True), ForeignKey('user_plan.id', ondelete="SET NULL"), nullable=False, index=True)

    status           = Column(String(30), default=SubscriptionStatus.ACTIVE.value, index=True)
    stripe_status_raw= Column(String(50), index=True)

    start_date           = Column(DateTime(timezone=True), nullable=False)
    end_date             = Column(DateTime(timezone=True))
    trial_end_date       = Column(DateTime(timezone=True))
    current_period_start = Column(DateTime(timezone=True))
    current_period_end   = Column(DateTime(timezone=True))
    billing_cycle_anchor = Column(DateTime(timezone=True))
    next_billing_date    = Column(DateTime(timezone=True))

    amount            = Column(Numeric(10, 2), nullable=False)
    currency          = Column(String(3), default='USD')
    payment_frequency = Column(String(20))  # 'monthly' | 'quarterly' | 'annually'

    stripe_subscription_id   = Column(String(100), index=True)
    stripe_customer_id       = Column(String(100), index=True)
    stripe_price_id          = Column(String(100))
    stripe_product_id        = Column(String(100))
    default_payment_method_id= Column(String(100))
    collection_method        = Column(String(20))  # 'charge_automatically' | 'send_invoice'
    cancel_at_period_end     = Column(Boolean, default=False)

    auto_renew         = Column(Boolean, default=True)
    cancellation_reason= Column(Text)
    cancelled_at       = Column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("status IN ('active','trialing','canceled','incomplete','incomplete_expired','past_due','unpaid','paused')",
                        name='check_subscription_status'),
        CheckConstraint("payment_frequency IS NULL OR payment_frequency IN ('monthly','quarterly','annually')",
                        name='check_payment_frequency'),
        CheckConstraint("amount >= 0", name='check_subscription_amount_nonneg'),
    )

    user = relationship("User", back_populates="subscriptions")
    user_plan = relationship("UserPlan", back_populates="subscriptions")

class StripeEvent(Base, UUIDMixin, TimestampMixin):
    """Idempotent Stripe webhook log."""
    __tablename__ = 'stripe_event'
    stripe_event_id = Column(String(255), nullable=False, unique=True, index=True)
    type           = Column(String(100), index=True)
    payload        = Column(JSONB, nullable=False)
    received_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    processed_at   = Column(DateTime(timezone=True))
    status         = Column(String(20), default='received')  # received|processed|error
    error          = Column(Text)

class Referral(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'referral'
    referrer_user_id       = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False)
    referred_enterprise_id = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="SET NULL"))
    referred_user_id       = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="SET NULL"))
    referral_type          = Column(String(50), nullable=False)
    referral_code          = Column(String(20), unique=True)
    status                 = Column(String(20), default='pending')
    reward_type            = Column(String(50))
    reward_value           = Column(Numeric(10, 2))
    reward_claimed         = Column(Boolean, default=False)
    notes                  = Column(Text)
    expires_at             = Column(DateTime(timezone=True))
    processed_at           = Column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("referral_type IN ('user','enterprise','investor','startup')", name='check_referral_type'),
        CheckConstraint("status IN ('pending','accepted','completed','rejected','expired')", name='check_referral_status'),
    )

    referrer            = relationship("User", foreign_keys=[referrer_user_id])
    referred_enterprise = relationship("Enterprise")
    referred_user       = relationship("User", foreign_keys=[referred_user_id])

class SecuredAccess(Base, UUIDMixin):
    __tablename__ = 'secured_access'
    user_id       = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False)
    resource_id   = Column(UUID(as_uuid=True), nullable=False)
    access_level  = Column(String(20), nullable=False)
    permissions   = Column(JSONB, default=dict)
    granted_by    = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="SET NULL"))
    granted_date  = Column(DateTime(timezone=True), server_default=func.now())
    expires_date  = Column(DateTime(timezone=True))
    is_active     = Column(Boolean, default=True)
    conditions    = Column(JSONB, default=dict)

    __table_args__ = (
        UniqueConstraint('user_id', 'resource_type', 'resource_id', name='unique_user_resource_access'),
        CheckConstraint("access_level IN ('read','write','admin','owner')", name='check_access_level'),
    )

    user   = relationship("User", foreign_keys=[user_id])
    grantor= relationship("User", foreign_keys=[granted_by])

# ---------------------------------------
# 11. MARKET RECOMMENDATIONS
# ---------------------------------------
class MarketRecommendation(Base, UUIDMixin):
    __tablename__ = 'market_recommendation'
    enterprise_id       = Column(UUID(as_uuid=True), ForeignKey('enterprise.id', ondelete="CASCADE"), nullable=False, index=True)
    meeting_id          = Column(UUID(as_uuid=True), ForeignKey('meeting.id', ondelete="SET NULL"))
    recommendation_type = Column(String(50), nullable=False, index=True)
    title               = Column(String(200), nullable=False)
    description         = Column(Text)
    recommendation_data = Column(JSONB, nullable=False)
    confidence_score    = Column(Numeric(5, 4))
    priority_level      = Column(String(10), default='medium')
    source_type         = Column(String(50))
    source_data         = Column(JSONB, default=dict)
    status              = Column(String(20), default='active', index=True)
    generated_at        = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    expires_at          = Column(DateTime(timezone=True))
    viewed_at           = Column(DateTime(timezone=True))
    acted_upon_at       = Column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("recommendation_type IN ('investment_opportunity','market_trend','competitor_analysis','funding_strategy','partnership')", name='check_recommendation_type'),
        CheckConstraint("priority_level IN ('low','medium','high','urgent')", name='check_priority_level'),
        CheckConstraint("status IN ('active','viewed','acted_upon','dismissed','expired')", name='check_recommendation_status'),
        CheckConstraint('confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)', name='check_confidence_score'),
        Index('idx_market_recommendation_data', 'recommendation_data', postgresql_using='gin'),
    )

    enterprise = relationship("Enterprise", back_populates="market_recommendations")
    meeting    = relationship("Meeting", back_populates="market_recommendations")
    interactions = relationship("MarketInteraction", back_populates="recommendation", cascade="all, delete-orphan")

class MarketInteraction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'market_interaction'
    recommendation_id = Column(UUID(as_uuid=True), ForeignKey('market_recommendation.id', ondelete="CASCADE"), nullable=False, index=True)
    user_id           = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    interaction_type  = Column(String(50), nullable=False)
    interaction_data  = Column(JSONB, default=dict)
    feedback_rating   = Column(Integer)
    feedback_text     = Column(Text)

    __table_args__ = (
        CheckConstraint("interaction_type IN ('view','like','share','save','comment','follow_up','dismiss')", name='check_market_interaction_type'),
        CheckConstraint('feedback_rating IS NULL OR (feedback_rating >= 1 AND feedback_rating <= 5)', name='check_feedback_rating'),
    )

    recommendation = relationship("MarketRecommendation", back_populates="interactions")
    user           = relationship("User")

# ---------------------------------------
# 12. UTILITY
# ---------------------------------------
class AIFieldVenue(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'ai_field_venue'
    name        = Column(String(200), nullable=False)
    address     = Column(Text)
    coordinates = Column(JSONB)  # {lat: number, lng: number}
    capacity    = Column(Integer)
    amenities   = Column(JSONB)
    hourly_rate = Column(Numeric(10, 2))
    is_available= Column(Boolean, default=True)
    contact_info= Column(JSONB, default=dict)

# =====================================================
# VERIFICATION CORE MODELS
# =====================================================

class VerificationLevel(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "verification_levels"

    name = Column(String(50), nullable=False)
    user_type = Column(String(20), nullable=False)  # investor|startup
    price_usd = Column(Numeric(10, 2), nullable=False, default=0)
    features = Column(JSONB, nullable=False, default=dict)
    processing_time_days = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        CheckConstraint("user_type IN ('investor','startup')", name="check_vlevel_user_type"),
    )

    verifications = relationship("Verification", back_populates="verification_level")


class Verification(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "verifications"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    verification_level_id = Column(UUID(as_uuid=True), ForeignKey("verification_levels.id"), nullable=False, index=True)
    user_type = Column(String(20), nullable=False)  # investor|startup
    status = Column(String(30), nullable=False, default="pending", index=True)
    risk_score = Column(Integer)
    risk_factors = Column(JSONB, default=list)
    verification_data = Column(JSONB, default=dict)
    third_party_results = Column(JSONB, default=dict)
    rejection_reason = Column(Text)
    expires_at = Column(DateTime(timezone=True))
    initiated_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("user_type IN ('investor','startup')", name="check_ver_user_type"),
        CheckConstraint("status IN ('pending','in_progress','under_review','approved','rejected','expired')", name="check_ver_status"),
        CheckConstraint("risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100)", name="check_ver_risk_score"),
        Index("idx_verifications_user_level", "user_id", "verification_level_id"),
    )

    verification_level = relationship("VerificationLevel", back_populates="verifications")
    documents = relationship("VerificationDocument", back_populates="verification", cascade="all, delete-orphan")
    assignments = relationship("VerificationAssignment", back_populates="verification", cascade="all, delete-orphan")
    steps = relationship("VerificationStep", back_populates="verification", cascade="all, delete-orphan")
    audit_logs = relationship("VerificationAuditLog", back_populates="verification", cascade="all, delete-orphan")
    notifications = relationship("VerificationNotification", back_populates="verification", cascade="all, delete-orphan")
    external_calls = relationship("ExternalServiceCall", back_populates="verification", cascade="all, delete-orphan")

    user = relationship("User")  # lightweight; no back_populates to avoid import loops


class DocumentType(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "document_types"

    name = Column(String(100), nullable=False)
    user_type = Column(String(20), nullable=False)  # investor|startup
    verification_level = Column(String(50), nullable=False)
    is_required = Column(Boolean, nullable=False, default=True)
    accepted_formats = Column(ARRAY(String), default=["pdf", "jpg", "jpeg", "png"])
    max_file_size_mb = Column(Integer, default=50)
    description = Column(Text)
    validation_rules = Column(JSONB, default=dict)

    __table_args__ = (
        CheckConstraint("user_type IN ('investor','startup')", name="check_doc_user_type"),
    )

    documents = relationship("VerificationDocument", back_populates="document_type")


class VerificationDocument(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "verification_documents"

    verification_id = Column(UUID(as_uuid=True), ForeignKey("verifications.id", ondelete="CASCADE"), nullable=False, index=True)
    document_type_id = Column(UUID(as_uuid=True), ForeignKey("document_types.id"), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    status = Column(String(30), nullable=False, default="pending", index=True)
    ocr_text = Column(Text)
    extracted_data = Column(JSONB, default=dict)
    validation_results = Column(JSONB, default=dict)
    rejection_reason = Column(Text)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    processed_at = Column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("status IN ('pending','processing','approved','rejected')", name="check_document_status"),
    )

    verification = relationship("Verification", back_populates="documents")
    document_type = relationship("DocumentType", back_populates="documents")

# =====================================================
# THIRD-PARTY PROVIDER MARKETPLACE MODELS
# =====================================================

class ProviderCategory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "provider_categories"

    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    icon = Column(String(50))
    is_active = Column(Boolean, nullable=False, default=True)

    providers = relationship("ServiceProvider", back_populates="category")


class ServiceProvider(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "service_providers"

    company_name = Column(String(200), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("provider_categories.id"), nullable=False, index=True)
    contact_email = Column(String(255), nullable=False)
    contact_phone = Column(String(50))
    website_url = Column(String(500))
    address = Column(JSONB, default=dict)
    geographic_coverage = Column(ARRAY(String), default=["global"])
    languages_supported = Column(ARRAY(String), default=["en"])
    certifications = Column(JSONB, default=list)
    pricing_model = Column(String(50), default="per_verification")
    base_price_usd = Column(Numeric(10, 2))
    rating = Column(Numeric(3, 2))
    total_reviews = Column(Integer, default=0)
    verification_count = Column(Integer, default=0)
    average_turnaround_hours = Column(Integer)
    is_verified = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    api_endpoint = Column(String(500))
    api_key_hash = Column(String(255))
    webhook_url = Column(String(500))
    onboarding_completed_at = Column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("rating IS NULL OR (rating >= 0 AND rating <= 5)", name="check_provider_rating"),
    )

    category = relationship("ProviderCategory", back_populates="providers")
    services = relationship("ProviderService", back_populates="provider", cascade="all, delete-orphan")
    assignments = relationship("VerificationAssignment", back_populates="provider")
    reviews = relationship("ProviderReview", back_populates="provider")


class ProviderService(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "provider_services"

    provider_id = Column(UUID(as_uuid=True), ForeignKey("service_providers.id", ondelete="CASCADE"), nullable=False, index=True)
    service_name = Column(String(200), nullable=False)
    service_type = Column(String(100), nullable=False)
    description = Column(Text)
    price_usd = Column(Numeric(10, 2))
    turnaround_hours = Column(Integer)
    requirements = Column(JSONB, default=dict)
    deliverables = Column(JSONB, default=dict)
    is_active = Column(Boolean, nullable=False, default=True)

    provider = relationship("ServiceProvider", back_populates="services")
    assignments = relationship("VerificationAssignment", back_populates="service")


class VerificationAssignment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "verification_assignments"

    verification_id = Column(UUID(as_uuid=True), ForeignKey("verifications.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=False, index=True)
    service_id = Column(UUID(as_uuid=True), ForeignKey("provider_services.id"), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="assigned", index=True)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    results = Column(JSONB, default=dict)
    provider_notes = Column(Text)
    cost_usd = Column(Numeric(10, 2))

    __table_args__ = (
        CheckConstraint("status IN ('assigned','in_progress','completed','failed','cancelled')", name="check_assignment_status"),
    )

    verification = relationship("Verification", back_populates="assignments")
    provider = relationship("ServiceProvider", back_populates="assignments")
    service = relationship("ProviderService", back_populates="assignments")


class ProviderReview(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "provider_reviews"

    verification_id = Column(UUID(as_uuid=True), ForeignKey("verifications.id"), nullable=False, index=True)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    review_text = Column(Text)
    response_time_rating = Column(Integer)
    quality_rating = Column(Integer)
    communication_rating = Column(Integer)
    is_verified_review = Column(Boolean, nullable=False, default=False)

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="check_review_rating"),
        CheckConstraint("response_time_rating IS NULL OR (response_time_rating >= 1 AND response_time_rating <= 5)", name="check_resp_time_rating"),
        CheckConstraint("quality_rating IS NULL OR (quality_rating >= 1 AND quality_rating <= 5)", name="check_quality_rating"),
        CheckConstraint("communication_rating IS NULL OR (communication_rating >= 1 AND communication_rating <= 5)", name="check_comm_rating"),
    )

    provider = relationship("ServiceProvider", back_populates="reviews")
    user = relationship("User")

# =====================================================
# THIRD-PARTY API INTEGRATION MODELS
# =====================================================

class ExternalService(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "external_services"

    service_name = Column(String(100), nullable=False, unique=True)
    service_type = Column(String(50), nullable=False)
    api_endpoint = Column(String(500), nullable=False)
    api_version = Column(String(20))
    supported_countries = Column(ARRAY(String), default=["global"])
    supported_document_types = Column(ARRAY(String), default=[])
    pricing_per_check = Column(Numeric(10, 2))
    average_response_time_seconds = Column(Integer)
    success_rate = Column(Numeric(5, 2))
    is_active = Column(Boolean, nullable=False, default=True)
    configuration = Column(JSONB, default=dict)

    service_calls = relationship("ExternalServiceCall", back_populates="service")


class ExternalServiceCall(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "external_service_calls"

    verification_id = Column(UUID(as_uuid=True), ForeignKey("verifications.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id = Column(UUID(as_uuid=True), ForeignKey("external_services.id"), nullable=False, index=True)
    call_type = Column(String(100), nullable=False)
    request_data = Column(JSONB, default=dict)
    response_data = Column(JSONB, default=dict)
    status = Column(String(30), nullable=False)
    response_time_ms = Column(Integer)
    cost_usd = Column(Numeric(10, 2))
    error_message = Column(Text)

    __table_args__ = (
        CheckConstraint("status IN ('pending','success','failed','timeout')", name="check_call_status"),
    )

    verification = relationship("Verification", back_populates="external_calls")
    service = relationship("ExternalService", back_populates="service_calls")

# =====================================================
# WORKFLOW AND AUTOMATION MODELS
# =====================================================

class VerificationStep(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "verification_steps"

    verification_id = Column(UUID(as_uuid=True), ForeignKey("verifications.id", ondelete="CASCADE"), nullable=False, index=True)
    step_name = Column(String(100), nullable=False)
    step_order = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False, default="pending")
    assigned_to = Column(String(100))  # 'system', 'provider_id', 'manual_review'
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    results = Column(JSONB, default=dict)
    error_message = Column(Text)

    __table_args__ = (
        CheckConstraint("status IN ('pending','in_progress','completed','failed','skipped')", name="check_step_status"),
    )

    verification = relationship("Verification", back_populates="steps")


class VerificationRule(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "verification_rules"

    name = Column(String(200), nullable=False)
    user_type = Column(String(20), nullable=False)
    verification_level = Column(String(50), nullable=False)
    trigger_conditions = Column(JSONB, nullable=False, default=dict)
    actions = Column(JSONB, nullable=False, default=dict)
    priority = Column(Integer, nullable=False, default=100)
    is_active = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        CheckConstraint("user_type IN ('investor','startup')", name="check_rule_user_type"),
    )

# =====================================================
# COMPLIANCE AND AUDIT MODELS
# =====================================================

class VerificationAuditLog(Base, UUIDMixin):
    __tablename__ = "verification_audit_log"

    verification_id = Column(UUID(as_uuid=True), ForeignKey("verifications.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(100), nullable=False)
    actor_type = Column(String(50), nullable=False)  # 'user','system','provider','admin'
    actor_id = Column(String(255))
    old_values = Column(JSONB, default=dict)
    new_values = Column(JSONB, default=dict)
    ip_address = Column(INET)
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    verification = relationship("Verification", back_populates="audit_logs")

# (Optional) rolling/periodic summaries
class ComplianceReport(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "compliance_reports"

    report_type = Column(String(100), nullable=False)
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    generated_by = Column(UUID(as_uuid=True))  # users.id (not FK to keep simple)
    report_data = Column(JSONB, nullable=False, default=dict)
    file_path = Column(String(500))
    status = Column(String(30), nullable=False, default="pending")

# =====================================================
# NOTIFICATIONS
# =====================================================

class VerificationNotification(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "verification_notifications"

    verification_id = Column(UUID(as_uuid=True), ForeignKey("verifications.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    notification_type = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    channels = Column(ARRAY(String), default=["email"])  # email,sms,push,in_app
    sent_at = Column(DateTime(timezone=True))
    read_at = Column(DateTime(timezone=True))
    notif_metadata = Column("metadata", JSONB, default=dict)

    verification = relationship("Verification", back_populates="notifications")
    recipient = relationship("User")

# =====================================================
# SIDE EFFECT: When a verification is approved, mark the owner enterprise verified
# =====================================================
@event.listens_for(Verification, "after_update")
def _sync_enterprise_verified(mapper, connection, target):
    if target.status != "approved":
        return
    ent_tbl = Enterprise.__table__
    eu_tbl = EnterpriseUser.__table__
    subq = (
        sa.select(eu_tbl.c.enterprise_id)
        .select_from(eu_tbl.join(ent_tbl, eu_tbl.c.enterprise_id == ent_tbl.c.id))
        .where(
            eu_tbl.c.user_id == target.user_id,
            eu_tbl.c.role == sa.literal("owner"),
            eu_tbl.c.is_active.is_(True),
            ent_tbl.c.enterprise_type.in_([target.user_type, "both"]),
        )
        .limit(1)
    )
    row = connection.execute(subq).first()
    if row:
        connection.execute(
            ent_tbl.update()
            .where(ent_tbl.c.id == row.enterprise_id)
            .values(is_verified=True, verification_date=func.now())
        )

from sqlalchemy import event  # here is fine too

@event.listens_for(FundingRound, "after_insert")
@event.listens_for(FundingRound, "after_update")
def _sync_startup_profile_from_round(mapper, connection, target):
    sp_tbl = StartupProfile.__table__
    new_val = target.post_money_valuation or target.pre_money_valuation

    inv = []
    if target.lead_investor:
        inv.append(target.lead_investor)
    if isinstance(target.investors, list):
        inv.extend([x for x in target.investors if isinstance(x, str) and x])

    seen, dedup = set(), []
    for name in inv:
        key = name.strip().lower()
        if key not in seen:
            seen.add(key)
            dedup.append(name.strip())

    connection.execute(
        sp_tbl.update()
        .where(sp_tbl.c.id == target.startup_profile_id)
        .values(current_valuation_usd=new_val, current_investors=dedup)
    )