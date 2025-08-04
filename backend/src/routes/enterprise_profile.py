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
def create_or_update_enterprise_profile():
    user, error_response, status = require_auth()
    if error_response:
        return error_response, status

    data = request.json

    if user.role != 'entrepreneur':
        return jsonify({'error': 'Only entrepreneurs can create an enterprise profile'}), 403

    # Check if an enterprise already exists for this user
    enterprise = Enterprise.query.filter_by(user_id=user.id).first()

    if enterprise:
        # Update existing enterprise
        enterprise.name = data.get('name')
        enterprise.industry = data.get('industry')
        enterprise.stage = data.get('stage')
        enterprise.business_model = data.get('business_model')
        enterprise.team_size = data.get('team_size')
        enterprise.pitch_deck_url = data.get('pitch_deck_url')
        enterprise.demo_url = data.get('demo_url')
        enterprise.financials = data.get('financials')
        enterprise.target_market = data.get('target_market')
        enterprise.is_actively_fundraising = data.get('is_actively_fundraising', True)
    else:
        # Create new enterprise
        enterprise = Enterprise(
            user_id=user.id,
            name=data.get('name'),
            industry=data.get('industry'),
            stage=data.get('stage'),
            business_model=data.get('business_model'),
            team_size=data.get('team_size'),
            pitch_deck_url=data.get('pitch_deck_url'),
            demo_url=data.get('demo_url'),
            financials=data.get('financials'),
            target_market=data.get('target_market'),
            is_actively_fundraising=data.get('is_actively_fundraising', True),
        )
        db.session.add(enterprise)

    db.session.commit()

    # Link to most recent subscription if available
    try:
        subscription = Subscription.query.filter_by(user_id=user.id).order_by(Subscription.started_at.desc()).first()
        if subscription:
            subscription.enterprise_id = enterprise.id
            db.session.commit()
    except Exception as e:
        return jsonify({'error': f'Enterprise saved but failed to link subscription: {str(e)}'}), 500

    return jsonify({'message': 'Enterprise profile saved successfully'}), 200
