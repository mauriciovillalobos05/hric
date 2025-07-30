# import and setup unchanged
import uuid
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

db = SQLAlchemy()

# -------------------- User & Onboarding --------------------
class Users(db.Model):
    __tablename__ = 'user'
    id = db.Column(UUID(as_uuid=True), primary_key=True)  # Supabase Auth ID
    email = db.Column(db.String(120), nullable=False, unique=True)
    phone = db.Column(db.String(20))
    role = db.Column(db.String(20), nullable=False)  # 'investor' or 'entrepreneur'
    first_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50))
    location = db.Column(db.String(100))
    bio = db.Column(db.Text)
    profile_image = db.Column(db.String(255))
    linkedin_url = db.Column(db.String(255))
    website_url = db.Column(db.String(255))
    onboarding_status = db.Column(db.String(20), default='incomplete')  # 'incomplete', 'pending_review', 'complete'
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    investor_profile = db.relationship('InvestorProfile', backref='user', uselist=False, cascade='all, delete-orphan')
    enterprises = db.relationship('Enterprise', backref='owner', cascade='all, delete-orphan')
    subscriptions = db.relationship('Subscription', backref='user', cascade='all, delete-orphan')
    documents = db.relationship('Document', backref='owner', cascade='all, delete-orphan')
    likes = db.relationship('Like', back_populates='user', cascade='all, delete-orphan')
    messages_sent = db.relationship('Message', foreign_keys='Message.sender_id', backref='sender')
    messages_received = db.relationship('Message', foreign_keys='Message.recipient_id', backref='recipient')
    meetings = db.relationship('Meeting', backref='user', cascade='all, delete-orphan')
    notifications = db.relationship('Notification', backref='user', cascade='all, delete-orphan')
    audit_logs = db.relationship('AuditLog', backref='user', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': str(self.id),
            'email': self.email,
            'phone': self.phone,
            'role': self.role,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'location': self.location,
            'bio': self.bio,
            'profile_image': self.profile_image,
            'linkedin_url': self.linkedin_url,
            'website_url': self.website_url,
            'onboarding_status': self.onboarding_status,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def to_summary(self):
        return {
            'id': str(self.id),
            'first_name': self.first_name,
            'last_name': self.last_name,
            'profile_image': self.profile_image
        }

# -------------------- Investor Profile --------------------
class InvestorProfile(db.Model):
    __tablename__ = 'investor_profile'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'), unique=True, nullable=False)

    industries = db.Column(ARRAY(db.String))
    investment_stages = db.Column(ARRAY(db.String))
    geographic_focus = db.Column(ARRAY(db.String))
    investment_range_min = db.Column(db.Integer)
    investment_range_max = db.Column(db.Integer)
    accredited_status = db.Column(db.Boolean, default=False)
    investor_type = db.Column(db.String(50))
    risk_tolerance = db.Column(db.String(20))
    portfolio_size = db.Column(db.Integer)
    advisory_availability = db.Column(db.Boolean, default=False)
    communication_frequency = db.Column(db.String(20))
    meeting_preference = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'industries': self.industries,
            'investment_stages': self.investment_stages,
            'geographic_focus': self.geographic_focus,
            'investment_range_min': self.investment_range_min,
            'investment_range_max': self.investment_range_max,
            'accredited_status': self.accredited_status,
            'investor_type': self.investor_type,
            'risk_tolerance': self.risk_tolerance,
            'portfolio_size': self.portfolio_size,
            'advisory_availability': self.advisory_availability,
            'communication_frequency': self.communication_frequency,
            'meeting_preference': self.meeting_preference,
            'created_at': self.created_at.isoformat()
        }

# -------------------- Enterprise --------------------
class Enterprise(db.Model):
    __tablename__ = 'enterprise'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'), nullable=False)

    name = db.Column(db.String(100), nullable=False)
    industry = db.Column(db.String(50))
    stage = db.Column(db.String(20))
    business_model = db.Column(db.String(50))
    team_size = db.Column(db.Integer)
    pitch_deck_url = db.Column(db.String(255))
    demo_url = db.Column(db.String(255))
    location = db.Column(db.String(100)) 
    funding_needed = db.Column(db.Numeric(precision=12, scale=2))  

    is_actively_fundraising = db.Column(db.Boolean, default=True)
    financials = db.Column(JSONB)
    target_market = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    subscriptions = db.relationship('Subscription', backref='enterprise', cascade='all, delete-orphan')
    likes = db.relationship('Like', back_populates='enterprise', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'industry': self.industry,
            'stage': self.stage,
            'business_model': self.business_model,
            'team_size': self.team_size,
            'pitch_deck_url': self.pitch_deck_url,
            'demo_url': self.demo_url,
            'location': self.location,  
            'funding_needed': float(self.funding_needed) if self.funding_needed else None,
            'is_actively_fundraising': self.is_actively_fundraising,
            'financials': self.financials,
            'target_market': self.target_market,
            'created_at': self.created_at.isoformat()
        }

# -------------------- Subscription --------------------
class TierPlan(db.Model):
    __tablename__ = 'tier_plan'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    features = db.Column(ARRAY(db.String))
    price = db.Column(db.Numeric)
    stripe_plan_id = db.Column(db.String(120), unique=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'features': self.features,
            'price': float(self.price) if self.price else 0,
            'stripe_plan_id': self.stripe_plan_id
        }


class Subscription(db.Model):
    __tablename__ = 'subscription'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'), nullable=False)
    enterprise_id = db.Column(db.Integer, db.ForeignKey('enterprise.id'), nullable=True)
    tier = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default='active')
    stripe_customer_id = db.Column(db.String(120))
    stripe_subscription_id = db.Column(db.String(120))
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime)

    def to_dict(self):
        return {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'enterprise_id': self.enterprise_id,
            'tier': self.tier,
            'status': self.status,
            'stripe_customer_id': self.stripe_customer_id,
            'stripe_subscription_id': self.stripe_subscription_id,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None
        }

# -------------------- Likes & Matching --------------------
class Like(db.Model):
    __tablename__ = 'like'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'), nullable=False)
    enterprise_id = db.Column(db.Integer, db.ForeignKey('enterprise.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('Users', back_populates='likes')
    enterprise = db.relationship('Enterprise', back_populates='likes')

    __table_args__ = (db.UniqueConstraint('user_id', 'enterprise_id', name='unique_like'),)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': str(self.user_id),
            'enterprise_id': self.enterprise_id,
            'created_at': self.created_at.isoformat(),
            'user': self.user.to_summary() if self.user else None,
            'enterprise': self.enterprise.to_dict() if self.enterprise else None
        }


class MatchRecommendation(db.Model):
    __tablename__ = 'match_recommendation'
    id = db.Column(db.Integer, primary_key=True)
    
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'), nullable=False)  # investor
    enterprise_id = db.Column(db.Integer, db.ForeignKey('enterprise.id'), nullable=False)
    
    score = db.Column(db.Float, nullable=False)
    reasons = db.Column(ARRAY(db.String))  # List of reasons (e.g. ["Industry match", ...])
    
    status = db.Column(db.String(20), default='pending')  # 'pending', 'accepted', 'declined'
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('Users', backref='match_recommendations')
    enterprise = db.relationship('Enterprise', backref='match_recommendations')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': str(self.user_id),
            'enterprise_id': self.enterprise_id,
            'score': self.score,
            'reasons': self.reasons,
            'status': self.status,
            'generated_at': self.generated_at.isoformat()
        }


class InteractionHistory(db.Model):
    __tablename__ = 'interaction_history'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'), nullable=False)
    enterprise_id = db.Column(db.Integer, db.ForeignKey('enterprise.id'), nullable=False)
    interaction_type = db.Column(db.String(50))  # 'view', 'message', 'like'
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# -------------------- Events --------------------
class Event(db.Model):
    __tablename__ = 'event'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    date = db.Column(db.DateTime, nullable=False)
    description = db.Column(db.Text)
    agenda = db.Column(JSONB)
    presenters = db.Column(JSONB)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    registrations = db.relationship('EventRegistration', backref='event', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'date': self.date.isoformat() if self.date else None,
            'description': self.description,
            'agenda': self.agenda,
            'presenters': self.presenters,
            'created_at': self.created_at.isoformat()
        }


class EventRegistration(db.Model):
    __tablename__ = 'event_registration'
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('event.id'), nullable=False)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'), nullable=False)
    answers = db.Column(JSONB)
    registration_status = db.Column(db.String(20))
    registration_date = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'user_id': str(self.user_id),
            'answers': self.answers,
            'registration_status': self.registration_status,
            'registration_date': self.registration_date.isoformat() if self.registration_date else None
        }

class EventPayment(db.Model):
    __tablename__ = 'event_payment'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'))
    event_id = db.Column(db.Integer, db.ForeignKey('event.id'))
    stripe_payment_id = db.Column(db.String(255))
    amount = db.Column(db.Numeric)
    paid_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': str(self.user_id),
            'event_id': self.event_id,
            'stripe_payment_id': self.stripe_payment_id,
            'amount': float(self.amount) if self.amount else 0,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None
        }


# -------------------- Document Access --------------------
class Document(db.Model):
    __tablename__ = 'document'
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'))
    file_path = db.Column(db.String(255), nullable=False)
    filename = db.Column(db.String(255))
    tags = db.Column(ARRAY(db.String))
    access_level = db.Column(db.String(20), default='private')  # 'private', 'tiered', 'public'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    access_grants = db.relationship('DocumentAccess', backref='document', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'owner_id': str(self.owner_id),
            'file_path': self.file_path,
            'filename': self.filename,
            'tags': self.tags,
            'access_level': self.access_level,
            'created_at': self.created_at.isoformat()
        }


class DocumentAccess(db.Model):
    __tablename__ = 'document_access'
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('document.id'))
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'))
    access_type = db.Column(db.String(20), default='view')
    granted_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'document_id': self.document_id,
            'user_id': str(self.user_id),
            'access_type': self.access_type,
            'granted_at': self.granted_at.isoformat()
        }


# -------------------- Messaging & Meetings --------------------
class Message(db.Model):
    __tablename__ = 'message'
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'))
    recipient_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'))
    content = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.String(20), default='direct')
    thread_id = db.Column(db.String(100))
    attachments = db.Column(ARRAY(db.String))
    is_read = db.Column(db.Boolean, default=False)
    read_at = db.Column(db.DateTime)
    is_archived = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'sender_id': str(self.sender_id),
            'recipient_id': str(self.recipient_id),
            'content': self.content,
            'thread_id': self.thread_id,
            'attachments': self.attachments,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat()
        }


class Meeting(db.Model):
    __tablename__ = 'meeting'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'))
    meeting_url = db.Column(db.String(255))
    scheduled_at = db.Column(db.DateTime)
    meeting_metadata = db.Column(JSONB)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': str(self.user_id),
            'meeting_url': self.meeting_url,
            'scheduled_at': self.scheduled_at.isoformat() if self.scheduled_at else None,
            'metadata': self.metadata
        }

# -------------------- System --------------------
class Notification(db.Model):
    __tablename__ = 'notification'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'))
    message = db.Column(db.String(255))
    read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AuditLog(db.Model):
    __tablename__ = 'audit_log'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('user.id'))
    action = db.Column(db.String(100))
    details = db.Column(JSONB)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
