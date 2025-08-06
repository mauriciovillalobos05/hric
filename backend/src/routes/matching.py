from flask import Blueprint, request, jsonify
from ..models.user import Users, Enterprise, InvestorProfile, MatchRecommendation, db
from datetime import datetime, timedelta
from sqlalchemy import func, and_
import requests
import os
from sqlalchemy.orm import joinedload
from rapidfuzz import fuzz
import json

matching_bp = Blueprint('matching', __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

MATCH_REFRESH_INTERVAL_MINUTES = 10
MATCH_SCORE_THRESHOLD = 30

def require_auth():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, jsonify({"error": "Missing or invalid Authorization header"}), 401

    token = auth_header.split(" ")[1]
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
        )
        if resp.status_code != 200:
            return None, jsonify({"error": "Invalid or expired token"}), 401
        user_id = resp.json()["id"]
    except Exception as e:
        return None, jsonify({"error": f"Token verification failed: {str(e)}"}), 500

    user = Users.query.get(user_id)
    if not user:
        return None, jsonify({"error": "User not found in database"}), 404

    return user, None, None

def fuzzy_match_score(a, b):
    if not a or not b:
        return 0
    return fuzz.token_set_ratio(a.lower(), b.lower())

def fuzzy_list_match_score(target, candidates, threshold=70):
    if not target or not candidates:
        return 0
    scores = [fuzzy_match_score(target, c) for c in candidates]
    best_score = max(scores) if scores else 0
    return best_score if best_score >= threshold else 0

def calculate_compatibility_score(profile: InvestorProfile, enterprise: Enterprise):
    score = 0
    reasons = []

    # Fuzzy industry match
    industry_score = fuzzy_list_match_score(enterprise.industry, profile.industries)
    if industry_score:
        score += 25
        reasons.append(f"Industry match: {enterprise.industry} ({industry_score}%)")

    # Fuzzy stage match
    stage_score = fuzzy_list_match_score(enterprise.stage, profile.investment_stages)
    if stage_score:
        score += 20
        reasons.append(f"Stage match: {enterprise.stage} ({stage_score}%)")

    # Fuzzy location match
    location_score = fuzzy_list_match_score(enterprise.location, profile.geographic_focus)
    if location_score:
        score += 10
        reasons.append(f"Location match: {enterprise.location} ({location_score}%)")

    # Funding range match
    financials = enterprise.financials
    if isinstance(financials, str):
        try:
            financials = json.loads(financials)
        except Exception:
            financials = {}

    target_funding = financials.get('funding_goal') if financials else None
    if not target_funding and enterprise.funding_needed:
        target_funding = float(enterprise.funding_needed)

    if (
        target_funding and
        profile.investment_range_min is not None and
        profile.investment_range_max is not None
    ):
        if profile.investment_range_min <= target_funding <= profile.investment_range_max:
            score += 20
            reasons.append(f"Funding goal in range: ${target_funding:,.0f}")

    # Risk tolerance mapping
    risk_map = {
        'high': ['idea', 'pre-seed', 'mvp'],
        'medium': ['early', 'seed', 'series a'],
        'low': ['growth', 'series b', 'series c', 'ipo', 'scale']
    }
    if profile.risk_tolerance and enterprise.stage:
        stage = enterprise.stage.lower()
        tolerance = profile.risk_tolerance.lower()
        if stage in risk_map.get(tolerance, []):
            score += 10
            reasons.append(f"Risk match: {tolerance} aligns with stage {enterprise.stage}")

    # Advisory availability
    if profile.advisory_availability and enterprise.is_actively_fundraising:
        score += 5
        reasons.append("Strategic support available")

    return min(score, 100), reasons

@matching_bp.route('/matches', methods=['GET'])
def generate_and_return_matches():
    user, err, status = require_auth()
    if err:
        return err, status

    now = datetime.utcnow()
    matches = []

    # RATE LIMITING: only refresh every 10 minutes per user
    latest_match = MatchRecommendation.query.filter_by(user_id=user.id).order_by(MatchRecommendation.generated_at.desc()).first()
    if latest_match and (now - latest_match.generated_at) < timedelta(minutes=MATCH_REFRESH_INTERVAL_MINUTES):
        should_refresh = False
    else:
        should_refresh = True

    if user.role == 'investor' and user.investor_profile:
        profile = user.investor_profile

        if should_refresh:
            enterprises = Enterprise.query \
                .join(Users, Users.id == Enterprise.user_id) \
                .filter(Enterprise.is_actively_fundraising == True) \
                .all()

            for e in enterprises:
                score, reasons = calculate_compatibility_score(profile, e)
                existing = MatchRecommendation.query.filter_by(user_id=user.id, enterprise_id=e.id).first()

                if score >= MATCH_SCORE_THRESHOLD:
                    if not existing:
                        db.session.add(MatchRecommendation(
                            user_id=user.id,
                            enterprise_id=e.id,
                            score=score,
                            reasons=reasons,
                            generated_at=now
                        ))
                elif existing:
                    db.session.delete(existing)

            db.session.commit()

        cached_matches = MatchRecommendation.query \
            .filter_by(user_id=user.id, status='pending') \
            .join(Enterprise, Enterprise.id == MatchRecommendation.enterprise_id) \
            .filter(Enterprise.is_actively_fundraising == True) \
            .order_by(MatchRecommendation.score.desc()) \
            .all()

        for rec in cached_matches:
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

        if should_refresh:
            investors = Users.query \
                .filter_by(role='investor') \
                .join(InvestorProfile, Users.id == InvestorProfile.user_id) \
                .all()

            for investor in investors:
                profile = investor.investor_profile
                if not profile:
                    continue

                score, reasons = calculate_compatibility_score(profile, enterprise)
                existing = MatchRecommendation.query.filter_by(user_id=investor.id, enterprise_id=enterprise.id).first()

                if score >= MATCH_SCORE_THRESHOLD:
                    if not existing:
                        db.session.add(MatchRecommendation(
                            user_id=investor.id,
                            enterprise_id=enterprise.id,
                            score=score,
                            reasons=reasons,
                            generated_at=now
                        ))
                elif existing:
                    db.session.delete(existing)

            db.session.commit()

        cached_matches = MatchRecommendation.query \
            .join(Enterprise, Enterprise.id == MatchRecommendation.enterprise_id) \
            .join(Users, Users.id == MatchRecommendation.user_id) \
            .filter(
                Enterprise.user_id == user.id,
                MatchRecommendation.status == 'pending'
            ) \
            .order_by(MatchRecommendation.score.desc()) \
            .all()

        for rec in cached_matches:
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

    return jsonify({
        'matches': matches,
        'last_refreshed': latest_match.generated_at.isoformat() if latest_match else None,
        'refreshed_now': should_refresh
    }), 200