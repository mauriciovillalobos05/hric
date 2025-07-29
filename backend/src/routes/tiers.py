from src.models.user import db, TierPlan
from decimal import Decimal

plans = [
    # Investor Plans
    TierPlan(
        id=1,
        name="Investor Basic",
        features=[
            "Basic access to startup listings",
            "Limited messaging",
            "Standard filters"
        ],
        price=Decimal("0.00"),
        stripe_plan_id=None
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
        stripe_plan_id="price_1InvestorPremium"  # Replace with actual Stripe price ID
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
        stripe_plan_id="price_1InvestorVIP"  # Replace with actual Stripe price ID
    ),

    # Entrepreneur Plans
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
        price=Decimal("50.00"),
        stripe_plan_id="price_1EntrepreneurPremium"  # Replace with actual Stripe price ID
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
        price=Decimal("150.00"),
        stripe_plan_id="price_1EntrepreneurEnterprise"  # Replace with actual Stripe price ID
    )
]

# Bulk insert
db.session.bulk_save_objects(plans)
db.session.commit()
