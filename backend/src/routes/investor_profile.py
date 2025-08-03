#investor_profile.py
from flask import Blueprint, request, jsonify
from datetime import datetime
from ..models.user import db, Users, InvestorProfile, Subscription
import stripe
import os
import requests
from datetime import datetime

investorprofile_bp = Blueprint('investors', __name__)

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

@investorprofile_bp.route('/profile', methods=['POST', 'OPTIONS'])
def create_investor_profile():
    if request.method == 'OPTIONS':
        return '', 200  # Preflight OK

    user, error_response, status = require_auth()
    if error_response:
        return error_response, status

    if user.role != 'investor':
        return jsonify({'error': 'Only investors can create an investor profile'}), 403

    #Prevent duplicate profile
    existing_profile = InvestorProfile.query.filter_by(user_id=user.id).first()
    if existing_profile:
        return jsonify({'error': 'Investor profile already exists'}), 400

    data = request.json

    profile = InvestorProfile(
        user_id=user.id,
        industries=data.get('industries', []),
        investment_stages=data.get('investment_stages', []),
        geographic_focus=data.get('geographic_focus', []),
        investment_range_min=data.get('investment_range_min'),
        investment_range_max=data.get('investment_range_max'),
        accredited_status=data.get('accredited_status', False),
        investor_type=data.get('investor_type'),
        risk_tolerance=data.get('risk_tolerance'),
        portfolio_size=data.get('portfolio_size'),
        advisory_availability=data.get('advisory_availability', False),
        communication_frequency=data.get('communication_frequency'),
        meeting_preference=data.get('meeting_preference')
    )

    db.session.add(profile)
    db.session.commit()

    return jsonify({'message': 'Investor profile created successfully'}), 201