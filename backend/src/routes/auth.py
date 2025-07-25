from flask import Blueprint, jsonify, request, session
from src.models.user import User, InvestorProfile, Enterprise, Like,db
from datetime import datetime
import re

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register-complete', methods=['POST'])
def register_complete():
    try:
        data = request.json
        required_fields = ['supabase_id', 'email', 'role', 'first_name', 'last_name']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400

        if User.query.filter_by(id=data['supabase_id']).first():
            return jsonify({'error': 'User already exists'}), 409

        # Create base user
        user = User(
            id=data['supabase_id'],
            email=data['email'],
            phone=data.get('phone'),
            role=data['role'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            location=data.get('location'),
            bio=data.get('bio'),
            profile_image=data.get('profile_image'),
            linkedin_url=data.get('linkedin_url'),
            website_url=data.get('website_url'),
            onboarding_status='pending_review'
        )
        db.session.add(user)
        db.session.flush()  # assign user.id

        # Role-based profile creation
        if user.role == 'investor':
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

        elif user.role == 'entrepreneur':
            enterprise = Enterprise(
                user_id=user.id,
                name=data.get('company_name', ''),
                industry=data.get('industry'),
                stage=data.get('stage'),
                business_model=data.get('business_model'),
                team_size=data.get('team_size'),
                pitch_deck_url=data.get('pitch_deck_url'),
                demo_url=data.get('demo_url'),
                is_actively_fundraising=data.get('is_actively_fundraising', True),
                financials=data.get('financials'),
                target_market=data.get('target_market')
            )
            db.session.add(enterprise)

        db.session.commit()
        return jsonify({'message': 'User onboarding complete', 'user': user.to_dict()}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/track-login', methods=['POST'])
def track_login():
    try:
        email = request.json.get('email')
        user = User.query.filter_by(email=email).first()
        if user:
            user.last_login = datetime.utcnow()
            db.session.commit()
            return jsonify({'message': 'Login tracked'}), 200
        return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logout successful'}), 200

@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        user_data = user.to_dict()

        if user.role == 'investor' and user.investor_profile:
            user_data['profile'] = user.investor_profile.to_dict()
        elif user.role == 'entrepreneur' and user.enterprises:
            user_data['profile'] = user.enterprises[0].to_dict()

        return jsonify({'user': user_data}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/profile', methods=['PUT'])
def update_profile():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.json
        # Update base User fields
        for field in ['first_name', 'last_name', 'phone', 'location', 'bio', 'linkedin_url', 'website_url', 'profile_image']:
            if field in data:
                setattr(user, field, data[field])

        # Update investor profile
        if user.role == 'investor' and user.investor_profile:
            profile = user.investor_profile
            for field in [
                'industries', 'investment_stages', 'geographic_focus',
                'investment_range_min', 'investment_range_max',
                'accredited_status', 'investor_type', 'risk_tolerance',
                'portfolio_size', 'advisory_availability',
                'communication_frequency', 'meeting_preference'
            ]:
                if field in data:
                    setattr(profile, field, data[field])

        # Update entrepreneur profile
        elif user.role == 'entrepreneur' and user.enterprises:
            enterprise = user.enterprises[0]
            for field in [
                'name', 'industry', 'stage', 'business_model',
                'team_size', 'pitch_deck_url', 'demo_url',
                'is_actively_fundraising', 'financials', 'target_market'
            ]:
                if field in data:
                    setattr(enterprise, field, data[field])

        db.session.commit()

        updated = user.to_dict()
        if user.role == 'investor' and user.investor_profile:
            updated['profile'] = user.investor_profile.to_dict()
        elif user.role == 'entrepreneur' and user.enterprises:
            updated['profile'] = user.enterprises[0].to_dict()

        return jsonify({'message': 'Profile updated', 'user': updated}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/enterprise/<int:enterprise_id>/likes', methods=['POST', 'GET'])
def handle_likes(enterprise_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401

    user = User.query.get(user_id)
    if not user or user.role != 'investor':
        return jsonify({'error': 'Only investors can perform this action'}), 403

    enterprise = Enterprise.query.get(enterprise_id)
    if not enterprise:
        return jsonify({'error': 'Enterprise not found'}), 404

    if request.method == 'POST':
        existing_like = Like.query.filter_by(user_id=user.id, enterprise_id=enterprise_id).first()
        if existing_like:
            return jsonify({'message': 'Already liked'}), 200

        like = Like(user_id=user.id, enterprise_id=enterprise_id)
        db.session.add(like)
        db.session.commit()
        return jsonify({'message': 'Enterprise liked'}), 201

    elif request.method == 'GET':
        likes = Like.query.filter_by(enterprise_id=enterprise_id).all()
        tier = user.investor_profile.portfolio_size if user.investor_profile else 0

        if tier >= 1000000:
            return jsonify({
                'likes': [like.user.to_dict(include_profile=True) for like in likes],
                'count': len(likes)
            }), 200
        elif tier > 0:
            return jsonify({'count': len(likes)}), 200
        else:
            return jsonify({'message': 'Upgrade to view likes'}), 403
