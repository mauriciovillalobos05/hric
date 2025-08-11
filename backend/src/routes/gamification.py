from flask import Blueprint, jsonify, request
import os, requests
from src.extensions import db
from src.models.user import (
    User, Leaderboard, LeaderboardEntry,
    UserAchievement, AchievementType
)

game_bp = Blueprint("gamification", __name__)
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

# ----- Leaderboards -----
@game_bp.route("/leaderboards", methods=["GET"])
def list_leaderboards():
    _, _, err = require_auth()
    if err: return err
    rows = Leaderboard.query.filter_by(is_active=True).order_by(Leaderboard.name.asc()).all()
    return jsonify([{
        "id": str(r.id),
        "name": r.name,
        "category": r.category,
        "time_period": r.time_period,
        "start_date": r.start_date.isoformat() if r.start_date else None,
        "end_date": r.end_date.isoformat() if r.end_date else None,
        "is_active": r.is_active,
    } for r in rows]), 200

@game_bp.route("/leaderboards/<uuid:lb_id>/entries", methods=["GET"])
def leaderboard_entries(lb_id):
    _, _, err = require_auth()
    if err: return err
    limit = min(request.args.get("limit", 50, type=int), 200)
    rows = LeaderboardEntry.query.filter_by(leaderboard_id=lb_id, is_current=True).order_by(LeaderboardEntry.rank.asc()).limit(limit).all()
    return jsonify([{
        "user_id": str(r.user_id),
        "rank": r.rank,
        "score": float(r.score),
        "metrics": r.metrics or {},
        "calculated_at": r.calculated_at.isoformat() if r.calculated_at else None
    } for r in rows]), 200

# ----- Achievements -----
@game_bp.route("/achievements/my", methods=["GET"])
def my_achievements():
    user, _, err = require_auth()
    if err: return err
    rows = UserAchievement.query.filter_by(user_id=user.id).order_by(UserAchievement.earned_date.desc()).all()
    return jsonify([{
        "achievement_type_id": str(r.achievement_type_id),
        "name": (r.achievement_type.name if r.achievement_type else None),
        "earned_date": r.earned_date.isoformat() if r.earned_date else None,
        "evidence": r.evidence or {},
        "points_earned": r.points_earned or 0,
        "level_achieved": r.level_achieved or 1,
        "is_featured": r.is_featured,
    } for r in rows]), 200

@game_bp.route("/achievements/award", methods=["POST"])
def award_achievement():
    # NOTE: in a real app, restrict to admins or automated jobs.
    user, _, err = require_auth()
    if err: return err
    data = request.get_json() or {}
    target_user_id = data.get("user_id") or user.id
    achievement_type_id = data.get("achievement_type_id")
    if not achievement_type_id:
        return jsonify({"error":"achievement_type_id required"}), 400

    # ensure type exists
    at = AchievementType.query.get(achievement_type_id)
    if not at:
        return jsonify({"error":"Achievement type not found"}), 404

    ua = UserAchievement(
        user_id=target_user_id,
        achievement_type_id=achievement_type_id,
        evidence=data.get("evidence") or {},
        points_earned=data.get("points_earned") or 0,
        level_achieved=data.get("level_achieved") or 1,
        is_featured=bool(data.get("is_featured", False))
    )
    db.session.add(ua)
    db.session.commit()
    return jsonify({"message":"awarded","user_id": str(target_user_id)}), 201