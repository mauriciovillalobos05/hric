from flask import Blueprint, request, jsonify, session
from datetime import datetime
from src.models.user import db, User, Subscription
import stripe
import os

subscriptions_bp = Blueprint('subscriptions', __name__)

def require_auth():
    user_id = session.get('user_id')
    if not user_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    user = User.query.get(user_id)
    if not user:
        return None, jsonify({'error': 'User not found'}), 404
    return user, None, None

# Stripe setup
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Available plans (you should sync these with Stripe)
PLAN_CONFIG = {
    "free": {"name": "Free", "price_id": None},
    "starter": {"name": "Starter", "price_id": os.getenv("STRIPE_PRICE_STARTER")},
    "pro": {"name": "Pro", "price_id": os.getenv("STRIPE_PRICE_PRO")},
    "enterprise": {"name": "Enterprise", "price_id": os.getenv("STRIPE_PRICE_ENTERPRISE")}
}

# -----------------------------------------
# ROUTES
# -----------------------------------------

@subscriptions_bp.route('/plans', methods=['GET'])
def get_plans():
    return jsonify({
        'plans': [
            {'key': key, 'name': value['name'], 'price_id': value['price_id']}
            for key, value in PLAN_CONFIG.items()
        ]
    }), 200

@subscriptions_bp.route('/checkout', methods=['POST'])
def create_checkout_session():
    user, error, status = require_auth()
    if error: return error, status

    data = request.json
    plan_key = data.get("plan")

    if not plan_key or plan_key not in PLAN_CONFIG:
        return jsonify({'error': 'Invalid plan'}), 400

    price_id = PLAN_CONFIG[plan_key]["price_id"]
    if not price_id:
        return jsonify({'error': 'This plan does not require checkout'}), 400

    try:
        session = stripe.checkout.Session.create(
            success_url=os.getenv("FRONTEND_URL") + "/subscription/success",
            cancel_url=os.getenv("FRONTEND_URL") + "/subscription/cancel",
            payment_method_types=["card"],
            mode="subscription",
            customer_email=user.email,
            line_items=[{"price": price_id, "quantity": 1}],
            metadata={"user_id": str(user.id)}
        )
        return jsonify({'checkout_url': session.url}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@subscriptions_bp.route('/current', methods=['GET'])
def get_user_subscription():
    user, error, status = require_auth()
    if error: return error, status

    if not user.subscription:
        return jsonify({'plan': 'free'}), 200

    sub = user.subscription.to_dict()
    return jsonify({'subscription': sub}), 200

@subscriptions_bp.route('/change', methods=['POST'])
def change_plan():
    user, error, status = require_auth()
    if error: return error, status

    data = request.json
    new_plan = data.get("plan")

    if new_plan not in PLAN_CONFIG:
        return jsonify({'error': 'Invalid plan selected'}), 400

    # If using Stripe subscription objects, you'd modify them here.
    if user.subscription:
        user.subscription.plan = new_plan
        user.subscription.updated_at = datetime.utcnow()
    else:
        sub = Subscription(
            user_id=user.id,
            plan=new_plan,
            active=True,
            created_at=datetime.utcnow()
        )
        db.session.add(sub)

    db.session.commit()
    return jsonify({'message': 'Plan updated successfully'}), 200

@subscriptions_bp.route('/cancel', methods=['POST'])
def cancel_subscription():
    user, error, status = require_auth()
    if error: return error, status

    if user.subscription:
        user.subscription.active = False
        user.subscription.canceled_at = datetime.utcnow()
        db.session.commit()

    return jsonify({'message': 'Subscription cancelled'}), 200

# Stripe webhook (this should be exposed publicly to handle events like payment_success)
@subscriptions_bp.route('/stripe/webhook', methods=['POST'])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get('stripe-signature')
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    if event['type'] == 'checkout.session.completed':
        session_data = event['data']['object']
        metadata = session_data.get("metadata", {})
        user_id = metadata.get("user_id")

        user = User.query.get(user_id)
        if user:
            plan = next((key for key, cfg in PLAN_CONFIG.items() if cfg["price_id"] == session_data["display_items"][0]["price"]["id"]), "pro")
            sub = Subscription(
                user_id=user.id,
                plan=plan,
                active=True,
                stripe_customer_id=session_data["customer"],
                stripe_subscription_id=session_data["subscription"],
                created_at=datetime.utcnow()
            )
            db.session.add(sub)
            db.session.commit()

    return jsonify({'received': True}), 200