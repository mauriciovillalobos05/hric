# src/routes/subscriptions.py

from datetime import datetime, timezone
import os

import requests
import stripe
from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from src.extensions import db
from src.models.user import User, Subscription, UserPlan, Enterprise, EnterpriseUser

subscriptions_bp = Blueprint("subscriptions", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "").rstrip("/")
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


# --------------------- Auth --------------------- #

def require_auth():
    """Validate Supabase JWT and return (user, token, error_tuple_or_None)."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, None, (jsonify({"error": "Missing or invalid Authorization header"}), 401)

    token = auth_header.split(" ")[1]
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
            timeout=15,
        )
        if resp.status_code != 200:
            return None, None, (jsonify({"error": "Invalid or expired token"}), 401)
        user_id = resp.json()["id"]
    except Exception as e:
        return None, None, (jsonify({"error": f"Token verification failed: {str(e)}"}), 500)

    user = User.query.get(user_id)
    if not user:
        return None, None, (jsonify({"error": "User not found in database"}), 404)

    return user, token, None


# --------------------- Helpers --------------------- #

def _active_or_trialing():
    return ("active", "trialing")

def _user_success_path(user: User) -> str:
    """
    Heuristic success path based on memberships:
    - investor membership -> /dashboard/investor
    - startup membership  -> /dashboard/entrepreneur
    - none                -> /complete-profile
    """
    # collect user's active enterprises
    active_memberships = [m for m in user.enterprise_memberships if m.is_active]
    enterprise_ids = [m.enterprise_id for m in active_memberships]
    if not enterprise_ids:
        return "/complete-profile"

    ents = Enterprise.query.filter(Enterprise.id.in_(enterprise_ids)).all()
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
        plan = UserPlan.query.get(sub.user_plan_id)
        data["plan"] = _plan_to_dict(plan) if plan else None
    return data


# --------------------- Routes --------------------- #

@subscriptions_bp.route("/plans", methods=["GET"])
def get_plans():
    """List active plans from the DB (UserPlan)."""
    plans = UserPlan.query.filter_by(is_active=True).order_by(UserPlan.name.asc()).all()
    return jsonify({"plans": [_plan_to_dict(p) for p in plans]}), 200


@subscriptions_bp.route("/checkout", methods=["POST"])
def create_checkout_session():
    """
    Create a Stripe Checkout Session for a given plan_key and billing_interval.
    body: { "plan_key": "...", "billing_interval": "monthly"|"annual" }
    """
    user, token, err = require_auth()
    if err:
        return err

    if not FRONTEND_URL:
        return jsonify({"error": "FRONTEND_URL not set in environment"}), 500

    data = request.get_json(silent=True) or {}
    plan_key = data.get("plan_key")
    interval = (data.get("billing_interval") or "monthly").lower()

    if interval not in ("monthly", "annual"):
        return jsonify({"error": "billing_interval must be 'monthly' or 'annual'"}), 400

    plan = UserPlan.query.filter_by(plan_key=plan_key, is_active=True).first()
    if not plan:
        return jsonify({"error": "Invalid or inactive plan_key"}), 400

    # choose stripe price id based on interval
    price_id = plan.stripe_price_id_monthly if interval == "monthly" else plan.stripe_price_id_annual
    if not price_id:
        # treat as free/internal plan: no stripe checkout
        return jsonify({"redirect_url": f"{FRONTEND_URL}{_user_success_path(user)}"}), 200

    # Create Stripe customer if we don’t yet have one (optional)
    customer_id = user.stripe_customer_id
    try:
        if not customer_id:
            customer = stripe.Customer.create(email=user.email)
            customer_id = customer["id"]
            user.stripe_customer_id = customer_id
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create Stripe customer: {str(e)}"}), 500

    # Success path heuristic
    success_path = _user_success_path(user)

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            success_url=f"{FRONTEND_URL}{success_path}",
            cancel_url=f"{FRONTEND_URL}/subscription/cancel",
            payment_method_types=["card"],
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            metadata={
                "user_id": str(user.id),
                "plan_key": plan.plan_key,
                "price_id": price_id,
                "interval": interval,
            },
        )
        return jsonify({"checkout_url": session.url}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@subscriptions_bp.route("/current", methods=["GET"])
def get_user_subscription():
    """Return the user's current active/trialing subscription, if any."""
    user, _, err = require_auth()
    if err:
        return err

    sub = (
        Subscription.query.filter(
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
    Change to a FREE/internal plan immediately (no Stripe).
    For paid plans, the client should call /checkout instead.
    body: { "plan_key": "...", "billing_interval": "monthly"|"annual" }
    """
    user, _, err = require_auth()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    plan_key = data.get("plan_key")
    interval = (data.get("billing_interval") or "monthly").lower()
    if interval not in ("monthly", "annual"):
        return jsonify({"error": "billing_interval must be 'monthly' or 'annual'"}), 400

    plan = UserPlan.query.filter_by(plan_key=plan_key, is_active=True).first()
    if not plan:
        return jsonify({"error": "Invalid or inactive plan_key"}), 400

    # If plan has a Stripe price id, force the client to use /checkout
    price_id = plan.stripe_price_id_monthly if interval == "monthly" else plan.stripe_price_id_annual
    if price_id:
        return jsonify({"error": "Use /subscriptions/checkout for paid plans"}), 400

    # Create/replace a local subscription row for the free plan
    # Close any existing active/trialing subs
    now = datetime.now(timezone.utc)
    subs = Subscription.query.filter(Subscription.user_id == user.id, Subscription.status.in_(_active_or_trialing())).all()
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
        payment_frequency=interval if interval in ("monthly", "annual") else None,
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
    - If it's a Stripe sub, request cancel_at_period_end=True at Stripe; local row is updated.
    - If it's a free/local sub, mark canceled immediately.
    """
    user, _, err = require_auth()
    if err:
        return err

    sub = (
        Subscription.query.filter(
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
            # set cancel_at_period_end at Stripe; webhook will finalize status later
            stripe.Subscription.modify(sub.stripe_subscription_id, cancel_at_period_end=True)
            sub.cancel_at_period_end = True
            # Keep status as-is until webhook updates it; just persist the intent.
        else:
            # Local/free sub: cancel immediately
            sub.status = "canceled"
            sub.cancelled_at = now
            sub.end_date = now

        db.session.commit()
        return jsonify({"message": "Subscription cancellation scheduled" if sub.stripe_subscription_id else "Subscription cancelled"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500