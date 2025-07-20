from flask import Blueprint, jsonify, request, session
from src.models.user import User, InvestorProfile, EntrepreneurProfile, Match, db
from sqlalchemy import and_, or_

investor_bp = Blueprint('investor', __name__)

def require_auth():
    user_id = session.get('user_id')
    if not user_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    
    user = User.query.get(user_id)
    if not user:
        return None, jsonify({'error': 'User not found'}), 404
    
    return user, None, None

def require_investor_auth():
    user, error_response, status_code = require_auth()
    if error_response:
        return user, error_response, status_code
    
    if user.user_type != 'investor':
        return None, jsonify({'error': 'Investor access required'}), 403
    
    return user, None, None

@investor_bp.route('/profile', methods=['GET'])
def get_investor_profile():
    try:
        user, error_response, status_code = require_investor_auth()
        if error_response:
            return error_response, status_code
        
        if not user.investor_profile:
            return jsonify({'error': 'Investor profile not found'}), 404
        
        profile_data = user.investor_profile.to_dict()
        profile_data['user'] = user.to_dict()
        
        return jsonify({'profile': profile_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@investor_bp.route('/entrepreneurs', methods=['GET'])
def browse_entrepreneurs():
    try:
        user, error_response, status_code = require_investor_auth()
        if error_response:
            return error_response, status_code
        
        # Get query parameters for filtering
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        industry = request.args.get('industry')
        stage = request.args.get('stage')
        funding_stage = request.args.get('funding_stage')
        location = request.args.get('location')
        min_funding = request.args.get('min_funding', type=int)
        max_funding = request.args.get('max_funding', type=int)
        actively_fundraising = request.args.get('actively_fundraising', type=bool)
        
        # Build query
        query = db.session.query(User).join(EntrepreneurProfile).filter(
            User.user_type == 'entrepreneur',
            User.is_active == True
        )
        
        # Apply filters
        if industry:
            query = query.filter(EntrepreneurProfile.industry == industry)
        
        if stage:
            query = query.filter(EntrepreneurProfile.stage == stage)
        
        if funding_stage:
            query = query.filter(EntrepreneurProfile.funding_stage == funding_stage)
        
        if location:
            query = query.filter(EntrepreneurProfile.location.ilike(f'%{location}%'))
        
        if min_funding:
            query = query.filter(EntrepreneurProfile.funding_amount_seeking >= min_funding)
        
        if max_funding:
            query = query.filter(EntrepreneurProfile.funding_amount_seeking <= max_funding)
        
        if actively_fundraising is not None:
            query = query.filter(EntrepreneurProfile.is_actively_fundraising == actively_fundraising)
        
        # Execute paginated query
        entrepreneurs = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        # Format response
        result = []
        for entrepreneur in entrepreneurs.items:
            entrepreneur_data = entrepreneur.to_dict()
            if entrepreneur.entrepreneur_profile:
                entrepreneur_data['profile'] = entrepreneur.entrepreneur_profile.to_dict()
            result.append(entrepreneur_data)
        
        return jsonify({
            'entrepreneurs': result,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': entrepreneurs.total,
                'pages': entrepreneurs.pages,
                'has_next': entrepreneurs.has_next,
                'has_prev': entrepreneurs.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@investor_bp.route('/entrepreneurs/<int:entrepreneur_id>', methods=['GET'])
def get_entrepreneur_details():
    try:
        user, error_response, status_code = require_investor_auth()
        if error_response:
            return error_response, status_code
        
        entrepreneur = User.query.filter_by(
            id=entrepreneur_id,
            user_type='entrepreneur',
            is_active=True
        ).first()
        
        if not entrepreneur:
            return jsonify({'error': 'Entrepreneur not found'}), 404
        
        entrepreneur_data = entrepreneur.to_dict()
        if entrepreneur.entrepreneur_profile:
            entrepreneur_data['profile'] = entrepreneur.entrepreneur_profile.to_dict()
        
        # Check if there's an existing match
        existing_match = Match.query.filter_by(
            investor_id=user.id,
            entrepreneur_id=entrepreneur_id
        ).first()
        
        if existing_match:
            entrepreneur_data['match'] = existing_match.to_dict()
        
        return jsonify({'entrepreneur': entrepreneur_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@investor_bp.route('/matches', methods=['GET'])
def get_matches():
    try:
        user, error_response, status_code = require_investor_auth()
        if error_response:
            return error_response, status_code
        
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        status_filter = request.args.get('status')
        
        query = Match.query.filter_by(investor_id=user.id)
        
        if status_filter:
            query = query.filter_by(status=status_filter)
        
        matches = query.order_by(Match.compatibility_score.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        result = []
        for match in matches.items:
            match_data = match.to_dict()
            result.append(match_data)
        
        return jsonify({
            'matches': result,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': matches.total,
                'pages': matches.pages,
                'has_next': matches.has_next,
                'has_prev': matches.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@investor_bp.route('/matches/<int:match_id>/interest', methods=['POST'])
def express_interest():
    try:
        user, error_response, status_code = require_investor_auth()
        if error_response:
            return error_response, status_code
        
        match = Match.query.filter_by(
            id=match_id,
            investor_id=user.id
        ).first()
        
        if not match:
            return jsonify({'error': 'Match not found'}), 404
        
        data = request.json
        interest_level = data.get('interest')  # 'interested', 'not_interested', 'maybe'
        notes = data.get('notes', '')
        
        if interest_level not in ['interested', 'not_interested', 'maybe']:
            return jsonify({'error': 'Invalid interest level'}), 400
        
        match.investor_interest = interest_level
        match.notes = notes
        
        # Update match status based on mutual interest
        if interest_level == 'interested' and match.entrepreneur_interest == 'interested':
            match.status = 'accepted'
        elif interest_level == 'not_interested' or match.entrepreneur_interest == 'not_interested':
            match.status = 'declined'
        
        db.session.commit()
        
        return jsonify({
            'message': 'Interest updated successfully',
            'match': match.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@investor_bp.route('/portfolio', methods=['GET'])
def get_portfolio():
    try:
        user, error_response, status_code = require_investor_auth()
        if error_response:
            return error_response, status_code
        
        # Get all matches where investor showed interest and status is accepted or invested
        portfolio_matches = Match.query.filter(
            Match.investor_id == user.id,
            Match.investor_interest == 'interested',
            Match.status.in_(['accepted', 'meeting_scheduled', 'invested'])
        ).all()
        
        portfolio = []
        for match in portfolio_matches:
            match_data = match.to_dict()
            portfolio.append(match_data)
        
        # Calculate portfolio statistics
        total_matches = len(portfolio)
        invested_count = len([m for m in portfolio if m['status'] == 'invested'])
        meeting_count = len([m for m in portfolio if m['status'] == 'meeting_scheduled'])
        
        stats = {
            'total_matches': total_matches,
            'invested_count': invested_count,
            'meeting_count': meeting_count,
            'conversion_rate': (invested_count / total_matches * 100) if total_matches > 0 else 0
        }
        
        return jsonify({
            'portfolio': portfolio,
            'stats': stats
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@investor_bp.route('/preferences', methods=['GET'])
def get_preferences():
    try:
        user, error_response, status_code = require_investor_auth()
        if error_response:
            return error_response, status_code
        
        if not user.investor_profile:
            return jsonify({'error': 'Investor profile not found'}), 404
        
        preferences = {
            'investment_stages': user.investor_profile.get_investment_stages(),
            'industries': user.investor_profile.get_industries(),
            'geographic_focus': user.investor_profile.get_geographic_focus(),
            'investment_range_min': user.investor_profile.investment_range_min,
            'investment_range_max': user.investor_profile.investment_range_max,
            'risk_tolerance': user.investor_profile.risk_tolerance,
            'investor_type': user.investor_profile.investor_type,
            'expertise_areas': user.investor_profile.get_expertise_areas(),
            'advisory_availability': user.investor_profile.advisory_availability,
            'communication_frequency': user.investor_profile.communication_frequency,
            'meeting_preference': user.investor_profile.meeting_preference
        }
        
        return jsonify({'preferences': preferences}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@investor_bp.route('/preferences', methods=['PUT'])
def update_preferences():
    try:
        user, error_response, status_code = require_investor_auth()
        if error_response:
            return error_response, status_code
        
        if not user.investor_profile:
            return jsonify({'error': 'Investor profile not found'}), 404
        
        data = request.json
        profile = user.investor_profile
        
        # Update preference fields
        if 'investment_stages' in data:
            profile.set_investment_stages(data['investment_stages'])
        
        if 'industries' in data:
            profile.set_industries(data['industries'])
        
        if 'geographic_focus' in data:
            profile.set_geographic_focus(data['geographic_focus'])
        
        if 'investment_range_min' in data:
            profile.investment_range_min = data['investment_range_min']
        
        if 'investment_range_max' in data:
            profile.investment_range_max = data['investment_range_max']
        
        if 'risk_tolerance' in data:
            profile.risk_tolerance = data['risk_tolerance']
        
        if 'investor_type' in data:
            profile.investor_type = data['investor_type']
        
        if 'expertise_areas' in data:
            profile.set_expertise_areas(data['expertise_areas'])
        
        if 'advisory_availability' in data:
            profile.advisory_availability = data['advisory_availability']
        
        if 'communication_frequency' in data:
            profile.communication_frequency = data['communication_frequency']
        
        if 'meeting_preference' in data:
            profile.meeting_preference = data['meeting_preference']
        
        profile.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Preferences updated successfully',
            'preferences': {
                'investment_stages': profile.get_investment_stages(),
                'industries': profile.get_industries(),
                'geographic_focus': profile.get_geographic_focus(),
                'investment_range_min': profile.investment_range_min,
                'investment_range_max': profile.investment_range_max,
                'risk_tolerance': profile.risk_tolerance,
                'investor_type': profile.investor_type,
                'expertise_areas': profile.get_expertise_areas(),
                'advisory_availability': profile.advisory_availability,
                'communication_frequency': profile.communication_frequency,
                'meeting_preference': profile.meeting_preference
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@investor_bp.route('/stats', methods=['GET'])
def get_investor_stats():
    try:
        user, error_response, status_code = require_investor_auth()
        if error_response:
            return error_response, status_code
        
        # Calculate various statistics
        total_matches = Match.query.filter_by(investor_id=user.id).count()
        interested_matches = Match.query.filter_by(
            investor_id=user.id,
            investor_interest='interested'
        ).count()
        accepted_matches = Match.query.filter_by(
            investor_id=user.id,
            status='accepted'
        ).count()
        invested_matches = Match.query.filter_by(
            investor_id=user.id,
            status='invested'
        ).count()
        
        # Get recent activity (last 30 days)
        from datetime import datetime, timedelta
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_matches = Match.query.filter(
            Match.investor_id == user.id,
            Match.created_at >= thirty_days_ago
        ).count()
        
        stats = {
            'total_matches': total_matches,
            'interested_matches': interested_matches,
            'accepted_matches': accepted_matches,
            'invested_matches': invested_matches,
            'recent_matches': recent_matches,
            'interest_rate': (interested_matches / total_matches * 100) if total_matches > 0 else 0,
            'conversion_rate': (invested_matches / interested_matches * 100) if interested_matches > 0 else 0
        }
        
        return jsonify({'stats': stats}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

