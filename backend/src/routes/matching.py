from flask import Blueprint, request, jsonify
from src.models.user import Users, Enterprise, InvestorProfile, MatchRecommendation, db
from datetime import datetime
from sqlalchemy import func
import requests
import os

matching_bp = Blueprint('matching', __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

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


def calculate_compatibility_score(profile: InvestorProfile, enterprise: Enterprise):
    score = 0
    reasons = []

    # 1. Industry match
    if enterprise.industry in (profile.industries or []):
        score += 25
        reasons.append(f"Industry match: {enterprise.industry}")

    # 2. Stage match
    if enterprise.stage in (profile.investment_stages or []):
        score += 20
        reasons.append(f"Stage match: {enterprise.stage}")

    # 3. Investment range match (use financials.funding_goal or fallback to funding_needed)
    target = None
    if isinstance(enterprise.financials, dict):
        target = enterprise.financials.get('funding_goal')
    if not target and enterprise.funding_needed:
        target = float(enterprise.funding_needed)

    if target and profile.investment_range_min and profile.investment_range_max:
        if profile.investment_range_min <= target <= profile.investment_range_max:
            score += 20
            reasons.append(f"Funding goal in range: ${target:,.0f}")

    # 4. Geographic focus match
    if enterprise.owner and enterprise.owner.location and profile.geographic_focus:
        for g in profile.geographic_focus:
            if g.lower() in enterprise.owner.location.lower():
                score += 10
                reasons.append(f"Geographic match: {g}")
                break

    # 5. Risk tolerance logic
    risk_map = {
        'high': ['idea', 'mvp'],
        'medium': ['early_revenue', 'growth'],
        'low': ['scale', 'mature']
    }
    if profile.risk_tolerance and enterprise.stage in risk_map.get(profile.risk_tolerance, []):
        score += 10
        reasons.append(f"Risk tolerance match: {profile.risk_tolerance} vs. {enterprise.stage}")

    # 6. Advisory support
    if profile.advisory_availability and enterprise.is_actively_fundraising:
        score += 5
        reasons.append("Strategic support opportunity")

    return min(score, 100), reasons


@matching_bp.route('/matches', methods=['GET'])
def generate_matches():
    user, err, status = require_auth()
    if err:
        return err, status

    if user.role != 'investor' or not user.investor_profile:
        return jsonify({'error': 'Only investors with completed profiles can access matches'}), 403

    profile = user.investor_profile

    # Optional: delete previous recommendations for regeneration
    MatchRecommendation.query.filter_by(user_id=user.id).delete()
    db.session.commit()

    enterprises = Enterprise.query \
        .join(Users, Users.id == Enterprise.user_id) \
        .filter(Enterprise.is_actively_fundraising == True) \
        .all()

    matches = []
    for e in enterprises:
        score, reasons = calculate_compatibility_score(profile, e)
        if score >= 30:
            recommendation = MatchRecommendation(
                user_id=user.id,
                enterprise_id=e.id,
                score=score,
                reasons=reasons,
                generated_at=datetime.utcnow()
            )
            db.session.add(recommendation)

            e_data = e.to_dict(user=user)
            e_data['funding_goal'] = e.financials.get('funding_goal') if e.financials else float(e.funding_needed or 0)
            matches.append({
                'enterprise': e_data,
                'compatibility_score': score,
                'reasons': reasons
            })

    db.session.commit()
    matches.sort(key=lambda x: x['compatibility_score'], reverse=True)
    return jsonify({'matches': matches}), 200


@matching_bp.route('/matches/recommendations', methods=['GET'])
def get_cached_matches():
    user, err, status = require_auth()
    if err:
        return err, status

    if user.role != 'investor':
        return jsonify({'error': 'Only investors can view cached recommendations'}), 403

    cached = MatchRecommendation.query \
        .filter_by(user_id=user.id, status='pending') \
        .join(Enterprise, Enterprise.id == MatchRecommendation.enterprise_id) \
        .filter(Enterprise.is_actively_fundraising == True) \
        .order_by(MatchRecommendation.score.desc()) \
        .all()

    matches = []
    for rec in cached:
        e = rec.enterprise
        e_data = e.to_dict(include_founder=True)
        e_data['funding_goal'] = e.financials.get('funding_goal') if e.financials else float(e.funding_needed or 0)

        matches.append({
            'enterprise': e_data,
            'compatibility_score': rec.score,
            'reasons': rec.reasons,
            'status': rec.status,
            'generated_at': rec.generated_at.isoformat()
        })

    return jsonify({'matches': matches}), 200

@matching_bp.route('/matches/investors', methods=['GET'])
def get_investor_for_enterprise():
    user, err, status = require_auth()
    if err:
        return err, status
    
    if user.role != 'entrepreneur':
        return jsonify({'error': 'Only entrepreneurs can view investor matches'}), 403
    
    # Fetch the enterprise for the current user
    enterprise = Enterprise.query.filter_by(user_id=user.id).first()
    if not enterprise:
        return jsonify({'error': 'Enterprise not found for this user'}), 404
    
    recs = MatchRecommendation.query \
        .filter_by(enterprise_id=enterprise.id, status='pending') \
        .join(Users, Users.id == MatchRecommendation.user_id) \
        .outerjoin(InvestorProfile, InvestorProfile.user_id == Users.id) \
        .order_by(MatchRecommendation.score.desc()) \
        .all()
    
    matches = []
    for rec in recs:
        investor = rec.user
        profile = investor.investor_profile
        
        matches.append({
            "investor": {
                "id": investor.id,
                "first_name": investor.first_name,
                "last_name": investor.last_name,
                "email": investor.email,
                "location": investor.location,
                "profile_image": investor.profile_image,
                "investor_type": profile.investor_type if profile else None,
                "industries": profile.industries if profile else [],
                "investment_stages": profile.investment_stages if profile else [],
            },
            "compatibility_score": rec.score,
            "match_reasons": rec.reasons,
            "generated_at": rec.generated_at.isoformat(),
        })

    return jsonify({"matches": matches}), 200
    
    
    
