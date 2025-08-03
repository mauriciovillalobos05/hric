from flask import Blueprint, request, jsonify
from ..models.user import Users, Enterprise, InvestorProfile, MatchRecommendation, db
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

    # 4. Geographic focus match (precise and correct match reason)
    matched_geo = next(
        (g for g in profile.geographic_focus if g.lower().strip() == (enterprise.owner.location or "").lower().strip()),
        None
    )
    if matched_geo:
        score += 10
        reasons.append(f"Geographic match: {matched_geo}")


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
def generate_and_return_matches():
    user, err, status = require_auth()
    if err:
        return err, status

    matches = []
    threshold = 30

    if user.role == 'investor' and user.investor_profile:
        profile = user.investor_profile

        enterprises = Enterprise.query \
            .join(Users, Users.id == Enterprise.user_id) \
            .filter(Enterprise.is_actively_fundraising == True) \
            .all()

        for e in enterprises:
            score, reasons = calculate_compatibility_score(profile, e)
            existing = MatchRecommendation.query.filter_by(
                user_id=user.id,
                enterprise_id=e.id
            ).first()

            if score >= threshold:
                if not existing:
                    rec = MatchRecommendation(
                        user_id=user.id,
                        enterprise_id=e.id,
                        score=score,
                        reasons=reasons,
                        generated_at=datetime.utcnow()
                    )
                    db.session.add(rec)
            elif existing:
                db.session.delete(existing)

        db.session.commit()

        # Return current matches for this investor
        cached = MatchRecommendation.query \
            .filter_by(user_id=user.id, status='pending') \
            .join(Enterprise, Enterprise.id == MatchRecommendation.enterprise_id) \
            .filter(Enterprise.is_actively_fundraising == True) \
            .order_by(MatchRecommendation.score.desc()) \
            .all()

        for rec in cached:
            e = rec.enterprise
            e_data = e.to_dict(include_founder=True)
            e_data['funding_goal'] = (
                e.financials.get('funding_goal') if e.financials else float(e.funding_needed or 0)
            )
            matches.append({
                'enterprise': e_data,
                'compatibility_score': rec.score,
                'reasons': rec.reasons,
                'status': rec.status,
                'generated_at': rec.generated_at.isoformat()
            })

    elif user.role == 'entrepreneur':
        enterprise = Enterprise.query.filter_by(user_id=user.id).first()
        if not enterprise:
            return jsonify({'error': 'Entrepreneur must have an enterprise'}), 400

        investors = Users.query \
            .filter_by(role='investor') \
            .join(InvestorProfile, Users.id == InvestorProfile.user_id) \
            .all()

        for investor in investors:
            profile = investor.investor_profile
            if not profile:
                continue

            score, reasons = calculate_compatibility_score(profile, enterprise)
            existing = MatchRecommendation.query.filter_by(
                user_id=investor.id,
                enterprise_id=enterprise.id
            ).first()

            if score >= threshold:
                if not existing:
                    rec = MatchRecommendation(
                        user_id=investor.id,
                        enterprise_id=enterprise.id,
                        score=score,
                        reasons=reasons,
                        generated_at=datetime.utcnow()
                    )
                    db.session.add(rec)
            elif existing:
                db.session.delete(existing)

        db.session.commit()

        # Return current matches for this enterprise
        cached = MatchRecommendation.query \
            .join(Enterprise, Enterprise.id == MatchRecommendation.enterprise_id) \
            .join(Users, Users.id == MatchRecommendation.user_id) \
            .filter(
                Enterprise.user_id == user.id,
                MatchRecommendation.status == 'pending'
            ) \
            .order_by(MatchRecommendation.score.desc()) \
            .all()

        for rec in cached:
            investor_user = Users.query.get(rec.user_id)
            if not investor_user:
                continue

            matches.append({
                'investor': {
                    'first_name': investor_user.first_name or "Unnamed",
                    'last_name': investor_user.last_name or "Investor",
                    'location': investor_user.location or "Unknown",
                    'profile_image': investor_user.profile_image
                },
                'compatibility_score': rec.score,
                'reasons': rec.reasons,
                'status': rec.status,
                'generated_at': rec.generated_at.isoformat()
            })

    else:
        return jsonify({'error': 'Only investors or entrepreneurs with valid profiles can access matches'}), 403

    return jsonify({'matches': matches}), 200