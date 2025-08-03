import sys
import os
import uuid
from decimal import Decimal
from dotenv import load_dotenv

# Add backend root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src import create_app
from src.models.user import db, Users, InvestorProfile, Enterprise

load_dotenv()
app = create_app()

with app.app_context():
    updated_investors = [
        {
            "user_id": "a92040ad-8b3c-48ba-8f99-d0e776bc8b7c",
            "first_name": "Alice",
            "last_name": "Nguyen",
            "location": "New York",
            "industries": ["FinTech"],
            "investment_stages": ["early_revenue"],
            "geographic_focus": ["New York"],
            "investment_range_min": 100000,
            "investment_range_max": 500000,
            "risk_tolerance": "low",
        },
        {
            "user_id": "3f5e5180-3cdf-44f1-9111-0eaad7d9dd21",
            "first_name": "Brian",
            "last_name": "Lee",
            "location": "Austin",
            "industries": ["EdTech", "HealthTech"],
            "investment_stages": ["mvp", "growth"],
            "geographic_focus": ["San Francisco", "Austin"],
            "investment_range_min": 250000,
            "investment_range_max": 1000000,
            "risk_tolerance": "medium",
        },
        {
            "user_id": "a08ee485-43bd-4238-9e94-797d66898ba8",
            "first_name": "Carlos",
            "last_name": "Mendez",
            "location": "San Francisco",
            "industries": ["HealthTech"],
            "investment_stages": ["growth"],
            "geographic_focus": ["San Francisco"],
            "investment_range_min": 500000,
            "investment_range_max": 2000000,
            "risk_tolerance": "medium",
        },
        {
            "user_id": "702803e8-8016-48d7-912d-54a50259cd60",
            "first_name": "Dana",
            "last_name": "Kaur",
            "location": "Texas",
            "industries": ["AgriTech"],
            "investment_stages": ["scale"],
            "geographic_focus": ["Texas"],
            "investment_range_min": 300000,
            "investment_range_max": 1500000,
            "risk_tolerance": "high",
        },
        {
            "user_id": "6054ebac-ea61-4662-8fbf-f70c8de739aa",
            "first_name": "Emily",
            "last_name": "Chen",
            "location": "California",
            "industries": ["GreenTech", "HealthTech"],
            "investment_stages": ["growth", "mature"],
            "geographic_focus": ["California"],
            "investment_range_min": 750000,
            "investment_range_max": 2500000,
            "risk_tolerance": "low",
        },
    ]

    updated_enterprises = [
        {
            "user_id": "e3d7b189-c7fd-47c2-90c6-53482ea37f82",
            "name": "GreenFlow",
            "industry": "GreenTech",
            "stage": "growth",
            "location": "San Francisco",
            "funding_needed": Decimal("800000.00"),
            "financials": {"funding_goal": 800000},
        },
        {
            "user_id": "3f79e845-1ebf-4e0b-b32a-8adc1e1c863b",
            "name": "FinSight",
            "industry": "FinTech",
            "stage": "mvp",
            "location": "New York",
            "funding_needed": Decimal("400000.00"),
            "financials": {"funding_goal": 400000},
        },
        {
            "user_id": "f1b6cd10-2fa7-43e1-97c7-5d6be2ef5983",
            "name": "LearnX",
            "industry": "EdTech",
            "stage": "early_revenue",
            "location": "Austin",
            "funding_needed": Decimal("600000.00"),
            "financials": {"funding_goal": 600000},
        },
        {
            "user_id": "bb87d3b4-ea8e-4ab1-99d5-ab32b7cf600a",
            "name": "FarmNet",
            "industry": "AgriTech",
            "stage": "scale",
            "location": "Texas",
            "funding_needed": Decimal("1200000.00"),
            "financials": {"funding_goal": 1200000},
        },
        {
            "user_id": "e00c4bad-ab9e-4527-abfb-ad30bdf489b8",
            "name": "MediSync",
            "industry": "HealthTech",
            "stage": "mature",
            "location": "California",
            "funding_needed": Decimal("1500000.00"),
            "financials": {"funding_goal": 1500000},
        },
    ]

    for data in updated_investors:
        uid = uuid.UUID(data["user_id"])
        user = Users.query.filter_by(id=uid).first()
        if user:
            user.first_name = data["first_name"]
            user.last_name = data["last_name"]
            user.location = data["location"]

        profile = InvestorProfile.query.filter_by(user_id=uid).first()
        if profile:
            profile.industries = data["industries"]
            profile.investment_stages = data["investment_stages"]
            profile.geographic_focus = data["geographic_focus"]
            profile.investment_range_min = data["investment_range_min"]
            profile.investment_range_max = data["investment_range_max"]
            profile.risk_tolerance = data["risk_tolerance"]

    for data in updated_enterprises:
        uid = uuid.UUID(data["user_id"])
        enterprise = Enterprise.query.filter_by(user_id=uid).first()
        if enterprise:
            enterprise.name = data["name"]
            enterprise.industry = data["industry"]
            enterprise.stage = data["stage"]
            enterprise.location = data["location"]
            enterprise.funding_needed = data["funding_needed"]
            enterprise.financials = data["financials"]

    db.session.commit()
    print("✅ Users, InvestorProfiles, and Enterprises updated.")