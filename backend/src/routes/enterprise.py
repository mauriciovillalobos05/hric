from flask import Blueprint, jsonify, request, session
from datetime import datetime, timedelta
from ..models.user import Users, Enterprise, InvestorProfile, MatchRecommendation, db

enterprise_bp = Blueprint('entrepreneur', __name__)

# --------------------- Admin Auth Helper ---------------------
def require_admin_auth():
    Users_id = session.get('Users_id')
    if not Users_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    Users = Users.query.get(Users_id)
    if not Users:
        return None, jsonify({'error': 'Users not found'}), 404
    if Users.role != 'admin':
        return None, jsonify({'error': 'Admin access required'}), 403
    return Users, None, None

# --------------------- Auth Helpers ---------------------
def require_auth():
    Users_id = session.get('Users_id')
    if not Users_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    Users = Users.query.get(Users_id)
    if not Users:
        return None, jsonify({'error': 'Users not found'}), 404
    return Users, None, None

def require_entrepreneur_auth():
    Users, err, status = require_auth()
    if err:
        return Users, err, status
    if Users.role != 'entrepreneur':
        return None, jsonify({'error': 'Entrepreneur access required'}), 403
    return Users, None, None

# --------------------- Enterprise Listing ---------------------
@enterprise_bp.route('/enterprises', methods=['GET'])
def get_all_enterprises():
    try:
        enterprises = Enterprise.query \
            .filter_by(is_actively_fundraising=True) \
            .order_by(Enterprise.created_at.desc()) \
            .all()

        result = []
        for e in enterprises:
            data = e.to_dict()
            data['owner'] = e.owner.to_summary() if e.owner else None
            result.append(data)

        return jsonify({'enterprises': result}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@enterprise_bp.route('/enterprises/<int:enterprise_id>', methods=['GET'])
def get_enterprise_detail(enterprise_id):
    try:
        enterprise = Enterprise.query.get(enterprise_id)
        if not enterprise or not enterprise.is_actively_fundraising:
            return jsonify({'error': 'Enterprise not found or inactive'}), 404

        data = enterprise.to_dict()
        data['owner'] = enterprise.owner.to_summary() if enterprise.owner else None

        return jsonify({'enterprise': data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --------------------- Fundraising Status ---------------------
@enterprise_bp.route('/fundraising-status', methods=['PUT'])
def update_fundraising_status():
    try:
        Users, err, status = require_entrepreneur_auth()
        if err:
            return err, status

        enterprise = Users.enterprises[0] if Users.enterprises else None
        if not enterprise:
            return jsonify({'error': 'No enterprise found'}), 404

        data = request.json
        if 'is_actively_fundraising' in data:
            enterprise.is_actively_fundraising = data['is_actively_fundraising']
        if 'financials' in data:
            enterprise.financials = data['financials']

        db.session.commit()
        return jsonify({'message': 'Fundraising status updated', 'enterprise': enterprise.to_dict()}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# --------------------- Startup Stats ---------------------
@enterprise_bp.route('/stats', methods=['GET'])
def get_entrepreneur_stats():
    try:
        Users, err, status = require_entrepreneur_auth()
        if err:
            return err, status

        if not Users.enterprises:
            return jsonify({'error': 'No enterprise found'}), 404

        enterprise_id = Users.enterprises[0].id
        total_matches = MatchRecommendation.query.filter_by(enterprise_id=enterprise_id).count()
        accepted = MatchRecommendation.query.filter_by(enterprise_id=enterprise_id, status='accepted').count()
        declined = MatchRecommendation.query.filter_by(enterprise_id=enterprise_id, status='declined').count()

        recent = MatchRecommendation.query.filter(
            MatchRecommendation.enterprise_id == enterprise_id,
            MatchRecommendation.generated_at >= datetime.utcnow() - timedelta(days=30)
        ).count()

        stats = {
            'total_matches': total_matches,
            'accepted': accepted,
            'declined': declined,
            'recent_recommendations': recent,
            'accept_rate': (accepted / total_matches * 100) if total_matches else 0
        }

        return jsonify({'stats': stats}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@enterprise_bp.route('/enterprise/<int:enterprise_id>', methods=['PUT'])
def update_enterprise_core_data(enterprise_id):
    try:
        Users, error_response, status_code = require_entrepreneur_auth()
        if error_response:
            return error_response, status_code

        enterprise = Enterprise.query.get(enterprise_id)
        if not enterprise or enterprise.Users_id != Users.id:
            return jsonify({'error': 'Enterprise not found or unauthorized'}), 404

        data = request.json
        allowed_fields = ['name', 'industry', 'stage', 'business_model', 'team_size', 'target_market']
        for field in allowed_fields:
            if field in data:
                setattr(enterprise, field, data[field])

        enterprise.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({'message': 'Enterprise updated successfully', 'enterprise': enterprise.to_dict()}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@enterprise_bp.route('/enterprises', methods=['GET'])
def list_enterprises():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        industry = request.args.get('industry')
        stage = request.args.get('stage')

        query = Enterprise.query.filter(Enterprise.is_actively_fundraising == True)

        if industry:
            query = query.filter(Enterprise.industry.ilike(f'%{industry}%'))
        if stage:
            query = query.filter(Enterprise.stage == stage)

        pagination = query.order_by(Enterprise.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        results = [e.to_dict() for e in pagination.items]

        return jsonify({
            'enterprises': results,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@enterprise_bp.route('/admin/enterprise-stats', methods=['GET'])
def get_enterprise_analytics():
    try:
        Users, error_response, status_code = require_admin_auth()
        if error_response:
            return error_response, status_code

        total_enterprises = Enterprise.query.count()
        active_fundraising = Enterprise.query.filter_by(is_actively_fundraising=True).count()
        industries = db.session.query(Enterprise.industry, db.func.count()).group_by(Enterprise.industry).all()
        stages = db.session.query(Enterprise.stage, db.func.count()).group_by(Enterprise.stage).all()

        return jsonify({
            'total_enterprises': total_enterprises,
            'active_fundraising': active_fundraising,
            'by_industry': {i: c for i, c in industries},
            'by_stage': {s: c for s, c in stages}
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
