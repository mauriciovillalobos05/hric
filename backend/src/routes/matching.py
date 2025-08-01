from flask import Blueprint, jsonify, session
from src.models.user import Users, Enterprise, InvestorProfile, MatchRecommendation, db
from datetime import datetime
from sqlalchemy import func

matching_bp = Blueprint('matching', __name__)

def require_auth():
    Users_id = session.get('Users_id')
    if not Users_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    Users = Users.query.get(Users_id)
    if not Users:
        return None, jsonify({'error': 'Users not found'}), 404
    return Users, None, None

def calculate_compatibility_score(profile, enterprise):
    score = 0
    reasons = []

    # Industry match
    if enterprise.industry in (profile.industries or []):
        score += 25
        reasons.append(f"Industry match: {enterprise.industry}")

    # Stage match
    if enterprise.stage in (profile.investment_stages or []):
        score += 20
        reasons.append(f"Stage match: {enterprise.stage}")

    # Investment range
    target = None
    if isinstance(enterprise.financials, dict):
        target = enterprise.financials.get('funding_goal')

    if profile.investment_range_min and profile.investment_range_max:
        if target and profile.investment_range_min <= target <= profile.investment_range_max:
            score += 20
            reasons.append(f"Funding goal in range: ${target:,}")

    # Geographic match
    if enterprise.owner and enterprise.owner.location:
        geo_matches = [
            g for g in (profile.geographic_focus or [])
            if g.lower() in enterprise.owner.location.lower()
        ]
        if geo_matches:
            score += 10
            reasons.append(f"Geographic match: {geo_matches[0]}")

    # Risk tolerance
    risk_map = {
        'high': ['idea', 'mvp'],
        'medium': ['early_revenue', 'growth'],
        'low': ['scale', 'mature']
    }
    if profile.risk_tolerance and enterprise.stage in risk_map.get(profile.risk_tolerance, []):
        score += 10
        reasons.append(f"Risk match: {profile.risk_tolerance} risk and {enterprise.stage} stage")

    # Strategic support
    if profile.advisory_availability and enterprise.is_actively_fundraising:
        score += 5
        reasons.append("Strategic support opportunity")

    return min(score, 100), reasons

@matching_bp.route('/matches', methods=['GET'])
def get_matches():
    investor, err, status = require_auth()
    if err:
        return err, status

    if investor.role != 'investor' or not investor.investor_profile:
        return jsonify({'error': 'Only investors with completed profiles can access matches'}), 403

    profile = investor.investor_profile

    # Clear old match recommendations for fresh generation (optional, or use timestamp threshold)
    MatchRecommendation.query.filter_by(Users_id=investor.id).delete()
    db.session.commit()

    enterprises = Enterprise.query \
        .join(Users, Users.id == Enterprise.Users_id) \
        .filter(Enterprise.is_actively_fundraising == True) \
        .all()

    matches = []
    for e in enterprises:
        score, reasons = calculate_compatibility_score(profile, e)
        if score >= 30:
            # Save to MatchRecommendation table
            recommendation = MatchRecommendation(
                Users_id=investor.id,
                enterprise_id=e.id,
                score=score,
                reasons=reasons,
                generated_at=datetime.utcnow()
            )
            db.session.add(recommendation)

            # Include in response
            e_data = e.to_dict()
            e_data['funding_goal'] = e.financials.get('funding_goal') if e.financials else None
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
    Users, err, status = require_auth()
    if err:
        return err, status

    if Users.role != 'investor':
        return jsonify({'error': 'Only investors can view cached recommendations'}), 403

    cached = MatchRecommendation.query \
        .filter_by(Users_id=Users.id, status='pending') \
        .join(Enterprise, Enterprise.id == MatchRecommendation.enterprise_id) \
        .filter(Enterprise.is_actively_fundraising == True) \
        .order_by(MatchRecommendation.score.desc()) \
        .all()

    matches = []
    for rec in cached:
        enterprise = rec.enterprise
        e_data = enterprise.to_dict()
        e_data['funding_goal'] = enterprise.financials.get('funding_goal') if enterprise.financials else None

        matches.append({
            'enterprise': e_data,
            'compatibility_score': rec.score,
            'reasons': rec.reasons,
            'status': rec.status,
            'generated_at': rec.generated_at.isoformat()
        })

    return jsonify({'matches': matches}), 200