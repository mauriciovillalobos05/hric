from flask import Blueprint, jsonify, request, session
from src.models.user import User, InvestorProfile, Enterprise, Match, db
from datetime import datetime, timedelta
import json
import random
from sqlalchemy import or_

matching_bp = Blueprint('matching', __name__)

def require_auth():
    user_id = session.get('user_id')
    if not user_id:
        return None, jsonify({'error': 'Not authenticated'}), 401

    user = User.query.get(user_id)
    if not user:
        return None, jsonify({'error': 'User not found'}), 404

    return user, None, None

def calculate_compatibility_score(investor_profile, enterprise):
    score = 0
    reasons = []

    investor_industries = investor_profile.get_industries()
    entrepreneur_industry = enterprise.industry
    if entrepreneur_industry and entrepreneur_industry in investor_industries:
        score += 25
        reasons.append(f"Industry match: {entrepreneur_industry}")
    elif investor_industries:
        score += 10
        reasons.append("Related industry interest")

    investor_stages = investor_profile.get_investment_stages()
    entrepreneur_stage = enterprise.funding_stage
    if entrepreneur_stage and entrepreneur_stage in investor_stages:
        score += 20
        reasons.append(f"Investment stage match: {entrepreneur_stage}")
    elif investor_stages:
        score += 8
        reasons.append("Compatible investment stage")

    if (investor_profile.investment_range_min and investor_profile.investment_range_max and
        enterprise.funding_amount_seeking):
        seeking_amount = enterprise.funding_amount_seeking
        min_investment = investor_profile.investment_range_min
        max_investment = investor_profile.investment_range_max
        if min_investment <= seeking_amount <= max_investment:
            score += 20
            reasons.append(f"Investment amount match: ${seeking_amount:,}")
        elif seeking_amount <= max_investment * 1.5:
            score += 12
            reasons.append("Investment amount within range")
        else:
            score += 5

    investor_geo = investor_profile.get_geographic_focus()
    entrepreneur_location = enterprise.location
    if entrepreneur_location and investor_geo:
        for geo in investor_geo:
            if geo.lower() in entrepreneur_location.lower():
                score += 15
                reasons.append(f"Geographic match: {geo}")
                break
        else:
            score += 5
            reasons.append("Geographic proximity")

    if investor_profile.risk_tolerance and enterprise.stage:
        risk_stage_mapping = {
            'high': ['idea', 'mvp'],
            'medium': ['early_revenue', 'growth'],
            'low': ['growth', 'scale']
        }
        compatible_stages = risk_stage_mapping.get(investor_profile.risk_tolerance, [])
        if enterprise.stage in compatible_stages:
            score += 10
            reasons.append(f"Risk tolerance match: {investor_profile.risk_tolerance} risk")

    if investor_profile.advisory_availability and enterprise.looking_for_strategic_value:
        score += 10
        reasons.append("Advisory support available")

    if enterprise.monthly_revenue and enterprise.monthly_revenue > 0:
        score += 5
        reasons.append("Revenue generating company")

    if investor_profile.board_experience and enterprise.stage in ['growth', 'scale']:
        score += 5
        reasons.append("Board experience available")

    score = min(score, 100)
    return score, reasons

@matching_bp.route('/compatibility/<uuid:target_user_id>', methods=['GET'])
def check_compatibility(target_user_id):
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        target_user = User.query.get(target_user_id)
        if not target_user:
            return jsonify({'error': 'Target user not found'}), 404

        if user.user_type == target_user.user_type:
            return jsonify({'error': 'Cannot match users of the same type'}), 400

        if user.user_type == 'investor':
            investor = user
            entrepreneur = target_user
        else:
            investor = target_user
            entrepreneur = user

        investor_profile = investor.investor_profile
        if not investor_profile:
            return jsonify({'error': 'Investor profile not found'}), 400

        if not entrepreneur.enterprises:
            return jsonify({'error': 'Entrepreneur has no enterprises'}), 400

        scores = []
        for enterprise in entrepreneur.enterprises:
            score, reasons = calculate_compatibility_score(investor_profile, enterprise)
            existing_match = Match.query.filter_by(
                investor_id=investor.id,
                enterprise_id=entrepreneur.id
            ).first()
            scores.append({
                'enterprise': enterprise.to_dict(),
                'compatibility_score': score,
                'match_reasons': reasons,
                'existing_match': existing_match.to_dict() if existing_match else None
            })

        return jsonify({'matches': scores}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@matching_bp.route('/recommendations', methods=['GET'])
def get_recommendations():
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 10), 50)
        min_score = request.args.get('min_score', 50, type=int)

        if user.user_type == 'investor':
            matches_query = Match.query.filter(
                Match.investor_id == user.id,
                Match.compatibility_score >= min_score
            ).order_by(Match.compatibility_score.desc())
        else:
            matches_query = Match.query.filter(
                Match.enterprise_id.in_([e.id for e in user.enterprises]),
                Match.compatibility_score >= min_score
            ).order_by(Match.compatibility_score.desc())

        matches = matches_query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'recommendations': [m.to_dict() for m in matches.items],
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

@matching_bp.route('/create', methods=['POST'])
def create_manual_match():
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        data = request.json
        enterprise_id = data.get('enterprise_id')

        if not enterprise_id:
            return jsonify({'error': 'Enterprise ID is required'}), 400

        enterprise = Enterprise.query.get(enterprise_id)
        if not enterprise:
            return jsonify({'error': 'Enterprise not found'}), 404

        investor = user if user.user_type == 'investor' else User.query.get(data.get('investor_id'))
        if not investor or not investor.investor_profile:
            return jsonify({'error': 'Valid investor not found'}), 404

        existing_match = Match.query.filter_by(
            investor_id=investor.id,
            enterprise_id=enterprise.id
        ).first()

        if existing_match:
            return jsonify({'error': 'Match already exists'}), 409

        score, reasons = calculate_compatibility_score(investor.investor_profile, enterprise)

        match = Match(
            investor_id=investor.id,
            enterprise_id=enterprise.id,
            compatibility_score=score,
            status='pending'
        )
        match.set_match_reasons(reasons)

        db.session.add(match)
        db.session.commit()

        return jsonify({'message': 'Match created', 'match': match.to_dict()}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@matching_bp.route('/batch-generate', methods=['POST'])
def batch_generate_matches():
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        data = request.json
        min_score = data.get('min_score', 40)
        max_matches_per_user = data.get('max_matches_per_user', 20)
        total_matches_created = 0

        investors = db.session.query(User).join(InvestorProfile).filter(
            User.user_type == 'investor',
            User.is_active == True
        ).all()

        enterprises = db.session.query(Enterprise).join(User).filter(
            User.user_type == 'entrepreneur',
            User.is_active == True,
            Enterprise.is_actively_fundraising == True
        ).all()

        for investor in investors:
            existing_enterprise_ids = set(
                m.enterprise_id for m in Match.query.filter_by(investor_id=investor.id).all()
            )
            matches_created = 0
            for enterprise in enterprises:
                if enterprise.id in existing_enterprise_ids:
                    continue
                if matches_created >= max_matches_per_user:
                    break
                score, reasons = calculate_compatibility_score(investor.investor_profile, enterprise)
                if score >= min_score:
                    match = Match(
                        investor_id=investor.id,
                        enterprise_id=enterprise.id,
                        compatibility_score=score,
                        status='pending'
                    )
                    match.set_match_reasons(reasons)
                    db.session.add(match)
                    matches_created += 1
                    total_matches_created += 1

        db.session.commit()
        return jsonify({
            'message': 'Batch matching completed',
            'total_matches_created': total_matches_created,
            'investors_processed': len(investors),
            'enterprises_available': len(enterprises)
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@matching_bp.route('/analytics', methods=['GET'])
def get_matching_analytics():
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        total_matches = Match.query.count()
        pending = Match.query.filter_by(status='pending').count()
        accepted = Match.query.filter_by(status='accepted').count()
        declined = Match.query.filter_by(status='declined').count()
        invested = Match.query.filter_by(status='invested').count()
        avg_score = db.session.query(db.func.avg(Match.compatibility_score)).scalar() or 0

        industry_matches = (
            db.session.query(
                Enterprise.industry,
                db.func.count(Match.id).label('match_count')
            )
            .join(Match, Match.enterprise_id == Enterprise.id)
            .group_by(Enterprise.industry)
            .order_by(db.func.count(Match.id).desc())
            .limit(10)
            .all()
        )

        recent_matches = Match.query.filter(Match.created_at >= datetime.utcnow() - timedelta(days=30)).count()

        return jsonify({
            'analytics': {
                'total_matches': total_matches,
                'pending_matches': pending,
                'accepted_matches': accepted,
                'declined_matches': declined,
                'invested_matches': invested,
                'average_compatibility_score': round(avg_score, 2),
                'recent_matches': recent_matches,
                'acceptance_rate': (accepted / total_matches * 100) if total_matches else 0,
                'investment_rate': (invested / accepted * 100) if accepted else 0,
                'top_industries': [{'industry': i, 'match_count': c} for i, c in industry_matches]
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@matching_bp.route('/generate', methods=['POST'])
def generate_matches():
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        data = request.json
        limit = min(data.get('limit', 10), 50)
        min_score = data.get('min_score', 30)
        matches_created = 0

        if user.user_type == 'investor':
            if not user.investor_profile:
                return jsonify({'error': 'Investor profile not found'}), 404
            existing_ids = set(m.enterprise_id for m in Match.query.filter_by(investor_id=user.id).all())
            enterprises = Enterprise.query.filter(
                Enterprise.is_actively_fundraising == True,
                ~Enterprise.id.in_(existing_ids)
            ).all()

            for enterprise in enterprises:
                if matches_created >= limit:
                    break
                score, reasons = calculate_compatibility_score(user.investor_profile, enterprise)
                if score >= min_score:
                    match = Match(
                        investor_id=user.id,
                        enterprise_id=enterprise.id,
                        compatibility_score=score,
                        status='pending'
                    )
                    match.set_match_reasons(reasons)
                    db.session.add(match)
                    matches_created += 1

        elif user.user_type == 'entrepreneur':
            enterprise_list = user.enterprises
            if not enterprise_list:
                return jsonify({'error': 'No enterprises found'}), 404
            investors = User.query.join(InvestorProfile).filter(User.user_type == 'investor', User.is_active == True).all()

            for enterprise in enterprise_list:
                for investor in investors:
                    if matches_created >= limit:
                        break
                    existing = Match.query.filter_by(investor_id=investor.id, enterprise_id=enterprise.id).first()
                    if existing:
                        continue
                    score, reasons = calculate_compatibility_score(investor.investor_profile, enterprise)
                    if score >= min_score:
                        match = Match(
                            investor_id=investor.id,
                            enterprise_id=enterprise.id,
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