# enterprise_profile.py
from flask import Blueprint, request, jsonify
from datetime import datetime
from src.models.user import db, Users, Enterprise, Subscription
import stripe
import os
import requests

enterpriseprofile_bp = Blueprint('enterprises', __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

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

@enterpriseprofile_bp.route('/profile', methods=['POST'])
def create_enterprise_profile():
    user, error_response, status = require_auth()
    if error_response:
        return error_response, status

    data = request.json

    if user.role != 'entrepreneur':
        return jsonify({'error': 'Only entrepreneurs can create an enterprise profile'}), 403

    enterprise = Enterprise(
        user_id=user.id,
        name=data['name'],
        industry=data.get('industry'),
        stage=data.get('stage'),
        business_model=data.get('business_model'),
        team_size=data.get('team_size'),
        pitch_deck_url=data.get('pitch_deck_url'),
        demo_url=data.get('demo_url'),
        financials=data.get('financials'),
        target_market=data.get('target_market')
    )
    db.session.add(enterprise)
    db.session.commit()

    try:
        subscription = Subscription.query.filter_by(user_id=user.id).order_by(Subscription.started_at.desc()).first()
        if subscription:
            subscription.enterprise_id = enterprise.id
            db.session.commit()
    except Exception as e:
        return jsonify({'error': f'Enterprise created but failed to link subscription: {str(e)}'}), 500

    return jsonify({'message': 'Enterprise profile and subscription created successfully'}), 201