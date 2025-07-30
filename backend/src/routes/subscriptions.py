from flask import Blueprint, request, jsonify
from datetime import datetime
from src.models.user import db, Users, Subscription
import stripe
import os
import requests

subscriptions_bp = Blueprint('subscriptions', __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Supabase JWT auth
def require_auth():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, jsonify({"error": "Missing or invalid Authorization header"}), 401

    token = auth_header.split(" ")[1]

    try:
        resp = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY,
            },
        )
        if resp.status_code != 200:
            return None, jsonify({"error": "Invalid or expired token"}), 401

        supabase_user = resp.json()
        user_id = supabase_user["id"]
    except Exception as e:
        return None, jsonify({"error": f"Token verification failed: {str(e)}"}), 500

    user = Users.query.get(user_id)
    if not user:
        return None, jsonify({"error": "User not found in database"}), 404

    return user, None, None

PLAN_CONFIG = {
    "investor_basic": {
        "name": "Investor Basic",
        "price_id": os.getenv("STRIPE_PRICE_INVESTOR_BASIC"),
    },
    "investor_premium": {
        "name": "Investor Premium",
        "price_id": os.getenv("STRIPE_PRICE_INVESTOR_PREMIUM"),
    },
    "investor_vip": {
        "name": "Investor VIP",
        "price_id": os.getenv("STRIPE_PRICE_INVESTOR_VIP"),
    },
    "entrepreneur_free": {
        "name": "Entrepreneur Free",
        "price_id": None,
    },
    "entrepreneur_premium": {
        "name": "Entrepreneur Premium",
        "price_id": os.getenv("STRIPE_PRICE_ENTREPRENEUR_PREMIUM"),
    },
    "entrepreneur_enterprise": {
        "name": "Entrepreneur Enterprise",
        "price_id": os.getenv("STRIPE_PRICE_ENTREPRENEUR_ENTERPRISE"),
    },
}

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
    try:
        user, error, status = require_auth()
        if error:
            return error, status

        data = request.json
        plan_key = data.get("plan")
        if not plan_key or plan_key not in PLAN_CONFIG:
            return jsonify({'error': 'Invalid plan key'}), 400

        frontend_url = os.getenv("FRONTEND_URL")
        if not frontend_url:
            return jsonify({'error': 'FRONTEND_URL not set in environment'}), 500

        price_id = PLAN_CONFIG[plan_key]["price_id"]

        if not price_id:
            # Handle free plans (e.g., Entrepreneur Free)
            if plan_key == "entrepreneur_free":
                success_path = "complete-profile/entrepreneur"
                return jsonify({'redirect_url': frontend_url + success_path}), 200
            else:
                return jsonify({'error': 'This plan does not require checkout'}), 400

        # Determine success path by role
        if user.role == 'investor':
            success_path = "complete-profile/investor"
        elif user.role == 'entrepreneur':
            success_path = "complete-profile/entrepreneur"
        else:
            return jsonify({'error': 'Unsupported user role'}), 400

        stripe_session = stripe.checkout.Session.create(
            success_url=frontend_url + success_path,
            cancel_url=frontend_url + "/subscription/cancel",
            payment_method_types=["card"],
            mode="subscription",
            customer_email=user.email,
            line_items=[{"price": price_id, "quantity": 1}],
            metadata={
                "user_id": str(user.id),
                "price_id": price_id,
                "plan_key": plan_key
            }
        )

        return jsonify({'checkout_url': stripe_session.url}), 200

    except Exception as e:
        print("Stripe checkout error:", e)
        return jsonify({'error': str(e)}), 500

@subscriptions_bp.route('/current', methods=['GET'])
def get_user_subscription():
    user, error, status = require_auth()
    if error: return error, status

    if not user.subscription:
        return jsonify({'tier': 'free'}), 200

    return jsonify({'subscription': user.subscription.to_dict()}), 200

@subscriptions_bp.route('/change', methods=['POST'])
def change_plan():
    user, error, status = require_auth()
    if error: return error, status

    data = request.json
    new_tier = data.get("plan")
    if new_tier not in PLAN_CONFIG:
        return jsonify({'error': 'Invalid plan selected'}), 400

    enterprise_id = user.enterprises[0].id if user.role == "entrepreneur" and user.enterprises else None

    if user.subscription:
        user.subscription.tier = new_tier
        user.subscription.status = 'active'
        user.subscription.started_at = datetime.utcnow()
    else:
        new_sub = Subscription(
            user_id=user.id,
            enterprise_id=enterprise_id,
            tier=new_tier,
            status='active',
            started_at=datetime.utcnow()
        )
        db.session.add(new_sub)

    db.session.commit()
    return jsonify({'message': 'Plan updated successfully'}), 200

@subscriptions_bp.route('/cancel', methods=['POST'])
def cancel_subscription():
    user, error, status = require_auth()
    if error: return error, status

    if user.subscription:
        user.subscription.status = 'cancelled'
        user.subscription.canceled_at = datetime.utcnow()
        db.session.commit()

    return jsonify({'message': 'Subscription cancelled'}), 200

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
        price_id = metadata.get("price_id")

        user = Users.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        tier = next((key for key, cfg in PLAN_CONFIG.items() if cfg["price_id"] == price_id), None)
        if not tier:
            return jsonify({'error': 'Invalid price_id'}), 400

        stripe_subscription_id = session_data.get("subscription")
        stripe_customer_id = session_data.get("customer")

        try:
            stripe_sub = stripe.Subscription.retrieve(stripe_subscription_id)
        except Exception as e:
            return jsonify({'error': f'Stripe subscription retrieval failed: {str(e)}'}), 400

        enterprise_id = user.enterprises[0].id if user.role == "entrepreneur" and user.enterprises else None

        existing = Subscription.query.filter_by(
            user_id=user.id,
            stripe_subscription_id=stripe_subscription_id
        ).first()

        if not existing:
            new_sub = Subscription(
                user_id=user.id,
                enterprise_id=enterprise_id,
                tier=tier,
                status=stripe_sub.status,
                stripe_customer_id=stripe_customer_id,
                stripe_subscription_id=stripe_subscription_id,
                started_at=datetime.utcfromtimestamp(stripe_sub.current_period_start),
                ended_at=datetime.utcfromtimestamp(stripe_sub.current_period_end)
            )
            db.session.add(new_sub)
            db.session.commit()

    elif event['type'] == 'customer.subscription.updated':
        sub_data = event['data']['object']
        stripe_subscription_id = sub_data['id']
        new_status = sub_data['status']
        new_start = datetime.utcfromtimestamp(sub_data['current_period_start'])
        new_end = datetime.utcfromtimestamp(sub_data['current_period_end'])
        new_price_id = sub_data['items']['data'][0]['price']['id']

        tier = next((key for key, cfg in PLAN_CONFIG.items() if cfg["price_id"] == new_price_id), None)

        subscription = Subscription.query.filter_by(stripe_subscription_id=stripe_subscription_id).first()
        if subscription:
            subscription.status = new_status
            subscription.tier = tier
            subscription.started_at = new_start
            subscription.ended_at = new_end
            db.session.commit()

    elif event['type'] == 'customer.subscription.deleted':
        sub_data = event['data']['object']
        stripe_subscription_id = sub_data['id']

        subscription = Subscription.query.filter_by(stripe_subscription_id=stripe_subscription_id).first()
        if subscription:
            subscription.status = 'cancelled'
            subscription.ended_at = datetime.utcnow()
            db.session.commit()

    return jsonify({'received': True}), 200