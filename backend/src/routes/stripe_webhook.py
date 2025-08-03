from flask import Blueprint, request, jsonify
from ..models.user import db, Users, Subscription
import stripe
import os
from datetime import datetime

stripe_bp = Blueprint("stripe", __name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")  # from Stripe dashboard

@stripe_bp.route("/webhook", methods=["POST"])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, WEBHOOK_SECRET
        )
    except ValueError:
        return jsonify({"error": "Invalid payload"}), 400
    except stripe.error.SignatureVerificationError:
        return jsonify({"error": "Invalid signature"}), 400

    # === Handle Checkout Completion ===
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {})

        user_id = metadata.get("user_id")
        plan_key = metadata.get("plan_key")

        if not user_id or not plan_key:
            return jsonify({"error": "Missing metadata in session"}), 400

        user = Users.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        stripe_subscription_id = session.get("subscription")
        stripe_customer_id = session.get("customer")

        if not stripe_subscription_id:
            return jsonify({"error": "Missing subscription ID"}), 400

        # Check if this Stripe subscription already exists
        existing = Subscription.query.filter_by(stripe_subscription_id=stripe_subscription_id).first()

        if existing:
            # Update existing subscription
            existing.tier = plan_key
            existing.status = "active"
            existing.started_at = datetime.utcnow()
            existing.ended_at = None
            db.session.commit()
            return jsonify({"message": "Subscription updated"}), 200
        else:
            # Insert new subscription
            enterprise_id = (
                user.enterprises[0].id if user.role == "entrepreneur" and user.enterprises else None
            )

            new_sub = Subscription(
                user_id=user.id,
                enterprise_id=enterprise_id,
                tier=plan_key,
                status="active",
                stripe_customer_id=stripe_customer_id,
                stripe_subscription_id=stripe_subscription_id,
                started_at=datetime.utcnow(),
                ended_at=None
            )
            db.session.add(new_sub)
            db.session.commit()
            return jsonify({"message": "Subscription created"}), 201

    # === Handle Payment Failure ===
    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        subscription_id = invoice.get("subscription")

        if subscription_id:
            sub = Subscription.query.filter_by(stripe_subscription_id=subscription_id).first()
            if sub:
                sub.status = "inactive"
                db.session.commit()

        return jsonify({"message": "Payment failure handled"}), 200

    # === Handle Subscription Cancellation ===
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        subscription_id = subscription["id"]

        sub = Subscription.query.filter_by(stripe_subscription_id=subscription_id).first()
        if sub:
            sub.status = "cancelled"
            sub.ended_at = datetime.utcnow()
            db.session.commit()

        return jsonify({"message": "Subscription cancelled"}), 200

    return jsonify({"message": "Event received"}), 200