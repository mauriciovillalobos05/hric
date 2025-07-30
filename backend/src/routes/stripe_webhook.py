from flask import Blueprint, request, jsonify
from src.models.user import db, Users, Subscription
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

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"].get("user_id")
        plan = session["metadata"].get("plan_key")

        if not user_id or not plan:
            return jsonify({"error": "Missing metadata in session"}), 400

        user = Users.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        existing = Subscription.query.filter_by(
            user_id=user.id,
            stripe_subscription_id=session["subscription"]
        ).first()
        if existing:
            return jsonify({"message": "Subscription already exists"}), 200

        sub = Subscription(
            user_id=user.id,
            enterprise_id = user.enterprises[0].id if user.role == "entrepreneur" and user.enterprises else None,
            tier=plan,
            status="active",
            stripe_customer_id=session["customer"],
            stripe_subscription_id=session["subscription"],
            started_at=datetime.utcnow(),
            ended_at=None
        )
        db.session.add(sub)
        db.session.commit()

        return jsonify({"message": "Subscription created"}), 201

    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        subscription_id = invoice.get("subscription")

        if subscription_id:
            sub = Subscription.query.filter_by(stripe_subscription_id=subscription_id).first()
            if sub:
                sub.status = "inactive"
                db.session.commit()

        return jsonify({"message": "Payment failure handled"}), 200

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