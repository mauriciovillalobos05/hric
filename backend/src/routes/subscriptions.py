# src/routes/subscriptions.py
from datetime import datetime, timezone
from decimal import Decimal
import os

import requests
import stripe
from flask import Blueprint, jsonify, request, current_app
from src.extensions import db
from src.models.user import User, Subscription, UserPlan, Enterprise

subscriptions_bp = Blueprint("subscriptions", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "").rstrip("/")
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")  # must be sk_test_... in sandbox

# --------------------- Auth --------------------- #

from src.routes.supabase_auth import require_auth as require_supabase_auth

# --------------------- Helpers --------------------- #

def _active_or_trialing():
    return ("active", "trialing")

def _user_success_path(user: User) -> str:
    """Pick a post-success path based on memberships."""
    active_memberships = [m for m in user.enterprise_memberships if m.is_active]
    enterprise_ids = [m.enterprise_id for m in active_memberships]
    if not enterprise_ids:
        return "/complete-profile"

    ents = db.session.query(Enterprise).filter(Enterprise.id.in_(enterprise_ids)).all()
    has_investor = any(e.enterprise_type in ("investor", "both") for e in ents)
    has_startup = any(e.enterprise_type in ("startup", "both") for e in ents)

    if has_investor:
        return "/dashboard/investor"
    if has_startup:
        return "/dashboard/entrepreneur"
    return "/dashboard"

def _plan_to_dict(plan: UserPlan):
    return {
        "id": str(plan.id),
        "plan_key": plan.plan_key,
        "name": plan.name,
        "description": plan.description,
        "monthly_price": float(plan.monthly_price or 0),
        "annual_price": float(plan.annual_price or 0),
        "features": plan.features or [],
        "is_active": bool(plan.is_active),
        "stripe_product_id": plan.stripe_product_id,
        "stripe_price_id_monthly": plan.stripe_price_id_monthly,
        "stripe_price_id_annual": plan.stripe_price_id_annual,
    }

def _sub_to_dict(sub: Subscription, include_plan=True):
    data = {
        "id": str(sub.id),
        "status": sub.status,
        "stripe_status_raw": sub.stripe_status_raw,
        "start_date": sub.start_date.isoformat() if sub.start_date else None,
        "end_date": sub.end_date.isoformat() if sub.end_date else None,
        "current_period_start": sub.current_period_start.isoformat() if sub.current_period_start else None,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "cancel_at_period_end": sub.cancel_at_period_end,
        "auto_renew": sub.auto_renew,
        "amount": float(sub.amount or 0),
        "currency": sub.currency,
        "payment_frequency": sub.payment_frequency,
        "stripe_subscription_id": sub.stripe_subscription_id,
        "stripe_customer_id": sub.stripe_customer_id,
        "stripe_price_id": sub.stripe_price_id,
        "stripe_product_id": sub.stripe_product_id,
        "default_payment_method_id": sub.default_payment_method_id,
        "collection_method": sub.collection_method,
        "cancelled_at": sub.cancelled_at.isoformat() if sub.cancelled_at else None,
    }
    if include_plan and sub.user_plan_id:
        plan = db.session.get(UserPlan, sub.user_plan_id)
        data["plan"] = _plan_to_dict(plan) if plan else None
    return data

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

def _env_price_id(plan_key: str, interval: str) -> str | None:
    # Optional env overrides, e.g. STRIPE_PRICE_INVESTOR_PREMIUM_MONTHLY
    env_name = f"STRIPE_PRICE_{plan_key.upper()}_{'MONTHLY' if interval == 'monthly' else 'ANNUAL'}"
    return os.getenv(env_name)

def _ensure_default_plans():
    """Seed default plans if none exist. Safe to run each time."""
    if db.session.query(UserPlan).count() > 0:
        return
    for p in DEFAULT_PLANS:
        up = UserPlan(
            plan_key=p["plan_key"],
            name=p["name"],
            description=p["desc"],
            monthly_price=p["monthly"],
            annual_price=p["annual"],
            features=p["features"],
            is_active=True,
            stripe_price_id_monthly=_env_price_id(p["plan_key"], "monthly"),
            stripe_price_id_annual=_env_price_id(p["plan_key"], "annual"),
        )
        db.session.add(up)
    db.session.commit()

def _price_in_cents(amount: Decimal | None) -> int | None:
    if not amount:
        return None
    # Convert Decimal dollars -> integer cents safely
    return int((Decimal(amount).quantize(D("0.01")) * 100).to_integral_value())

def _ensure_stripe_product(plan: UserPlan) -> str:
    """Create a Stripe Product if missing; returns product_id."""
    if plan.stripe_product_id:
        return plan.stripe_product_id
    if not stripe.api_key or not stripe.api_key.startswith("sk_"):
        raise RuntimeError("Stripe secret key missing. Set STRIPE_SECRET_KEY to an sk_test_… key for sandbox.")
    product = stripe.Product.create(
        name=plan.name,
        metadata={"plan_key": plan.plan_key},
    )
    plan.stripe_product_id = product["id"]
    db.session.commit()
    return plan.stripe_product_id

def _ensure_stripe_price(plan: UserPlan, interval: str) -> str | None:
    """
    Ensure a Stripe Price exists for the given interval.
    Returns price_id or None (for free plans).
    """
    interval = interval.lower()
    if interval not in ("monthly", "annual"):
        raise ValueError("interval must be monthly or annual")

    amount = plan.monthly_price if interval == "monthly" else plan.annual_price
    cents = _price_in_cents(amount)

    # Free plans: no price needed
    if not cents or cents <= 0:
        return None

    # If already configured in DB, use it
    existing = plan.stripe_price_id_monthly if interval == "monthly" else plan.stripe_price_id_annual
    if existing:
        return existing

    # Otherwise, auto-create in Stripe (test mode)
    product_id = _ensure_stripe_product(plan)
    price = stripe.Price.create(
        unit_amount=cents,
        currency="usd",
        recurring={"interval": "month" if interval == "monthly" else "year"},
        product=product_id,
        metadata={"plan_key": plan.plan_key, "interval": interval},
    )
    if interval == "monthly":
        plan.stripe_price_id_monthly = price["id"]
    else:
        plan.stripe_price_id_annual = price["id"]
    db.session.commit()
    return price["id"]

# --------------------- Routes --------------------- #

@subscriptions_bp.route("/plans", methods=["GET"])
def get_plans():
    """List active plans; seed defaults if empty. Fail-soft with a Free plan if DB errors."""
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
    """
    user, _, err = require_supabase_auth()
    if err:
        return err

    if not FRONTEND_URL:
        return jsonify({"error": "FRONTEND_URL not set in environment"}), 500

    data = request.get_json(silent=True) or {}
    plan_key = data.get("plan_key") or data.get("plan") or data.get("planKey")
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

    try:
        # Will auto-create Product/Price for paid plans in Stripe test mode
        price_id = _ensure_stripe_price(plan, interval)

        # Free plan? just send them forward
        if not price_id:
            return jsonify({"redirect_url": f"{FRONTEND_URL}{_user_success_path(user)}"}), 200

        # Ensure Stripe Customer
        customer_id = user.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(email=user.email, metadata={"app_user_id": str(user.id)})
            customer_id = customer["id"]
            user.stripe_customer_id = customer_id
            db.session.commit()

        success_path = _user_success_path(user)

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
                "price_id": price_id,
                "interval": interval,
            },
        )
        return jsonify({"checkout_url": session.url}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Stripe error: {str(e)}"}), 500

@subscriptions_bp.route("/current", methods=["GET"])
def get_user_subscription():
    """Return the user's current active/trialing subscription, if any."""
    user, _, err = require_supabase_auth()
    if err:
        return err

    sub = (
        db.session.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status.in_(_active_or_trialing()),
        )
        .order_by(
            Subscription.current_period_end.desc().nullslast(),
            Subscription.start_date.desc().nullslast(),
        )
        .first()
    )

    if not sub:
        return jsonify({"subscription": None}), 200

    return jsonify({"subscription": _sub_to_dict(sub)}), 200

@subscriptions_bp.route("/change", methods=["POST"])
def change_plan():
    """
    Switch to a FREE/internal plan immediately (no Stripe).
    For paid plans, use /subscriptions/checkout instead.
    """
    user, _, err = require_supabase_auth()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    plan_key = data.get("plan_key") or data.get("plan") or data.get("planKey")
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
    cents = _price_in_cents(plan.monthly_price if interval == "monthly" else plan.annual_price)
    if cents and cents > 0:
        return jsonify({"error": "Use /subscriptions/checkout for paid plans"}), 400

    # Close any existing active/trialing subs, then create local free sub
    now = datetime.now(timezone.utc)
    subs = (
        db.session.query(Subscription)
        .filter(Subscription.user_id == user.id, Subscription.status.in_(_active_or_trialing()))
        .all()
    )
    for s in subs:
        s.status = "canceled"
        s.cancelled_at = now
        s.end_date = now

    new_sub = Subscription(
        user_id=user.id,
        user_plan_id=plan.id,
        status="active",
        start_date=now,
        current_period_start=now,
        current_period_end=None,
        amount=0,
        currency="USD",
        payment_frequency=interval,
        auto_renew=False,
        cancel_at_period_end=False,
        stripe_status_raw="",
    )
    db.session.add(new_sub)
    db.session.commit()

    return jsonify({"message": "Plan changed", "subscription": _sub_to_dict(new_sub)}), 200

@subscriptions_bp.route("/cancel", methods=["POST"])
def cancel_subscription():
    """
    Cancel the user's current subscription.
    - If Stripe sub, set cancel_at_period_end=True at Stripe; webhook will finalize.
    - If free/local sub, cancel immediately.
    """
    user, _, err = require_supabase_auth()
    if err:
        return err

    sub = (
        db.session.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status.in_(_active_or_trialing()),
        )
        .order_by(
            Subscription.current_period_end.desc().nullslast(),
            Subscription.start_date.desc().nullslast(),
        )
        .first()
    )
    if not sub:
        return jsonify({"message": "No active subscription"}), 200

    now = datetime.now(timezone.utc)

    try:
        if sub.stripe_subscription_id:
            stripe.Subscription.modify(sub.stripe_subscription_id, cancel_at_period_end=True)
            sub.cancel_at_period_end = True
        else:
            sub.status = "canceled"
            sub.cancelled_at = now
            sub.end_date = now

        db.session.commit()
        return jsonify({"message": "Subscription cancellation scheduled" if sub.stripe_subscription_id else "Subscription cancelled"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500