from flask import Blueprint, jsonify, request
import os, requests
from src.extensions import db
from src.models.user import User, Enterprise, EnterpriseUser

members_bp = Blueprint("enterprise_members", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

def require_auth():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, None, (jsonify({"error": "Missing or invalid Authorization header"}), 401)
    token = auth_header.split(" ")[1]
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
            timeout=15,
        )
        if resp.status_code != 200:
            return None, None, (jsonify({"error": "Invalid or expired token"}), 401)
        user_id = resp.json()["id"]
    except Exception as e:
        return None, None, (jsonify({"error": f"Token verification failed: {str(e)}"}), 500)
    user = User.query.get(user_id)
    if not user:
        return None, None, (jsonify({"error": "User not found in database"}), 404)
    return user, token, None

def require_enterprise_role(user_id, enterprise_id, allowed=("owner","admin")):
    eu = EnterpriseUser.query.filter_by(user_id=user_id, enterprise_id=enterprise_id, is_active=True).first()
    return eu and eu.role in allowed

@members_bp.route("/enterprise/<uuid:enterprise_id>/members", methods=["GET"])
def list_members(enterprise_id):
    user, _, error = require_auth()
    if error: return error
    if not require_enterprise_role(user.id, enterprise_id, allowed=("owner","admin","member","viewer")):
        return jsonify({"error":"Not a member"}), 403
    rows = EnterpriseUser.query.filter_by(enterprise_id=enterprise_id).all()
    return jsonify([{
        "user_id": str(r.user_id),
        "role": r.role,
        "is_active": r.is_active,
        "joined_date": r.joined_date.isoformat() if r.joined_date else None,
        "permissions": r.permissions or {}
    } for r in rows]), 200

@members_bp.route("/enterprise/<uuid:enterprise_id>/members", methods=["POST"])
def add_member(enterprise_id):
    user, _, error = require_auth()
    if error: return error
    if not require_enterprise_role(user.id, enterprise_id, allowed=("owner","admin")):
        return jsonify({"error":"Owner/Admin required"}), 403

    data = request.get_json() or {}
    target_user_id = data.get("user_id")
    role = (data.get("role") or "member").lower()
    if role not in ("owner","admin","member","viewer"):
        return jsonify({"error":"Invalid role"}), 400
    if not target_user_id:
        return jsonify({"error":"user_id required"}), 400

    if EnterpriseUser.query.filter_by(enterprise_id=enterprise_id, user_id=target_user_id).first():
        return jsonify({"error":"User already member"}), 409

    eu = EnterpriseUser(enterprise_id=enterprise_id, user_id=target_user_id, role=role, is_active=True)
    db.session.add(eu)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        # could be unique owner violation
        return jsonify({"error": str(e)}), 400

    return jsonify({"message":"Member added","member":{"user_id":str(target_user_id),"role":role}}), 201

@members_bp.route("/enterprise/<uuid:enterprise_id>/members/<uuid:member_user_id>", methods=["PATCH"])
def update_member_role(enterprise_id, member_user_id):
    user, _, error = require_auth()
    if error: return error
    if not require_enterprise_role(user.id, enterprise_id, allowed=("owner","admin")):
        return jsonify({"error":"Owner/Admin required"}), 403

    eu = EnterpriseUser.query.filter_by(enterprise_id=enterprise_id, user_id=member_user_id).first()
    if not eu:
        return jsonify({"error":"Membership not found"}), 404

    data = request.get_json() or {}
    if "role" in data:
        new_role = data["role"].lower()
        if new_role not in ("owner","admin","member","viewer"):
            return jsonify({"error":"Invalid role"}), 400
        eu.role = new_role
    if "is_active" in data:
        eu.is_active = bool(data["is_active"])
    if "permissions" in data and isinstance(data["permissions"], dict):
        eu.permissions = data["permissions"]

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

    return jsonify({"message":"Member updated"}), 200

@members_bp.route("/enterprise/<uuid:enterprise_id>/members/<uuid:member_user_id>", methods=["DELETE"])
def remove_member(enterprise_id, member_user_id):
    user, _, error = require_auth()
    if error: return error
    if not require_enterprise_role(user.id, enterprise_id, allowed=("owner","admin")):
        return jsonify({"error":"Owner/Admin required"}), 403

    eu = EnterpriseUser.query.filter_by(enterprise_id=enterprise_id, user_id=member_user_id).first()
    if not eu:
        return jsonify({"error":"Membership not found"}), 404
    db.session.delete(eu)
    db.session.commit()
    return jsonify({"message":"Member removed"}), 200