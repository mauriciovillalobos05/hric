# scripts/populate_dummy_users_data.py
import sys
import os
import uuid
from decimal import Decimal
from datetime import datetime
from dotenv import load_dotenv

# Add backend root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src import create_app
from src.models.user import db, InvestorProfile, Enterprise, Subscription

load_dotenv()
app = create_app()

with app.app_context():
    investor_ids = [
        "a92040ad-8b3c-48ba-8f99-d0e776bc8b7c",
        "3f5e5180-3cdf-44f1-9111-0eaad7d9dd21",
        "a08ee485-43bd-4238-9e94-797d66898ba8",
        "702803e8-8016-48d7-912d-54a50259cd60",
        "6054ebac-ea61-4662-8fbf-f70c8de739aa",
    ]

    founder_ids = [
        "e3d7b189-c7fd-47c2-90c6-53482ea37f82",
        "3f79e845-1ebf-4e0b-b32a-8adc1e1c863b",
        "f1b6cd10-2fa7-43e1-97c7-5d6be2ef5983",
        "bb87d3b4-ea8e-4ab1-99d5-ab32b7cf600a",
        "e00c4bad-ab9e-4527-abfb-ad30bdf489b8",
    ]

    # Insert Investor Profiles
    for uid in investor_ids:
        profile = InvestorProfile(
            user_id=uuid.UUID(uid),
            industries=["HealthTech"],
            investment_stages=["growth"],
            geographic_focus=["San Francisco"],
            investment_range_min=500000,
            investment_range_max=2000000,
            accredited_status=True,
            investor_type="Angel",
            risk_tolerance="medium",
            portfolio_size=12,
            advisory_availability=True,
            communication_frequency="monthly",
            meeting_preference="virtual"
        )
        db.session.add(profile)

    # Insert Matching Enterprises
    for i, uid in enumerate(founder_ids):
        e = Enterprise(
            user_id=uuid.UUID(uid),
            name=f"HealthAI{i+1}",
            industry="HealthTech",
            stage="growth",
            business_model="B2B",
            team_size=10 + i,
            pitch_deck_url=f"https://example.com/deck{i+1}.pdf",
            demo_url=f"https://demo{i+1}.healthai.com",
            location="San Francisco",
            funding_needed=Decimal("1000000.00"),
            financials={"funding_goal": 1000000},
            target_market="Hospitals and private practices"
        )
        db.session.add(e)
        db.session.flush()  # get e.id to use in Subscription

        subscription = Subscription(
            user_id=uuid.UUID(uid),
            enterprise_id=e.id,
            tier="Entrepreneur Enterprise",
            stripe_customer_id="cus_dummy",
            stripe_subscription_id="sub_dummy"
        )
        db.session.add(subscription)

    # Add Investor Subscriptions (VIP)
    for uid in investor_ids:
        s = Subscription(
            user_id=uuid.UUID(uid),
            tier="Investor VIP",
            stripe_customer_id="cus_dummy",
            stripe_subscription_id="sub_dummy"
        )
        db.session.add(s)

    db.session.commit()
    print("Investor profiles, enterprises, and subscriptions inserted.")