# src/routes/webhooks.py
import os, stripe
from datetime import datetime
from flask import Blueprint, request, jsonify
from src.extensions import db
from src.models.user import User, UserPlan, Subscription, StripeEvent, SubscriptionStatus

webhooks_bp = Blueprint("webhooks", __name__)
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

def _status_from_stripe(s):
    # Map Stripe status → our enum values
    m = {
        "active": "active",
        "trialing": "trialing",
        "canceled": "canceled",
        "incomplete": "incomplete",
        "incomplete_expired": "incomplete_expired",
        "past_due": "past_due",
        "unpaid": "unpaid",
        "paused": "paused",
    }
    return m.get((s or "").lower(), "active")

def _find_plan_by_price(price_id: str) -> UserPlan | None:
    if not price_id:
        return None
    return (
        db.session.query(UserPlan)
        .filter(
            (UserPlan.stripe_price_id_monthly == price_id)
            | (UserPlan.stripe_price_id_annual == price_id)
        )
        .first()
    )

@webhooks_bp.route("/webhook", methods=["POST"])
def stripe_webhook():
    # 1) Verify signature
    payload = request.data
    sig = request.headers.get("Stripe-Signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
    except Exception as e:
        return jsonify({"error": f"signature verification failed: {e}"}), 400

    # 2) Idempotent event log
    evt_id = event.get("id")
    if db.session.query(StripeEvent).filter_by(stripe_event_id=evt_id).first():
        return jsonify({"ok": True, "idempotent": True}), 200

    se = StripeEvent(
        stripe_event_id=evt_id,
        type=event.get("type"),
        payload=event,  # JSONB
        status="received",
    )
    db.session.add(se)
    db.session.commit()

    try:
        etype = event["type"]

        # Handle either checkout completion or direct subscription lifecycle
        if etype == "checkout.session.completed":
            session = event["data"]["object"]
            subscription_id = session.get("subscription")
            customer_id = session.get("customer")
            metadata = session.get("metadata") or {}
            user_id = metadata.get("user_id")
            price_id = metadata.get("price_id")

            # Ensure we have a user & set stripe_customer_id
            user = db.session.get(User, user_id) if user_id else None
            if not user and customer_id:
                # last-ditch: try to find by stored stripe_customer_id
                user = db.session.query(User).filter_by(stripe_customer_id=customer_id).first()
            if user and customer_id and not user.stripe_customer_id:
                user.stripe_customer_id = customer_id
                db.session.commit()

            # Pull the live subscription object to get periods/amounts
            sub = stripe.Subscription.retrieve(
                subscription_id,
                expand=["items.data.price.product"]
            )
            item = (sub["items"]["data"] or [])[0]
            price = item["price"]
            amount = (price.get("unit_amount") or 0) / 100
            interval = price.get("recurring", {}).get("interval")  # month|year
            status = _status_from_stripe(sub.get("status"))

            # Resolve plan by price_id
            plan = _find_plan_by_price(price.get("id"))

            if user and plan:
                # Upsert our local subscription by stripe_subscription_id
                local = (
                    db.session.query(Subscription)
                    .filter_by(stripe_subscription_id=sub["id"])
                    .first()
                )
                if not local:
                    local = Subscription(
                        user_id=user.id,
                        user_plan_id=plan.id,
                        stripe_subscription_id=sub["id"],
                        stripe_customer_id=sub.get("customer"),
                        stripe_price_id=price.get("id"),
                        stripe_product_id=price.get("product") if isinstance(price.get("product"), str)
                                          else price.get("product", {}).get("id"),
                        status=status,
                        stripe_status_raw=sub.get("status"),
                        amount=amount,
                        currency=(price.get("currency") or "usd").upper(),
                        payment_frequency="monthly" if interval == "month" else "annually",
                        start_date=sub.get("start_date") and
                                   datetime.utcfromtimestamp(sub["start_date"]),
                        current_period_start=sub.get("current_period_start") and
                                   datetime.utcfromtimestamp(sub["current_period_start"]),
                        current_period_end=sub.get("current_period_end") and
                                   datetime.utcfromtimestamp(sub["current_period_end"]),
                        collection_method=sub.get("collection_method"),
                        cancel_at_period_end=bool(sub.get("cancel_at_period_end")),
                    )
                    db.session.add(local)
                else:
                    # Update existing
                    local.status = status
                    local.stripe_status_raw = sub.get("status")
                    local.amount = amount
                    local.payment_frequency = "monthly" if interval == "month" else "annually"
                    local.current_period_start = sub.get("current_period_start") and \
                        datetime.utcfromtimestamp(sub["current_period_start"])
                    local.current_period_end = sub.get("current_period_end") and \
                        datetime.utcfromtimestamp(sub["current_period_end"])
                db.session.commit()

        elif etype in ("customer.subscription.created",
                       "customer.subscription.updated",
                       "customer.subscription.deleted"):
            sub = event["data"]["object"]
            status = _status_from_stripe(sub.get("status"))
            customer_id = sub.get("customer")
            price = (sub.get("items", {}).get("data") or [{}])[0].get("price", {}) or {}
            interval = price.get("recurring", {}).get("interval")
            amount = (price.get("unit_amount") or 0) / 100

            user = db.session.query(User).filter_by(stripe_customer_id=customer_id).first()
            plan = _find_plan_by_price(price.get("id"))

            if user and plan:
                local = (
                    db.session.query(Subscription)
                    .filter_by(stripe_subscription_id=sub["id"])
                    .first()
                )
                if not local:
                    local = Subscription(
                        user_id=user.id,
                        user_plan_id=plan.id,
                        stripe_subscription_id=sub["id"],
                        stripe_customer_id=customer_id,
                        stripe_price_id=price.get("id"),
                        stripe_product_id=price.get("product") if isinstance(price.get("product"), str)
                                          else price.get("product", {}).get("id"),
                        amount=amount,
                        currency=(price.get("currency") or "usd").upper(),
                        payment_frequency="monthly" if interval == "month" else "annually",
                        start_date=sub.get("start_date") and
                                   datetime.utcfromtimestamp(sub["start_date"]),
                    )
                    db.session.add(local)

                local.status = status
                local.stripe_status_raw = sub.get("status")
                local.current_period_start = sub.get("current_period_start") and \
                    datetime.utcfromtimestamp(sub["current_period_start"])
                local.current_period_end = sub.get("current_period_end") and \
                    datetime.utcfromtimestamp(sub["current_period_end"])
                local.cancel_at_period_end = bool(sub.get("cancel_at_period_end"))
                if etype == "customer.subscription.deleted":
                    local.end_date = datetime.utcfromtimestamp(sub.get("canceled_at")) if sub.get("canceled_at") else None
                db.session.commit()

        se.status = "processed"
        db.session.commit()
        return jsonify({"ok": True}), 200
    except Exception as e:
        se.status = "error"
        se.error = str(e)
        db.session.commit()
        return jsonify({"error": str(e)}), 500