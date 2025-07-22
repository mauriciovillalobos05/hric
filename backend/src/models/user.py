from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import json

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    user_type = db.Column(db.String(20), nullable=False)  # 'investor' or 'entrepreneur'
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    phone = db.Column(db.String(20))
    location = db.Column(db.String(100))
    profile_image = db.Column(db.String(255))
    bio = db.Column(db.Text)
    linkedin_url = db.Column(db.String(255))
    website_url = db.Column(db.String(255))
    is_verified = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    subscription_tier = db.Column(db.String(20), default='free')  # free, basic, premium, vip, enterprise
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime)

    # Relationships
    investor_profile = db.relationship('InvestorProfile', backref='user', uselist=False, cascade='all, delete-orphan')
    entrepreneur_profile = db.relationship('EntrepreneurProfile', backref='user', uselist=False, cascade='all, delete-orphan')
    sent_messages = db.relationship('Message', foreign_keys='Message.sender_id', backref='sender', cascade='all, delete-orphan')
    received_messages = db.relationship('Message', foreign_keys='Message.recipient_id', backref='recipient', cascade='all, delete-orphan')
    documents = db.relationship('Document', backref='owner', cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.email}>'

    def to_dict(self, include_sensitive=False):
        data = {
            'id': self.id,
            'email': self.email,
            'user_type': self.user_type,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'phone': self.phone,
            'location': self.location,
            'profile_image': self.profile_image,
            'bio': self.bio,
            'linkedin_url': self.linkedin_url,
            'website_url': self.website_url,
            'is_verified': self.is_verified,
            'is_active': self.is_active,
            'subscription_tier': self.subscription_tier,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }
        
        if include_sensitive:
            data['password_hash'] = self.password_hash
            
        return data
    
    def to_summary(self):
        return {
            'id': self.id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'user_type': self.user_type,
            'profile_image': self.profile_image
        }

class InvestorProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # New: Optional headline for display
    headline = db.Column(db.String(150))

    # Investment preferences
    investment_stages = db.Column(db.Text)  # JSON array
    industries = db.Column(db.Text)         # JSON array
    geographic_focus = db.Column(db.Text)   # JSON array
    investment_range_min = db.Column(db.Integer)
    investment_range_max = db.Column(db.Integer)
    risk_tolerance = db.Column(db.String(20))

    # Investor details
    investor_type = db.Column(db.String(50))
    accredited_status = db.Column(db.Boolean, default=False)
    net_worth = db.Column(db.Integer)
    annual_income = db.Column(db.Integer)
    investment_experience = db.Column(db.String(20))
    portfolio_size = db.Column(db.Integer)

    # Advisory capabilities
    expertise_areas = db.Column(db.Text)  # JSON array
    advisory_availability = db.Column(db.Boolean, default=False)
    board_experience = db.Column(db.Boolean, default=False)

    # Preferences
    communication_frequency = db.Column(db.String(20), default='monthly')
    meeting_preference = db.Column(db.String(20), default='virtual')

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # JSON helpers
    def get_investment_stages(self):
        return json.loads(self.investment_stages) if self.investment_stages else []

    def set_investment_stages(self, stages):
        self.investment_stages = json.dumps(stages)

    def get_industries(self):
        return json.loads(self.industries) if self.industries else []

    def set_industries(self, industries):
        self.industries = json.dumps(industries)

    def get_geographic_focus(self):
        return json.loads(self.geographic_focus) if self.geographic_focus else []

    def set_geographic_focus(self, locations):
        self.geographic_focus = json.dumps(locations)

    def get_expertise_areas(self):
        return json.loads(self.expertise_areas) if self.expertise_areas else []

    def set_expertise_areas(self, areas):
        self.expertise_areas = json.dumps(areas)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'headline': self.headline,
            'investment_stages': self.get_investment_stages(),
            'industries': self.get_industries(),
            'geographic_focus': self.get_geographic_focus(),
            'investment_range_min': self.investment_range_min,
            'investment_range_max': self.investment_range_max,
            'risk_tolerance': self.risk_tolerance,
            'investor_type': self.investor_type,
            'accredited_status': self.accredited_status,
            'net_worth': self.net_worth,
            'annual_income': self.annual_income,
            'investment_experience': self.investment_experience,
            'portfolio_size': self.portfolio_size,
            'expertise_areas': self.get_expertise_areas(),
            'advisory_availability': self.advisory_availability,
            'board_experience': self.board_experience,
            'communication_frequency': self.communication_frequency,
            'meeting_preference': self.meeting_preference,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class EntrepreneurProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    # NEW: One-liner description
    headline = db.Column(db.String(150))

    # Company information
    company_name = db.Column(db.String(100), nullable=False)
    company_description = db.Column(db.Text)
    industry = db.Column(db.String(50))
    business_model = db.Column(db.String(50))  # e.g., 'b2b', 'saas'
    stage = db.Column(db.String(20))  # 'idea', 'mvp', etc.
    founded_date = db.Column(db.Date)
    employee_count = db.Column(db.Integer)
    location = db.Column(db.String(100))

    # Funding
    funding_stage = db.Column(db.String(20))  # 'seed', 'series_a', etc.
    funding_amount_seeking = db.Column(db.Integer)
    funding_amount_raised = db.Column(db.Integer)
    previous_funding_rounds = db.Column(db.Text)  # JSON array
    use_of_funds = db.Column(db.Text)

    # Financials
    monthly_revenue = db.Column(db.Integer)
    monthly_growth_rate = db.Column(db.Float)
    gross_margin = db.Column(db.Float)
    burn_rate = db.Column(db.Integer)
    runway_months = db.Column(db.Integer)

    # Team
    team_size = db.Column(db.Integer)
    key_team_members = db.Column(db.Text)  # JSON array
    advisors = db.Column(db.Text)  # JSON array

    # Market
    target_market = db.Column(db.Text)
    market_size = db.Column(db.String(100))
    competitors = db.Column(db.Text)
    competitive_advantage = db.Column(db.Text)

    # Investor fit
    preferred_investor_types = db.Column(db.Text)  # JSON array
    geographic_investor_preference = db.Column(db.Text)  # JSON array
    looking_for_strategic_value = db.Column(db.Boolean, default=True)

    # Status
    is_actively_fundraising = db.Column(db.Boolean, default=True)
    pitch_deck_url = db.Column(db.String(255))
    demo_url = db.Column(db.String(255))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # JSON helpers
    def get_previous_funding_rounds(self):
        return json.loads(self.previous_funding_rounds) if self.previous_funding_rounds else []

    def set_previous_funding_rounds(self, rounds):
        self.previous_funding_rounds = json.dumps(rounds)

    def get_key_team_members(self):
        return json.loads(self.key_team_members) if self.key_team_members else []

    def set_key_team_members(self, members):
        self.key_team_members = json.dumps(members)

    def get_advisors(self):
        return json.loads(self.advisors) if self.advisors else []

    def set_advisors(self, advisors):
        self.advisors = json.dumps(advisors)

    def get_preferred_investor_types(self):
        return json.loads(self.preferred_investor_types) if self.preferred_investor_types else []

    def set_preferred_investor_types(self, types):
        self.preferred_investor_types = json.dumps(types)

    def get_geographic_investor_preference(self):
        return json.loads(self.geographic_investor_preference) if self.geographic_investor_preference else []

    def set_geographic_investor_preference(self, locations):
        self.geographic_investor_preference = json.dumps(locations)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'headline': self.headline,
            'company_name': self.company_name,
            'company_description': self.company_description,
            'industry': self.industry,
            'business_model': self.business_model,
            'stage': self.stage,
            'founded_date': self.founded_date.isoformat() if self.founded_date else None,
            'employee_count': self.employee_count,
            'location': self.location,
            'funding_stage': self.funding_stage,
            'funding_amount_seeking': self.funding_amount_seeking,
            'funding_amount_raised': self.funding_amount_raised,
            'previous_funding_rounds': self.get_previous_funding_rounds(),
            'use_of_funds': self.use_of_funds,
            'monthly_revenue': self.monthly_revenue,
            'monthly_growth_rate': self.monthly_growth_rate,
            'gross_margin': self.gross_margin,
            'burn_rate': self.burn_rate,
            'runway_months': self.runway_months,
            'team_size': self.team_size,
            'key_team_members': self.get_key_team_members(),
            'advisors': self.get_advisors(),
            'target_market': self.target_market,
            'market_size': self.market_size,
            'competitors': self.competitors,
            'competitive_advantage': self.competitive_advantage,
            'preferred_investor_types': self.get_preferred_investor_types(),
            'geographic_investor_preference': self.get_geographic_investor_preference(),
            'looking_for_strategic_value': self.looking_for_strategic_value,
            'is_actively_fundraising': self.is_actively_fundraising,
            'pitch_deck_url': self.pitch_deck_url,
            'demo_url': self.demo_url,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Match(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    investor_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    entrepreneur_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    compatibility_score = db.Column(db.Float, nullable=False)
    match_reasons = db.Column(db.Text)  # JSON array of string reasons

    # Future-proofing fields
    match_algorithm_version = db.Column(db.String(20))  # E.g., "v1.0", "ml-v2"
    match_score_breakdown = db.Column(db.Text)  # JSON object with detailed scores

    # Status and interest
    status = db.Column(db.String(20), default='pending')  # 'pending', 'accepted', etc.
    investor_interest = db.Column(db.String(20))  # 'interested', 'not_interested', 'maybe'
    entrepreneur_interest = db.Column(db.String(20))  # same

    notes = db.Column(db.Text)
    is_hidden = db.Column(db.Boolean, default=False)  # Soft hide from frontend

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    investor = db.relationship('User', foreign_keys=[investor_id])
    entrepreneur = db.relationship('User', foreign_keys=[entrepreneur_id])

    def get_match_reasons(self):
        return json.loads(self.match_reasons) if self.match_reasons else []

    def set_match_reasons(self, reasons):
        self.match_reasons = json.dumps(reasons)

    def get_match_score_breakdown(self):
        return json.loads(self.match_score_breakdown) if self.match_score_breakdown else {}

    def set_match_score_breakdown(self, breakdown):
        self.match_score_breakdown = json.dumps(breakdown)

    def to_dict(self):
        return {
            'id': self.id,
            'investor_id': self.investor_id,
            'entrepreneur_id': self.entrepreneur_id,
            'compatibility_score': self.compatibility_score,
            'match_reasons': self.get_match_reasons(),
            'match_algorithm_version': self.match_algorithm_version,
            'match_score_breakdown': self.get_match_score_breakdown(),
            'status': self.status,
            'investor_interest': self.investor_interest,
            'entrepreneur_interest': self.entrepreneur_interest,
            'notes': self.notes,
            'is_hidden': self.is_hidden,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'investor': self.investor.to_summary() if self.investor else None,
            'entrepreneur': self.entrepreneur.to_summary() if self.entrepreneur else None,
        }

class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    summary = db.Column(db.String(300))  # Optional short summary or headline
    description = db.Column(db.Text)

    event_type = db.Column(db.String(50), nullable=False)  # e.g. 'monthly_meeting', 'showcase'
    date = db.Column(db.DateTime, nullable=False)
    location = db.Column(db.String(200))
    capacity = db.Column(db.Integer)

    # Ticketing & access
    price = db.Column(db.Float, default=0.0)
    is_members_only = db.Column(db.Boolean, default=False)

    # Status tracking
    status = db.Column(db.String(20), default='upcoming')  # 'upcoming', 'ongoing', 'completed', 'cancelled'

    # Structured details
    agenda = db.Column(db.Text)      # JSON array of dicts: [{time, topic, speaker}]
    presenters = db.Column(db.Text)  # JSON array of dicts: [{name, bio, title, company}]

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    registrations = db.relationship('EventRegistration', backref='event', cascade='all, delete-orphan')

    # Utility methods
    def get_agenda(self):
        return json.loads(self.agenda) if self.agenda else []

    def set_agenda(self, agenda_items):
        self.agenda = json.dumps(agenda_items)

    def get_presenters(self):
        return json.loads(self.presenters) if self.presenters else []

    def set_presenters(self, presenter_list):
        self.presenters = json.dumps(presenter_list)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'summary': self.summary,
            'description': self.description,
            'event_type': self.event_type,
            'date': self.date.isoformat() if self.date else None,
            'location': self.location,
            'capacity': self.capacity,
            'price': self.price,
            'is_members_only': self.is_members_only,
            'status': self.status,
            'agenda': self.get_agenda(),
            'presenters': self.get_presenters(),
            'registration_count': len(self.registrations),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class EventRegistration(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('event.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    role = db.Column(db.String(20), nullable=False)  # 'entrepreneur' or 'investor'
    answers = db.Column(db.JSON, nullable=True)  # Stores role-specific form responses
    
    registration_status = db.Column(db.String(20), nullable=True)  # pending, approved, rejected (only for entrepreneurs)
    reviewer_email = db.Column(db.String(120))  # typically Mateo’s email
    reviewed_at = db.Column(db.DateTime)

    meeting_preference = db.Column(db.String(20), default='on_site')  # 'digital', 'on_site'

    # Metadata
    registration_date = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='event_registrations')
    event = db.relationship('Event', backref='registrations')

    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'user_id': self.user_id,
            'role': self.role,
            'answers': self.answers,
            'registration_status': self.registration_status,
            'reviewer_email': self.reviewer_email,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'meeting_preference': self.meeting_preference,
            'registration_date': self.registration_date.isoformat() if self.registration_date else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Document(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    # File info
    filename = db.Column(db.String(255), nullable=False)  # Saved filename
    original_filename = db.Column(db.String(255), nullable=False)  # Original uploaded name
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer)
    file_type = db.Column(db.String(50))  # e.g. 'pdf', 'png'
    mime_type = db.Column(db.String(100))  # e.g. 'application/pdf', 'image/png'

    # Classification and metadata
    document_type = db.Column(db.String(50))  # 'pitch_deck', 'financial_statement', 'legal_document', etc.
    description = db.Column(db.Text)
    tags = db.Column(db.Text)  # JSON array as string (e.g., ["confidential", "financials"])

    # Permissions and visibility
    is_public = db.Column(db.Boolean, default=False)
    access_level = db.Column(db.String(20), default='private')  # 'private', 'members', 'public'
    download_count = db.Column(db.Integer, default=0)

    # Lifecycle
    is_deleted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    access_grants = db.relationship('DocumentAccess', backref='document', cascade='all, delete-orphan')

    def get_tags(self):
        return json.loads(self.tags) if self.tags else []

    def set_tags(self, tags):
        self.tags = json.dumps(tags)

    def to_dict(self):
        return {
            'id': self.id,
            'owner_id': self.owner_id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_path': self.file_path,
            'file_size': self.file_size,
            'file_type': self.file_type,
            'mime_type': self.mime_type,
            'document_type': self.document_type,
            'description': self.description,
            'tags': self.get_tags(),
            'is_public': self.is_public,
            'access_level': self.access_level,
            'download_count': self.download_count,
            'is_deleted': self.is_deleted,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class DocumentAccess(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('document.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # The receiver of the access
    granted_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # The user who granted access

    # Permissions and status
    access_type = db.Column(db.String(20), default='view')  # 'view', 'download', 'edit'
    is_active = db.Column(db.Boolean, default=True)
    granted_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)  # Optional expiration date for temporary access

    # Soft delete and audit
    revoked_at = db.Column(db.DateTime)  # Nullable timestamp to indicate when access was revoked (if any)
    notes = db.Column(db.Text)  # Optional notes (e.g. reason for granting or revoking)

    # Relationships
    user = db.relationship('User', foreign_keys=[user_id], backref='document_access')
    granter = db.relationship('User', foreign_keys=[granted_by], backref='granted_access')

    def to_dict(self):
        return {
            'id': self.id,
            'document_id': self.document_id,
            'user_id': self.user_id,
            'access_type': self.access_type,
            'granted_by': self.granted_by,
            'granted_at': self.granted_at.isoformat() if self.granted_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'revoked_at': self.revoked_at.isoformat() if self.revoked_at else None,
            'is_active': self.is_active,
            'notes': self.notes
        }

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    # Sender and recipient
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    # Content
    subject = db.Column(db.String(200))
    content = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.String(20), default='direct')  # 'direct', 'match_introduction', 'event_related'
    
    # Metadata
    thread_id = db.Column(db.String(100))  # Used to group messages in a conversation
    attachments = db.Column(db.Text)  # JSON array of filenames/metadata

    # Read/Delivery Status
    is_read = db.Column(db.Boolean, default=False)
    read_at = db.Column(db.DateTime)

    # Lifecycle
    is_archived = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)  # Soft delete
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    sender = db.relationship('User', foreign_keys=[sender_id], backref='sent_messages')
    recipient = db.relationship('User', foreign_keys=[recipient_id], backref='received_messages')

    def get_attachments(self):
        return json.loads(self.attachments) if self.attachments else []

    def set_attachments(self, attachment_list):
        self.attachments = json.dumps(attachment_list)

    def to_dict(self):
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'recipient_id': self.recipient_id,
            'subject': self.subject,
            'content': self.content,
            'message_type': self.message_type,
            'thread_id': self.thread_id,
            'attachments': self.get_attachments(),
            'is_read': self.is_read,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'is_archived': self.is_archived,
            'is_deleted': self.is_deleted,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'sender': self.sender.to_summary() if self.sender else None,
            'recipient': self.recipient.to_summary() if self.recipient else None
        }