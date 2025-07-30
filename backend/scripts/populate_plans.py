# scripts/populate_plans.py
import sys
import os
from decimal import Decimal
from dotenv import load_dotenv

# Add backend root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src import create_app
from src.models.user import db, TierPlan

load_dotenv()  # load .env

app = create_app()

with app.app_context():
    # Clear existing plans (optional)
    TierPlan.query.delete()

    # Insert plans
    plans = [
        TierPlan(
            id=1,
            name="Investor Basic",
            features=[
                "Basic access to startup listings",
                "Limited messaging",
                "Standard filters"
            ],
            price=Decimal("50.00"),
            stripe_plan_id=os.getenv("STRIPE_PRICE_INVESTOR_BASIC")
        ),
        TierPlan(
            id=2,
            name="Investor Premium",
            features=[
                "Unlimited matching",
                "Advanced search filters",
                "Priority customer support",
                "Investment tracking tools",
                "Market insights reports",
                "Unlimited messaging & downloads"
            ],
            price=Decimal("150.00"),
            stripe_plan_id=os.getenv("STRIPE_PRICE_INVESTOR_PREMIUM")
        ),
        TierPlan(
            id=3,
            name="Investor VIP",
            features=[
                "All Premium features",
                "1-on-1 onboarding",
                "VIP support line",
                "Early access to top startups",
                "Exclusive investor events"
            ],
            price=Decimal("300.00"),
            stripe_plan_id=os.getenv("STRIPE_PRICE_INVESTOR_VIP")
        ),
        TierPlan(
            id=4,
            name="Entrepreneur Free",
            features=[
                "Basic profile creation",
                "Public exposure",
                "Limited investor outreach"
            ],
            price=Decimal("0.00"),
            stripe_plan_id=None
        ),
        TierPlan(
            id=5,
            name="Entrepreneur Premium",
            features=[
                "Full profile visibility",
                "Analytics on investor views",
                "Direct investor messaging",
                "Document sharing tools"
            ],
            price=Decimal("75.00"),
            stripe_plan_id=os.getenv("STRIPE_PRICE_ENTREPRENEUR_PREMIUM")
        ),
        TierPlan(
            id=6,
            name="Entrepreneur Enterprise",
            features=[
                "All Premium features",
                "Team onboarding",
                "Custom analytics dashboard",
                "Dedicated fundraising coach"
            ],
            price=Decimal("200.00"),
            stripe_plan_id=os.getenv("STRIPE_PRICE_ENTREPRENEUR_ENTERPRISE")
        )
    ]

    with app.app_context():
        db.session.bulk_save_objects(plans)
        db.session.commit()
        print("Plans inserted successfully.")