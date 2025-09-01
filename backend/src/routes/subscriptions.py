from datetime import datetime, timezone
from decimal import Decimal
import os

import stripe
from flask import Blueprint, jsonify, request, current_app
from src.extensions import db
from src.models.user import User, Subscription, UserPlan

subscriptions_bp = Blueprint("subscriptions", __name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "").rstrip("/")

# Stripe (optional, only for paid plans if you configure price IDs)
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")  # sk_test_... in sandbox

# --------------------- Auth --------------------- #
from src.routes.supabase_auth import require_auth as require_supabase_auth

# --------------------- Helpers --------------------- #

def _plan_to_dict(plan: UserPlan):
    """Only fields that exist on your UserPlan model."""
    return {
        "id": str(plan.id),
        "plan_key": plan.plan_key,
        "name": plan.name,
        "description": plan.description,
        "monthly_price": float(plan.monthly_price or 0),
        "annual_price": float(plan.annual_price or 0),
        "features": plan.features or [],
        "is_active": bool(plan.is_active),
    }

def _price_in_cents(amount: Decimal | None) -> int | None:
    if amount is None:
        return None
    # Convert Decimal dollars -> integer cents safely
    cents = (Decimal(amount).quantize(Decimal("0.01")) * 100)
    return int(cents.to_integral_value())

# --------- Default plans seeding (idempotent) --------- #

from decimal import Decimal as D

DEFAULT_PLANS = [
    # INVESTOR
    dict(plan_key="investor_basic",      name="Investor Basic",      monthly=D("50"),  annual=D("540"),
         desc="Perfect for casual investors", features=["Profile", "Browse", "Limited matching"]),
    dict(plan_key="investor_premium",    name="Investor Premium",    monthly=D("150"), annual=D("1620"),
         desc="For active investors", features=["Everything in Basic", "Unlimited matching", "Advanced filters"]),
    dict(plan_key="investor_vip",        name="Investor VIP",        monthly=D("300"), annual=D("3240"),
         desc="HNWI service", features=["Premium+", "Advisor", "Exclusive access"]),
    # ENTREPRENEUR
    dict(plan_key="entrepreneur_free",       name="Entrepreneur Free",       monthly=D("0"),   annual=D("0"),
         desc="Get started", features=["Profile", "Basic messaging", "3 matches/month"]),
    dict(plan_key="entrepreneur_premium",    name="Entrepreneur Premium",    monthly=D("75"),  annual=D("810"),
         desc="For fundraising", features=["Unlimited browsing", "Priority matching", "Analytics"]),
    dict(plan_key="entrepreneur_enterprise", name="Entrepreneur Enterprise", monthly=D("200"), annual=D("2160"),
         desc="Advanced features", features=["Success manager", "Branding", "API access"]),
]

def _ensure_default_plans():
    """Seed default plans if none exist. Safe to run each time."""
    if db.session.query(UserPlan).count() > 0:
        return
    for p in DEFAULT_PLANS:
        db.session.add(UserPlan(
            plan_key=p["plan_key"],
            name=p["name"],
            description=p["desc"],
            monthly_price=p["monthly"],
            annual_price=p["annual"],
            features=p["features"],
            is_active=True,
        ))
    db.session.commit()

def _env_price_id(plan_key: str, interval: str) -> str | None:
    """
    For paid plans, look up Stripe Price IDs from env.
    Example env vars:
      STRIPE_PRICE_INVESTOR_PREMIUM_MONTHLY=price_123
      STRIPE_PRICE_INVESTOR_PREMIUM_ANNUAL=price_abc
    """
    env_name = f"STRIPE_PRICE_{plan_key.upper()}_{'MONTHLY' if interval == 'monthly' else 'ANNUAL'}"
    return os.getenv(env_name)

def _is_free_plan(plan: UserPlan, interval: str) -> bool:
    amount = plan.monthly_price if interval == "monthly" else plan.annual_price
    cents = _price_in_cents(amount)
    return not cents or cents <= 0

# --------------------- Routes --------------------- #

@subscriptions_bp.route("/plans", methods=["GET"])
def get_plans():
    """List active plans; seed defaults if empty. Fail-soft with Free plans if DB errors."""
    try:
        _ensure_default_plans()
        plans = (
            db.session.query(UserPlan)
            .filter_by(is_active=True)
            .order_by(UserPlan.name.asc())
            .all()
        )
        return jsonify({"plans": [_plan_to_dict(p) for p in plans]}), 200
    except Exception as e:
        current_app.logger.exception("GET /api/subscriptions/plans failed")
        # Fail-soft: return minimal free plans so onboarding UI can proceed
        return jsonify({
            "plans": [
                {
                    "id": "fallback-investor-free",
                    "plan_key": "investor_free",
                    "name": "Investor Free",
                    "description": "Get started",
                    "monthly_price": 0,
                    "annual_price": 0,
                    "features": ["Basic access"],
                    "is_active": True,
                },
                {
                    "id": "fallback-entrepreneur-free",
                    "plan_key": "entrepreneur_free",
                    "name": "Entrepreneur Free",
                    "description": "Get started",
                    "monthly_price": 0,
                    "annual_price": 0,
                    "features": ["Basic access"],
                    "is_active": True,
                },
            ],
            "warning": f"/plans failed: {str(e)}"
        }), 200

@subscriptions_bp.route("/checkout", methods=["POST"])
def create_checkout_session():
    """
    Create a Stripe Checkout Session for a given plan_key and billing_interval.
    body: { "plan_key": "...", "billing_interval": "monthly"|"annual" }

    NOTE: This requires a valid Supabase JWT (generate it client-side when the user signs up).
    """
    user, _, err = require_supabase_auth(db, User)
    if err:
        return err

    if not FRONTEND_URL:
        return jsonify({"error": "FRONTEND_URL not set in environment"}), 500

    data = request.get_json(silent=True) or {}
    plan_key = (data.get("plan_key") or data.get("plan") or data.get("planKey") or "").strip()
    interval = (data.get("billing_interval") or data.get("interval") or "monthly").lower()

    if not plan_key:
        return jsonify({"error": "plan_key is required"}), 400
    if interval not in ("monthly", "annual"):
        return jsonify({"error": "billing_interval must be 'monthly' or 'annual'"}), 400

    _ensure_default_plans()

    plan = db.session.query(UserPlan).filter_by(plan_key=plan_key, is_active=True).first()
    if not plan:
        available = [p.plan_key for p in db.session.query(UserPlan).filter_by(is_active=True).all()]
        return jsonify({"error": f"Invalid or inactive plan_key '{plan_key}'. Available: {available}"}), 400

    # Free plan? Just push them to questionnaire step (your flow)
    if _is_free_plan(plan, interval):
        return jsonify({"redirect_url": f"{FRONTEND_URL}/questionnaire"}), 200

    # Paid plan: require configured Stripe price IDs in env
    price_id = _env_price_id(plan.plan_key, interval)
    if not price_id:
        return jsonify({
            "error": (
                f"Stripe price not configured for {plan.plan_key} ({interval}). "
                f"Set env STRIPE_PRICE_{plan.plan_key.upper()}_{'MONTHLY' if interval=='monthly' else 'ANNUAL'}"
            )
        }), 500

    # Ensure Stripe Customer (optional – if you want to record it on Subscription later)
    customer_id = user.stripe_customer_id
    try:
        if not customer_id:
            if not stripe.api_key or not stripe.api_key.startswith("sk_"):
                return jsonify({"error": "STRIPE_SECRET_KEY missing or invalid"}), 500
            customer = stripe.Customer.create(email=user.email, metadata={"app_user_id": str(user.id)})
            customer_id = customer["id"]
            user.stripe_customer_id = customer_id
            db.session.commit()

        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{FRONTEND_URL}/stripe/return?stripe=success",
            cancel_url=f"{FRONTEND_URL}/onboarding?stripe=cancel",
            allow_promotion_codes=True,
            billing_address_collection="auto",
            metadata={
                "user_id": str(user.id),
                "plan_key": plan.plan_key,
                "interval": interval,
            },
        )
        return jsonify({"checkout_url": session.url}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Stripe error: {str(e)}"}), 500

@subscriptions_bp.route("/current", methods=["GET"])
def get_user_subscription():
    """Return the user's current subscription (simplified to your model)."""
    user, _, err = require_supabase_auth(db, User)
    if err:
        return err

    sub = (
        db.session.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .order_by(Subscription.start_date.desc().nullslast())
        .first()
    )
    if not sub:
        return jsonify({"subscription": None}), 200

    # Only include the fields that exist on your Subscription model
    data = {
        "id": str(sub.id),
        "status": sub.status,
        "start_date": sub.start_date.isoformat() if sub.start_date else None,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "amount": float(sub.amount or 0),
        "currency": sub.currency,
        "stripe_subscription_id": sub.stripe_subscription_id,
        "stripe_customer_id": sub.stripe_customer_id,
        "plan": _plan_to_dict(db.session.get(UserPlan, sub.user_plan_id)) if sub.user_plan_id else None,
    }
    return jsonify({"subscription": data}), 200

@subscriptions_bp.route("/change", methods=["POST"])
def change_plan():
    """
    Switch to a FREE/internal plan immediately (no Stripe).
    For paid plans, use /subscriptions/checkout instead.
    """
    user, _, err = require_supabase_auth(db, User)
    if err:
        return err

    data = request.get_json(silent=True) or {}
    plan_key = (data.get("plan_key") or data.get("plan") or data.get("planKey") or "").strip()
    interval = (data.get("billing_interval") or data.get("interval") or "monthly").lower()

    if not plan_key:
        return jsonify({"error": "plan_key is required"}), 400
    if interval not in ("monthly", "annual"):
        return jsonify({"error": "billing_interval must be 'monthly' or 'annual'"}), 400

    _ensure_default_plans()

    plan = db.session.query(UserPlan).filter_by(plan_key=plan_key, is_active=True).first()
    if not plan:
        available = [p.plan_key for p in db.session.query(UserPlan).filter_by(is_active=True).all()]
        return jsonify({"error": f"Invalid or inactive plan_key '{plan_key}'. Available: {available}"}), 400

    # Paid plan? prevent bypassing Stripe
    if not _is_free_plan(plan, interval):
        return jsonify({"error": "Use /api/subscriptions/checkout for paid plans"}), 400

    # Cancel any existing subscription rows and create a new free sub row
    now = datetime.now(timezone.utc)
    existing = db.session.query(Subscription).filter(Subscription.user_id == user.id).all()
    for s in existing:
        s.status = "canceled"

    new_sub = Subscription(
        user_id=user.id,
        user_plan_id=plan.id,
        status="active",
        start_date=now,
        amount=Decimal("0.00"),
        currency="USD",
    )
    db.session.add(new_sub)
    db.session.commit()

    return jsonify({
        "message": "Plan changed",
        "subscription": {
            "id": str(new_sub.id),
            "status": new_sub.status,
            "start_date": new_sub.start_date.isoformat() if new_sub.start_date else None,
            "amount": float(new_sub.amount or 0),
            "currency": new_sub.currency,
            "plan": _plan_to_dict(plan),
        },
    }), 200

@subscriptions_bp.route("/cancel", methods=["POST"])
def cancel_subscription():
    """
    Cancel the user's current subscription.
    - If Stripe sub present, set cancel_at_period_end at Stripe; we keep local row as 'active'
      until webhook (if you wire one). Otherwise mark local as canceled immediately.
    """
    user, _, err = require_supabase_auth(db, User)
    if err:
        return err

    sub = (
        db.session.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .order_by(Subscription.start_date.desc().nullslast())
        .first()
    )
    if not sub:
        return jsonify({"message": "No subscription found"}), 200

    try:
        if sub.stripe_subscription_id and stripe.api_key and stripe.api_key.startswith("sk_"):
            stripe.Subscription.modify(sub.stripe_subscription_id, cancel_at_period_end=True)
            # Do nothing else locally for now (optional: set status='canceled' here if you prefer)
        else:
            sub.status = "canceled"
            db.session.commit()
        return jsonify({"message": "Subscription cancellation processed"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500