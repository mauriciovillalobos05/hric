from flask import Blueprint, jsonify, request, session
from src.models.user import User, InvestorProfile, EntrepreneurProfile, Match, db
from datetime import datetime
import json
import random

matching_bp = Blueprint('matching', __name__)

def require_auth():
    user_id = session.get('user_id')
    if not user_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    
    user = User.query.get(user_id)
    if not user:
        return None, jsonify({'error': 'User not found'}), 404
    
    return user, None, None

def calculate_compatibility_score(investor_profile, entrepreneur_profile):
    """
    Calculate compatibility score between investor and entrepreneur
    Returns score between 0-100 and list of match reasons
    """
    score = 0
    reasons = []
    
    # Industry alignment (25 points)
    investor_industries = investor_profile.get_industries()
    entrepreneur_industry = entrepreneur_profile.industry
    
    if entrepreneur_industry and entrepreneur_industry in investor_industries:
        score += 25
        reasons.append(f"Industry match: {entrepreneur_industry}")
    elif investor_industries:
        # Partial match for related industries
        score += 10
        reasons.append("Related industry interest")
    
    # Investment stage alignment (20 points)
    investor_stages = investor_profile.get_investment_stages()
    entrepreneur_stage = entrepreneur_profile.funding_stage
    
    if entrepreneur_stage and entrepreneur_stage in investor_stages:
        score += 20
        reasons.append(f"Investment stage match: {entrepreneur_stage}")
    elif investor_stages:
        score += 8
        reasons.append("Compatible investment stage")
    
    # Investment amount alignment (20 points)
    if (investor_profile.investment_range_min and investor_profile.investment_range_max and
        entrepreneur_profile.funding_amount_seeking):
        
        seeking_amount = entrepreneur_profile.funding_amount_seeking
        min_investment = investor_profile.investment_range_min
        max_investment = investor_profile.investment_range_max
        
        if min_investment <= seeking_amount <= max_investment:
            score += 20
            reasons.append(f"Investment amount match: ${seeking_amount:,}")
        elif seeking_amount <= max_investment * 1.5:  # Within 50% of max
            score += 12
            reasons.append("Investment amount within range")
        else:
            score += 5
    
    # Geographic alignment (15 points)
    investor_geo = investor_profile.get_geographic_focus()
    entrepreneur_location = entrepreneur_profile.location
    
    if entrepreneur_location and investor_geo:
        for geo in investor_geo:
            if geo.lower() in entrepreneur_location.lower():
                score += 15
                reasons.append(f"Geographic match: {geo}")
                break
        else:
            score += 5
            reasons.append("Geographic proximity")
    
    # Risk tolerance and company stage (10 points)
    if investor_profile.risk_tolerance and entrepreneur_profile.stage:
        risk_stage_mapping = {
            'high': ['idea', 'mvp'],
            'medium': ['early_revenue', 'growth'],
            'low': ['growth', 'scale']
        }
        
        compatible_stages = risk_stage_mapping.get(investor_profile.risk_tolerance, [])
        if entrepreneur_profile.stage in compatible_stages:
            score += 10
            reasons.append(f"Risk tolerance match: {investor_profile.risk_tolerance} risk")
    
    # Advisory value match (10 points)
    if investor_profile.advisory_availability and entrepreneur_profile.looking_for_strategic_value:
        score += 10
        reasons.append("Advisory support available")
    
    # Bonus factors
    if entrepreneur_profile.monthly_revenue and entrepreneur_profile.monthly_revenue > 0:
        score += 5
        reasons.append("Revenue generating company")
    
    if investor_profile.board_experience and entrepreneur_profile.stage in ['growth', 'scale']:
        score += 5
        reasons.append("Board experience available")
    
    # Ensure score doesn't exceed 100
    score = min(score, 100)
    
    return score, reasons

@matching_bp.route('/generate', methods=['POST'])
def generate_matches():
    """Generate new matches for a user"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        data = request.json
        limit = min(data.get('limit', 10), 50)  # Max 50 matches at once
        min_score = data.get('min_score', 30)  # Minimum compatibility score
        
        if user.user_type == 'investor':
            # Find entrepreneurs for investor
            if not user.investor_profile:
                return jsonify({'error': 'Investor profile not found'}), 404
            
            # Get entrepreneurs not already matched
            existing_matches = db.session.query(Match.entrepreneur_id).filter_by(
                investor_id=user.id
            ).subquery()
            
            entrepreneurs = db.session.query(User).join(EntrepreneurProfile).filter(
                User.user_type == 'entrepreneur',
                User.is_active == True,
                EntrepreneurProfile.is_actively_fundraising == True,
                ~User.id.in_(existing_matches)
            ).all()
            
            matches_created = 0
            for entrepreneur in entrepreneurs:
                if matches_created >= limit:
                    break
                
                score, reasons = calculate_compatibility_score(
                    user.investor_profile,
                    entrepreneur.entrepreneur_profile
                )
                
                if score >= min_score:
                    match = Match(
                        investor_id=user.id,
                        entrepreneur_id=entrepreneur.id,
                        compatibility_score=score,
                        status='pending'
                    )
                    match.set_match_reasons(reasons)
                    db.session.add(match)
                    matches_created += 1
        
        elif user.user_type == 'entrepreneur':
            # Find investors for entrepreneur
            if not user.entrepreneur_profile:
                return jsonify({'error': 'Entrepreneur profile not found'}), 404
            
            # Get investors not already matched
            existing_matches = db.session.query(Match.investor_id).filter_by(
                entrepreneur_id=user.id
            ).subquery()
            
            investors = db.session.query(User).join(InvestorProfile).filter(
                User.user_type == 'investor',
                User.is_active == True,
                ~User.id.in_(existing_matches)
            ).all()
            
            matches_created = 0
            for investor in investors:
                if matches_created >= limit:
                    break
                
                score, reasons = calculate_compatibility_score(
                    investor.investor_profile,
                    user.entrepreneur_profile
                )
                
                if score >= min_score:
                    match = Match(
                        investor_id=investor.id,
                        entrepreneur_id=user.id,
                        compatibility_score=score,
                        status='pending'
                    )
                    match.set_match_reasons(reasons)
                    db.session.add(match)
                    matches_created += 1
        
        else:
            return jsonify({'error': 'Invalid user type'}), 400
        
        db.session.commit()
        
        return jsonify({
            'message': f'{matches_created} new matches generated',
            'matches_created': matches_created
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@matching_bp.route('/recommendations', methods=['GET'])
def get_recommendations():
    """Get AI-powered recommendations for a user"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 10), 50)
        min_score = request.args.get('min_score', 50, type=int)
        
        # Get existing matches for the user
        if user.user_type == 'investor':
            matches_query = Match.query.filter(
                Match.investor_id == user.id,
                Match.compatibility_score >= min_score
            ).order_by(Match.compatibility_score.desc())
        else:
            matches_query = Match.query.filter(
                Match.entrepreneur_id == user.id,
                Match.compatibility_score >= min_score
            ).order_by(Match.compatibility_score.desc())
        
        matches = matches_query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        recommendations = []
        for match in matches.items:
            match_data = match.to_dict()
            recommendations.append(match_data)
        
        return jsonify({
            'recommendations': recommendations,
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

@matching_bp.route('/compatibility/<int:target_user_id>', methods=['GET'])
def check_compatibility():
    """Check compatibility between current user and target user"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        target_user = User.query.get(target_user_id)
        if not target_user:
            return jsonify({'error': 'Target user not found'}), 404
        
        # Ensure users are of different types
        if user.user_type == target_user.user_type:
            return jsonify({'error': 'Cannot match users of the same type'}), 400
        
        # Determine investor and entrepreneur
        if user.user_type == 'investor':
            investor = user
            entrepreneur = target_user
        else:
            investor = target_user
            entrepreneur = user
        
        if not investor.investor_profile or not entrepreneur.entrepreneur_profile:
            return jsonify({'error': 'Both users must have complete profiles'}), 400
        
        score, reasons = calculate_compatibility_score(
            investor.investor_profile,
            entrepreneur.entrepreneur_profile
        )
        
        # Check if match already exists
        existing_match = Match.query.filter_by(
            investor_id=investor.id,
            entrepreneur_id=entrepreneur.id
        ).first()
        
        result = {
            'compatibility_score': score,
            'match_reasons': reasons,
            'existing_match': existing_match.to_dict() if existing_match else None
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@matching_bp.route('/create', methods=['POST'])
def create_manual_match():
    """Manually create a match between two users"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        data = request.json
        target_user_id = data.get('target_user_id')
        
        if not target_user_id:
            return jsonify({'error': 'Target user ID is required'}), 400
        
        target_user = User.query.get(target_user_id)
        if not target_user:
            return jsonify({'error': 'Target user not found'}), 404
        
        # Ensure users are of different types
        if user.user_type == target_user.user_type:
            return jsonify({'error': 'Cannot match users of the same type'}), 400
        
        # Determine investor and entrepreneur
        if user.user_type == 'investor':
            investor_id = user.id
            entrepreneur_id = target_user_id
        else:
            investor_id = target_user_id
            entrepreneur_id = user.id
        
        # Check if match already exists
        existing_match = Match.query.filter_by(
            investor_id=investor_id,
            entrepreneur_id=entrepreneur_id
        ).first()
        
        if existing_match:
            return jsonify({'error': 'Match already exists'}), 409
        
        # Get profiles for compatibility calculation
        investor = User.query.get(investor_id)
        entrepreneur = User.query.get(entrepreneur_id)
        
        if not investor.investor_profile or not entrepreneur.entrepreneur_profile:
            return jsonify({'error': 'Both users must have complete profiles'}), 400
        
        score, reasons = calculate_compatibility_score(
            investor.investor_profile,
            entrepreneur.entrepreneur_profile
        )
        
        # Create the match
        match = Match(
            investor_id=investor_id,
            entrepreneur_id=entrepreneur_id,
            compatibility_score=score,
            status='pending'
        )
        match.set_match_reasons(reasons)
        
        db.session.add(match)
        db.session.commit()
        
        return jsonify({
            'message': 'Match created successfully',
            'match': match.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@matching_bp.route('/batch-generate', methods=['POST'])
def batch_generate_matches():
    """Generate matches for all active users (admin function)"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # This could be restricted to admin users in a real implementation
        data = request.json
        min_score = data.get('min_score', 40)
        max_matches_per_user = data.get('max_matches_per_user', 20)
        
        total_matches_created = 0
        
        # Get all active investors
        investors = db.session.query(User).join(InvestorProfile).filter(
            User.user_type == 'investor',
            User.is_active == True
        ).all()
        
        # Get all active entrepreneurs
        entrepreneurs = db.session.query(User).join(EntrepreneurProfile).filter(
            User.user_type == 'entrepreneur',
            User.is_active == True,
            EntrepreneurProfile.is_actively_fundraising == True
        ).all()
        
        for investor in investors:
            # Get existing matches for this investor
            existing_entrepreneur_ids = set(
                match.entrepreneur_id for match in 
                Match.query.filter_by(investor_id=investor.id).all()
            )
            
            matches_for_investor = 0
            for entrepreneur in entrepreneurs:
                if (entrepreneur.id not in existing_entrepreneur_ids and 
                    matches_for_investor < max_matches_per_user):
                    
                    score, reasons = calculate_compatibility_score(
                        investor.investor_profile,
                        entrepreneur.entrepreneur_profile
                    )
                    
                    if score >= min_score:
                        match = Match(
                            investor_id=investor.id,
                            entrepreneur_id=entrepreneur.id,
                            compatibility_score=score,
                            status='pending'
                        )
                        match.set_match_reasons(reasons)
                        db.session.add(match)
                        matches_for_investor += 1
                        total_matches_created += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'Batch matching completed',
            'total_matches_created': total_matches_created,
            'investors_processed': len(investors),
            'entrepreneurs_available': len(entrepreneurs)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@matching_bp.route('/analytics', methods=['GET'])
def get_matching_analytics():
    """Get analytics about the matching system"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # Overall matching statistics
        total_matches = Match.query.count()
        pending_matches = Match.query.filter_by(status='pending').count()
        accepted_matches = Match.query.filter_by(status='accepted').count()
        declined_matches = Match.query.filter_by(status='declined').count()
        invested_matches = Match.query.filter_by(status='invested').count()
        
        # Average compatibility score
        avg_score = db.session.query(db.func.avg(Match.compatibility_score)).scalar() or 0
        
        # Top industries by match count
        industry_matches = db.session.query(
            EntrepreneurProfile.industry,
            db.func.count(Match.id).label('match_count')
        ).join(Match, Match.entrepreneur_id == EntrepreneurProfile.user_id)\
         .group_by(EntrepreneurProfile.industry)\
         .order_by(db.func.count(Match.id).desc())\
         .limit(10).all()
        
        # Recent matching activity (last 30 days)
        from datetime import timedelta
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_matches = Match.query.filter(
            Match.created_at >= thirty_days_ago
        ).count()
        
        analytics = {
            'total_matches': total_matches,
            'pending_matches': pending_matches,
            'accepted_matches': accepted_matches,
            'declined_matches': declined_matches,
            'invested_matches': invested_matches,
            'average_compatibility_score': round(avg_score, 2),
            'recent_matches': recent_matches,
            'acceptance_rate': (accepted_matches / total_matches * 100) if total_matches > 0 else 0,
            'investment_rate': (invested_matches / accepted_matches * 100) if accepted_matches > 0 else 0,
            'top_industries': [
                {'industry': industry, 'match_count': count}
                for industry, count in industry_matches
            ]
        }
        
        return jsonify({'analytics': analytics}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

