from flask import Blueprint, jsonify, request
import os, requests
from datetime import datetime
from src.extensions import db
from src.models.user import (
    User, Enterprise, EnterpriseUser,
    MarketRecommendation, MarketInteraction
)

recs_bp = Blueprint("market_recs", __name__)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

def require_auth():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, None, (jsonify({"error":"Missing or invalid Authorization header"}), 401)
    token = auth_header.split(" ")[1]
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
            timeout=15
        )
        if resp.status_code != 200:
            return None, None, (jsonify({"error":"Invalid or expired token"}), 401)
        user_id = resp.json()["id"]
    except Exception as e:
        return None, None, (jsonify({"error": f"Token verification failed: {str(e)}"}), 500)
    user = User.query.get(user_id)
    if not user:
        return None, None, (jsonify({"error":"User not found in database"}), 404)
    return user, token, None

def ensure_member(user_id, enterprise_id):
    return EnterpriseUser.query.filter_by(user_id=user_id, enterprise_id=enterprise_id, is_active=True).first() is not None

# ---------- List recommendations for my enterprises ----------
@recs_bp.route("/recommendations", methods=["GET"])
def my_recommendations():
    user, _, err = require_auth()
    if err: return err

    my_enterprise_ids = [eu.enterprise_id for eu in EnterpriseUser.query.filter_by(user_id=user.id, is_active=True).all()]
    if not my_enterprise_ids:
        return jsonify({"recommendations":[]}), 200

    rows = MarketRecommendation.query.filter(MarketRecommendation.enterprise_id.in_(my_enterprise_ids)).order_by(MarketRecommendation.generated_at.desc()).limit(200).all()
    return jsonify([_rec_to_dict(r) for r in rows]), 200

# ---------- Update status (viewed/acted_upon/dismissed) ----------
@recs_bp.route("/recommendations/<uuid:rec_id>/status", methods=["PATCH"])
def update_recommendation_status(rec_id):
    user, _, err = require_auth()
    if err: return err
    r = MarketRecommendation.query.get(rec_id)
    if not r or not ensure_member(user.id, r.enterprise_id):
        return jsonify({"error":"Not found or unauthorized"}), 404
    data = request.get_json() or {}
    status = data.get("status")
    if status not in ("active","viewed","acted_upon","dismissed","expired"):
        return jsonify({"error":"Invalid status"}), 400
    r.status = status
    if status == "viewed":
        r.viewed_at = datetime.utcnow()
    elif status == "acted_upon":
        r.acted_upon_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"message":"updated"}), 200

# ---------- Interact (view/like/share/save/comment/follow_up/dismiss) ----------
@recs_bp.route("/recommendations/<uuid:rec_id>/interact", methods=["POST"])
def interact(rec_id):
    user, _, err = require_auth()
    if err: return err
    r = MarketRecommendation.query.get(rec_id)
    if not r or not ensure_member(user.id, r.enterprise_id):
        return jsonify({"error":"Not found or unauthorized"}), 404

    data = request.get_json() or {}
    itype = data.get("interaction_type")
    if itype not in ("view","like","share","save","comment","follow_up","dismiss"):
        return jsonify({"error":"Invalid interaction_type"}), 400

    mi = MarketInteraction(
        recommendation_id=r.id,
        user_id=user.id,
        interaction_type=itype,
        interaction_data=data.get("interaction_data") or {},
        feedback_rating=data.get("feedback_rating"),
        feedback_text=data.get("feedback_text")
    )
    db.session.add(mi)

    # convenience: mark viewed if interaction is a view
    if itype == "view":
        r.status = "viewed"
        r.viewed_at = datetime.utcnow()

    db.session.commit()
    return jsonify({"message":"recorded"}), 201

def _rec_to_dict(r: MarketRecommendation):
    return {
        "id": str(r.id),
        "enterprise_id": str(r.enterprise_id),
        "meeting_id": str(r.meeting_id) if r.meeting_id else None,
        "recommendation_type": r.recommendation_type,
        "title": r.title,
        "description": r.description,
        "recommendation_data": r.recommendation_data or {},
        "confidence_score": float(r.confidence_score or 0),
        "priority_level": r.priority_level,
        "source_type": r.source_type,
        "source_data": r.source_data or {},
        "status": r.status,
        "generated_at": r.generated_at.isoformat() if r.generated_at else None,
        "expires_at": r.expires_at.isoformat() if r.expires_at else None,
        "viewed_at": r.viewed_at.isoformat() if r.viewed_at else None,
        "acted_upon_at": r.acted_upon_at.isoformat() if r.acted_upon_at else None,
    }