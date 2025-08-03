from flask import Blueprint, jsonify, request, session
from ..models.user import Users, Enterprise, InvestorProfile, Like, MatchRecommendation, db
from datetime import datetime

investor_bp = Blueprint('investor', __name__)

# ---------- AUTH HELPERS ----------
def require_auth():
    Users_id = session.get('Users_id')
    if not Users_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    Users = Users.query.get(Users_id)
    if not Users:
        return None, jsonify({'error': 'Users not found'}), 404
    return Users, None, None

def require_investor_auth():
    Users, err, status = require_auth()
    if err:
        return None, err, status
    if Users.role != 'investor':
        return None, jsonify({'error': 'Investor access required'}), 403
    return Users, None, None

# ---------- PROFILE ----------
@investor_bp.route('/me', methods=['GET'])
def get_investor_profile():
    Users, err, status = require_investor_auth()
    if err:
        return err, status

    profile = Users.investor_profile
    data = Users.to_dict()
    if profile:
        data['profile'] = profile.to_dict()

    return jsonify({'Users': data}), 200

@investor_bp.route('/me', methods=['PUT'])
def update_investor_profile():
    Users, err, status = require_investor_auth()
    if err:
        return err, status

    profile = Users.investor_profile
    if not profile:
        profile = InvestorProfile(Users_id=Users.id)
        db.session.add(profile)

    data = request.json
    allowed = [
        'industries', 'investment_stages', 'geographic_focus',
        'investment_range_min', 'investment_range_max', 'accredited_status',
        'investor_type', 'risk_tolerance', 'portfolio_size',
        'advisory_availability', 'communication_frequency', 'meeting_preference'
    ]
    for field in allowed:
        if field in data:
            setattr(profile, field, data[field])

    db.session.commit()
    return jsonify({'message': 'Profile updated', 'profile': profile.to_dict()}), 200

# ---------- STARTUP BROWSING ----------
@investor_bp.route('/startups', methods=['GET'])
def browse_startups():
    Users, err, status = require_investor_auth()
    if err:
        return err, status

    industry = request.args.get('industry')
    stage = request.args.get('stage')
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)

    query = Enterprise.query.filter_by(is_actively_fundraising=True)
    if industry:
        query = query.filter(Enterprise.industry.ilike(f'%{industry}%'))
    if stage:
        query = query.filter(Enterprise.stage == stage)

    pagination = query.order_by(Enterprise.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    results = [e.to_dict() for e in pagination.items]

    return jsonify({
        'startups': results,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    }), 200

# ---------- MATCH RECOMMENDATIONS ----------
@investor_bp.route('/matches', methods=['GET'])
def get_match_recommendations():
    Users, err, status = require_investor_auth()
    if err:
        return err, status

    matches = MatchRecommendation.query \
        .filter_by(Users_id=Users.id, status='pending') \
        .order_by(MatchRecommendation.score.desc()) \
        .all()

    results = []
    for match in matches:
        enterprise = match.enterprise
        data = enterprise.to_dict()
        data['funding_goal'] = enterprise.financials.get('funding_goal') if enterprise.financials else None
        results.append({
            'enterprise': data,
            'compatibility_score': match.score,
            'reasons': match.reasons,
            'match_id': match.id
        })

    return jsonify({'matches': results}), 200

# ---------- LIKE STARTUPS ----------
@investor_bp.route('/startups/<int:enterprise_id>/like', methods=['POST'])
def like_startup(enterprise_id):
    Users, err, status = require_investor_auth()
    if err:
        return err, status

    enterprise = Enterprise.query.get(enterprise_id)
    if not enterprise:
        return jsonify({'error': 'Startup not found'}), 404

    if Like.query.filter_by(Users_id=Users.id, enterprise_id=enterprise_id).first():
        return jsonify({'message': 'Already liked'}), 200

    like = Like(Users_id=Users.id, enterprise_id=enterprise_id)
    db.session.add(like)
    db.session.commit()

    return jsonify({'message': 'Startup liked'}), 201

@investor_bp.route('/startups/<int:enterprise_id>/unlike', methods=['DELETE'])
def unlike_startup(enterprise_id):
    Users, err, status = require_investor_auth()
    if err:
        return err, status

    like = Like.query.filter_by(Users_id=Users.id, enterprise_id=enterprise_id).first()
    if not like:
        return jsonify({'message': 'Not previously liked'}), 404

    db.session.delete(like)
    db.session.commit()

    return jsonify({'message': 'Startup unliked'}), 200

# ---------- INTEREST/DECISION ----------
@investor_bp.route('/matches/<int:match_id>/interest', methods=['POST'])
def express_interest_in_startup(match_id):
    Users, err, status = require_investor_auth()
    if err:
        return err, status

    match = MatchRecommendation.query.get(match_id)
    if not match or match.Users_id != Users.id:
        return jsonify({'error': 'Match not found or unauthorized'}), 404

    data = request.json
    decision = data.get('interest')  # 'interested', 'not_interested'
    if decision not in ['interested', 'not_interested']:
        return jsonify({'error': 'Invalid interest value'}), 400

    match.status = 'accepted' if decision == 'interested' else 'declined'
    db.session.commit()

    return jsonify({'message': 'Interest recorded', 'match': match.to_dict()}), 200

# ---------- DASHBOARD ANALYTICS ----------
@investor_bp.route('/dashboard/stats', methods=['GET'])
def investor_dashboard():
    Users, err, status = require_investor_auth()
    if err:
        return err, status

    total_matches = MatchRecommendation.query.filter_by(Users_id=Users.id).count()
    accepted = MatchRecommendation.query.filter_by(Users_id=Users.id, status='accepted').count()
    declined = MatchRecommendation.query.filter_by(Users_id=Users.id, status='declined').count()
    likes = Like.query.filter_by(Users_id=Users.id).count()

    return jsonify({
        'stats': {
            'total_matches': total_matches,
            'accepted_matches': accepted,
            'declined_matches': declined,
            'liked_startups': likes,
            'accept_rate': (accepted / total_matches * 100) if total_matches else 0
        }
    }), 200