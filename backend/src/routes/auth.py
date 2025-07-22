from flask import Blueprint, jsonify, request, session
from src.models.user import User, InvestorProfile, EntrepreneurProfile, db
from datetime import datetime
import re

auth_bp = Blueprint('auth', __name__)

def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    # At least 8 characters, one uppercase, one lowercase, one number
    if len(password) < 8:
        return False
    if not re.search(r'[A-Z]', password):
        return False
    if not re.search(r'[a-z]', password):
        return False
    if not re.search(r'\d', password):
        return False
    return True

@auth_bp.route('/register-complete', methods=['POST'])
def register_complete():
    try:
        data = request.json

        required_fields = ['supabase_id', 'email', 'user_type', 'first_name', 'last_name']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400

        # Check if user already exists
        if User.query.filter_by(id=data['supabase_id']).first():
            return jsonify({'error': 'User already exists'}), 409

        user = User(
            id=data['supabase_id'],
            email=data['email'],
            user_type=data['user_type'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            phone=data.get('phone'),
            location=data.get('location'),
            bio=data.get('bio'),
            linkedin_url=data.get('linkedin_url'),
            website_url=data.get('website_url'),
            is_verified=True
        )
        db.session.add(user)
        db.session.flush()

        if data['user_type'] == 'investor':
            db.session.add(InvestorProfile(user_id=user.id))
        else:
            db.session.add(EntrepreneurProfile(
                user_id=user.id,
                company_name=data.get('company_name', '')
            ))

        db.session.commit()
        return jsonify({'message': 'User registration completed', 'user': user.to_dict()}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/track-login', methods=['POST'])
def track_login():
    try:
        data = request.json
        email = data.get('email')

        if not email:
            return jsonify({'error': 'Email is required'}), 400

        user = User.query.filter_by(email=email).first()
        if user:
            user.last_login = datetime.utcnow()
            db.session.commit()
            return jsonify({'message': 'Login tracked'}), 200
        else:
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
        
        # Include profile data
        if user.user_type == 'investor' and user.investor_profile:
            user_data['profile'] = user.investor_profile.to_dict()
        elif user.user_type == 'entrepreneur' and user.entrepreneur_profile:
            user_data['profile'] = user.entrepreneur_profile.to_dict()
        
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
        
        # Update user fields
        user_fields = ['first_name', 'last_name', 'phone', 'location', 'bio', 'linkedin_url', 'website_url']
        for field in user_fields:
            if field in data:
                setattr(user, field, data[field])
        
        user.updated_at = datetime.utcnow()
        
        # Update profile fields based on user type
        if user.user_type == 'investor' and user.investor_profile:
            profile = user.investor_profile
            profile_fields = [
                'investment_range_min', 'investment_range_max', 'risk_tolerance',
                'investor_type', 'accredited_status', 'net_worth', 'annual_income',
                'investment_experience', 'portfolio_size', 'advisory_availability',
                'board_experience', 'communication_frequency', 'meeting_preference'
            ]
            
            for field in profile_fields:
                if field in data:
                    setattr(profile, field, data[field])
            
            # Handle JSON fields
            if 'investment_stages' in data:
                profile.set_investment_stages(data['investment_stages'])
            if 'industries' in data:
                profile.set_industries(data['industries'])
            if 'geographic_focus' in data:
                profile.set_geographic_focus(data['geographic_focus'])
            if 'expertise_areas' in data:
                profile.set_expertise_areas(data['expertise_areas'])
            
            profile.updated_at = datetime.utcnow()
        
        elif user.user_type == 'entrepreneur' and user.entrepreneur_profile:
            profile = user.entrepreneur_profile
            profile_fields = [
                'company_name', 'company_description', 'industry', 'business_model',
                'stage', 'founded_date', 'employee_count', 'location', 'funding_stage',
                'funding_amount_seeking', 'funding_amount_raised', 'use_of_funds',
                'monthly_revenue', 'monthly_growth_rate', 'gross_margin', 'burn_rate',
                'runway_months', 'team_size', 'target_market', 'market_size',
                'competitors', 'competitive_advantage', 'looking_for_strategic_value',
                'is_actively_fundraising', 'pitch_deck_url', 'demo_url'
            ]
            
            for field in profile_fields:
                if field in data:
                    if field == 'founded_date' and data[field]:
                        # Convert date string to date object
                        from datetime import datetime
                        setattr(profile, field, datetime.strptime(data[field], '%Y-%m-%d').date())
                    else:
                        setattr(profile, field, data[field])
            
            # Handle JSON fields
            if 'previous_funding_rounds' in data:
                profile.set_previous_funding_rounds(data['previous_funding_rounds'])
            if 'key_team_members' in data:
                profile.set_key_team_members(data['key_team_members'])
            if 'advisors' in data:
                profile.set_advisors(data['advisors'])
            if 'preferred_investor_types' in data:
                profile.set_preferred_investor_types(data['preferred_investor_types'])
            if 'geographic_investor_preference' in data:
                profile.set_geographic_investor_preference(data['geographic_investor_preference'])
            
            profile.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        # Return updated user data
        user_data = user.to_dict()
        if user.user_type == 'investor' and user.investor_profile:
            user_data['profile'] = user.investor_profile.to_dict()
        elif user.user_type == 'entrepreneur' and user.entrepreneur_profile:
            user_data['profile'] = user.entrepreneur_profile.to_dict()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': user_data
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/change-password', methods=['POST'])
def change_password():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.json
        
        if not data.get('current_password') or not data.get('new_password'):
            return jsonify({'error': 'Current password and new password are required'}), 400
        
        if not user.check_password(data['current_password']):
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        if not validate_password(data['new_password']):
            return jsonify({'error': 'New password must be at least 8 characters with uppercase, lowercase, and number'}), 400
        
        user.set_password(data['new_password'])
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/subscription', methods=['PUT'])
def update_subscription():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Not authenticated'}), 401
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.json
        
        if 'subscription_tier' not in data:
            return jsonify({'error': 'Subscription tier is required'}), 400
        
        valid_tiers = ['free', 'basic', 'premium', 'vip', 'enterprise']
        if data['subscription_tier'] not in valid_tiers:
            return jsonify({'error': 'Invalid subscription tier'}), 400
        
        user.subscription_tier = data['subscription_tier']
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Subscription updated successfully',
            'subscription_tier': user.subscription_tier
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
