from flask import Blueprint, jsonify, request, session
from src.models.user import User, InvestorProfile, EntrepreneurProfile, Match, db
from datetime import datetime

entrepreneur_bp = Blueprint('entrepreneur', __name__)

def require_auth():
    user_id = session.get('user_id')
    if not user_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    
    user = User.query.get(user_id)
    if not user:
        return None, jsonify({'error': 'User not found'}), 404
    
    return user, None, None

def require_entrepreneur_auth():
    user, error_response, status_code = require_auth()
    if error_response:
        return user, error_response, status_code
    
    if user.user_type != 'entrepreneur':
        return None, jsonify({'error': 'Entrepreneur access required'}), 403
    
    return user, None, None

@entrepreneur_bp.route('/profile', methods=['GET'])
def get_entrepreneur_profile():
    try:
        user, error_response, status_code = require_entrepreneur_auth()
        if error_response:
            return error_response, status_code
        
        if not user.entrepreneur_profile:
            return jsonify({'error': 'Entrepreneur profile not found'}), 404
        
        profile_data = user.entrepreneur_profile.to_dict()
        profile_data['user'] = user.to_dict()
        
        return jsonify({'profile': profile_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@entrepreneur_bp.route('/investors', methods=['GET'])
def browse_investors():
    try:
        user, error_response, status_code = require_entrepreneur_auth()
        if error_response:
            return error_response, status_code
        
        # Get query parameters for filtering
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        investor_type = request.args.get('investor_type')
        risk_tolerance = request.args.get('risk_tolerance')
        min_investment = request.args.get('min_investment', type=int)
        max_investment = request.args.get('max_investment', type=int)
        industry = request.args.get('industry')
        stage = request.args.get('stage')
        location = request.args.get('location')
        advisory_availability = request.args.get('advisory_availability', type=bool)
        
        # Build query
        query = db.session.query(User).join(InvestorProfile).filter(
            User.user_type == 'investor',
            User.is_active == True
        )
        
        # Apply filters
        if investor_type:
            query = query.filter(InvestorProfile.investor_type == investor_type)
        
        if risk_tolerance:
            query = query.filter(InvestorProfile.risk_tolerance == risk_tolerance)
        
        if min_investment:
            query = query.filter(InvestorProfile.investment_range_min >= min_investment)
        
        if max_investment:
            query = query.filter(InvestorProfile.investment_range_max <= max_investment)
        
        if location:
            query = query.filter(User.location.ilike(f'%{location}%'))
        
        if advisory_availability is not None:
            query = query.filter(InvestorProfile.advisory_availability == advisory_availability)
        
        # Filter by industry and stage preferences if provided
        if industry or stage:
            # This would require more complex JSON querying in a real implementation
            # For now, we'll skip this filter
            pass
        
        # Execute paginated query
        investors = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        # Format response
        result = []
        for investor in investors.items:
            investor_data = investor.to_dict()
            if investor.investor_profile:
                # Don't include sensitive financial information
                profile_data = investor.investor_profile.to_dict()
                # Remove sensitive fields
                sensitive_fields = ['net_worth', 'annual_income', 'portfolio_size']
                for field in sensitive_fields:
                    profile_data.pop(field, None)
                investor_data['profile'] = profile_data
            result.append(investor_data)
        
        return jsonify({
            'investors': result,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': investors.total,
                'pages': investors.pages,
                'has_next': investors.has_next,
                'has_prev': investors.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@entrepreneur_bp.route('/investors/<int:investor_id>', methods=['GET'])
def get_investor_details():
    try:
        user, error_response, status_code = require_entrepreneur_auth()
        if error_response:
            return error_response, status_code
        
        investor = User.query.filter_by(
            id=investor_id,
            user_type='investor',
            is_active=True
        ).first()
        
        if not investor:
            return jsonify({'error': 'Investor not found'}), 404
        
        investor_data = investor.to_dict()
        if investor.investor_profile:
            profile_data = investor.investor_profile.to_dict()
            # Remove sensitive fields
            sensitive_fields = ['net_worth', 'annual_income', 'portfolio_size']
            for field in sensitive_fields:
                profile_data.pop(field, None)
            investor_data['profile'] = profile_data
        
        # Check if there's an existing match
        existing_match = Match.query.filter_by(
            investor_id=investor_id,
            entrepreneur_id=user.id
        ).first()
        
        if existing_match:
            investor_data['match'] = existing_match.to_dict()
        
        return jsonify({'investor': investor_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@entrepreneur_bp.route('/matches', methods=['GET'])
def get_matches():
    try:
        user, error_response, status_code = require_entrepreneur_auth()
        if error_response:
            return error_response, status_code
        
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        status_filter = request.args.get('status')
        
        query = Match.query.filter_by(entrepreneur_id=user.id)
        
        if status_filter:
            query = query.filter_by(status=status_filter)
        
        matches = query.order_by(Match.compatibility_score.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        result = []
        for match in matches.items:
            match_data = match.to_dict()
            # Remove sensitive investor information
            if match_data.get('investor') and match_data['investor'].get('profile'):
                sensitive_fields = ['net_worth', 'annual_income', 'portfolio_size']
                for field in sensitive_fields:
                    match_data['investor']['profile'].pop(field, None)
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

@entrepreneur_bp.route('/matches/<int:match_id>/interest', methods=['POST'])
def express_interest():
    try:
        user, error_response, status_code = require_entrepreneur_auth()
        if error_response:
            return error_response, status_code
        
        match = Match.query.filter_by(
            id=match_id,
            entrepreneur_id=user.id
        ).first()
        
        if not match:
            return jsonify({'error': 'Match not found'}), 404
        
        data = request.json
        interest_level = data.get('interest')  # 'interested', 'not_interested', 'maybe'
        notes = data.get('notes', '')
        
        if interest_level not in ['interested', 'not_interested', 'maybe']:
            return jsonify({'error': 'Invalid interest level'}), 400
        
        match.entrepreneur_interest = interest_level
        if notes:
            match.notes = f"{match.notes}\n{notes}" if match.notes else notes
        
        # Update match status based on mutual interest
        if interest_level == 'interested' and match.investor_interest == 'interested':
            match.status = 'accepted'
        elif interest_level == 'not_interested' or match.investor_interest == 'not_interested':
            match.status = 'declined'
        
        db.session.commit()
        
        return jsonify({
            'message': 'Interest updated successfully',
            'match': match.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@entrepreneur_bp.route('/fundraising-status', methods=['PUT'])
def update_fundraising_status():
    try:
        user, error_response, status_code = require_entrepreneur_auth()
        if error_response:
            return error_response, status_code
        
        if not user.entrepreneur_profile:
            return jsonify({'error': 'Entrepreneur profile not found'}), 404
        
        data = request.json
        
        if 'is_actively_fundraising' in data:
            user.entrepreneur_profile.is_actively_fundraising = data['is_actively_fundraising']
        
        if 'funding_amount_seeking' in data:
            user.entrepreneur_profile.funding_amount_seeking = data['funding_amount_seeking']
        
        if 'funding_stage' in data:
            user.entrepreneur_profile.funding_stage = data['funding_stage']
        
        if 'use_of_funds' in data:
            user.entrepreneur_profile.use_of_funds = data['use_of_funds']
        
        user.entrepreneur_profile.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Fundraising status updated successfully',
            'profile': user.entrepreneur_profile.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@entrepreneur_bp.route('/company-metrics', methods=['PUT'])
def update_company_metrics():
    try:
        user, error_response, status_code = require_entrepreneur_auth()
        if error_response:
            return error_response, status_code
        
        if not user.entrepreneur_profile:
            return jsonify({'error': 'Entrepreneur profile not found'}), 404
        
        data = request.json
        profile = user.entrepreneur_profile
        
        # Update financial metrics
        metric_fields = [
            'monthly_revenue', 'monthly_growth_rate', 'gross_margin',
            'burn_rate', 'runway_months', 'employee_count', 'team_size'
        ]
        
        for field in metric_fields:
            if field in data:
                setattr(profile, field, data[field])
        
        # Update funding information
        if 'funding_amount_raised' in data:
            profile.funding_amount_raised = data['funding_amount_raised']
        
        if 'previous_funding_rounds' in data:
            profile.set_previous_funding_rounds(data['previous_funding_rounds'])
        
        profile.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Company metrics updated successfully',
            'profile': profile.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@entrepreneur_bp.route('/team', methods=['PUT'])
def update_team_info():
    try:
        user, error_response, status_code = require_entrepreneur_auth()
        if error_response:
            return error_response, status_code
        
        if not user.entrepreneur_profile:
            return jsonify({'error': 'Entrepreneur profile not found'}), 404
        
        data = request.json
        profile = user.entrepreneur_profile
        
        if 'key_team_members' in data:
            profile.set_key_team_members(data['key_team_members'])
        
        if 'advisors' in data:
            profile.set_advisors(data['advisors'])
        
        if 'team_size' in data:
            profile.team_size = data['team_size']
        
        profile.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Team information updated successfully',
            'team_members': profile.get_key_team_members(),
            'advisors': profile.get_advisors(),
            'team_size': profile.team_size
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@entrepreneur_bp.route('/investor-preferences', methods=['GET'])
def get_investor_preferences():
    try:
        user, error_response, status_code = require_entrepreneur_auth()
        if error_response:
            return error_response, status_code
        
        if not user.entrepreneur_profile:
            return jsonify({'error': 'Entrepreneur profile not found'}), 404
        
        preferences = {
            'preferred_investor_types': user.entrepreneur_profile.get_preferred_investor_types(),
            'geographic_investor_preference': user.entrepreneur_profile.get_geographic_investor_preference(),
            'looking_for_strategic_value': user.entrepreneur_profile.looking_for_strategic_value
        }
        
        return jsonify({'preferences': preferences}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@entrepreneur_bp.route('/investor-preferences', methods=['PUT'])
def update_investor_preferences():
    try:
        user, error_response, status_code = require_entrepreneur_auth()
        if error_response:
            return error_response, status_code
        
        if not user.entrepreneur_profile:
            return jsonify({'error': 'Entrepreneur profile not found'}), 404
        
        data = request.json
        profile = user.entrepreneur_profile
        
        if 'preferred_investor_types' in data:
            profile.set_preferred_investor_types(data['preferred_investor_types'])
        
        if 'geographic_investor_preference' in data:
            profile.set_geographic_investor_preference(data['geographic_investor_preference'])
        
        if 'looking_for_strategic_value' in data:
            profile.looking_for_strategic_value = data['looking_for_strategic_value']
        
        profile.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Investor preferences updated successfully',
            'preferences': {
                'preferred_investor_types': profile.get_preferred_investor_types(),
                'geographic_investor_preference': profile.get_geographic_investor_preference(),
                'looking_for_strategic_value': profile.looking_for_strategic_value
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@entrepreneur_bp.route('/stats', methods=['GET'])
def get_entrepreneur_stats():
    try:
        user, error_response, status_code = require_entrepreneur_auth()
        if error_response:
            return error_response, status_code
        
        # Calculate various statistics
        total_matches = Match.query.filter_by(entrepreneur_id=user.id).count()
        interested_matches = Match.query.filter_by(
            entrepreneur_id=user.id,
            entrepreneur_interest='interested'
        ).count()
        accepted_matches = Match.query.filter_by(
            entrepreneur_id=user.id,
            status='accepted'
        ).count()
        investor_interested = Match.query.filter_by(
            entrepreneur_id=user.id,
            investor_interest='interested'
        ).count()
        
        # Get recent activity (last 30 days)
        from datetime import timedelta
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_matches = Match.query.filter(
            Match.entrepreneur_id == user.id,
            Match.created_at >= thirty_days_ago
        ).count()
        
        stats = {
            'total_matches': total_matches,
            'interested_matches': interested_matches,
            'accepted_matches': accepted_matches,
            'investor_interested': investor_interested,
            'recent_matches': recent_matches,
            'interest_rate': (interested_matches / total_matches * 100) if total_matches > 0 else 0,
            'investor_interest_rate': (investor_interested / total_matches * 100) if total_matches > 0 else 0
        }
        
        return jsonify({'stats': stats}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

