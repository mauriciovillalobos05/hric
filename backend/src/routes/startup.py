from flask import Blueprint, jsonify, request
import os, requests
from datetime import datetime, date
from sqlalchemy import and_
from src.extensions import db
from src.models.user import (
    User, Enterprise, EnterpriseUser,
    StartupProfile, StartupMetrics, FundingRound
)

startup_bp = Blueprint("startup", __name__)

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

def ensure_membership(user_id, enterprise_id, allowed=("owner","admin","member")):
    eu = EnterpriseUser.query.filter_by(user_id=user_id, enterprise_id=enterprise_id, is_active=True).first()
    return eu and eu.role in allowed

# ---------- Profile ----------
@startup_bp.route("/startup/profile/<uuid:enterprise_id>", methods=["GET"])
def get_startup_profile(enterprise_id):
    user, _, error = require_auth()
    if error: return error
    if not ensure_membership(user.id, enterprise_id, allowed=("owner","admin","member","viewer")):
        return jsonify({"error":"Not a member of this enterprise"}), 403

    sp = StartupProfile.query.filter_by(enterprise_id=enterprise_id).first()
    if not sp:
        return jsonify({"error":"Startup profile not found"}), 404

    return jsonify({
        "id": str(sp.id),
        "enterprise_id": str(sp.enterprise_id),
        "business_model": sp.business_model,
        "value_proposition": sp.value_proposition,
        "team_size": sp.team_size,
        "target_market": sp.target_market,
        "competitive_advantages": sp.competitive_advantages or [],
        "revenue_model": sp.revenue_model,
        "current_revenue": float(sp.current_revenue or 0),
        "monthly_growth_rate": float(sp.monthly_growth_rate or 0),
        "customer_count": sp.customer_count,
        "market_size": float(sp.market_size or 0),
        "addressable_market": float(sp.addressable_market or 0),
        "traction_metrics": sp.traction_metrics or {},
        "intellectual_property": sp.intellectual_property or {},
        "regulatory_considerations": sp.regulatory_considerations,
    }), 200

@startup_bp.route("/startup/profile/<uuid:enterprise_id>", methods=["POST","PUT"])
def upsert_startup_profile(enterprise_id):
    user, _, error = require_auth()
    if error: return error
    if not ensure_membership(user.id, enterprise_id, allowed=("owner","admin")):
        return jsonify({"error":"Owner/Admin required"}), 403

    data = request.get_json() or {}
    sp = StartupProfile.query.filter_by(enterprise_id=enterprise_id).first()
    if not sp:
        sp = StartupProfile(enterprise_id=enterprise_id)

    for field in [
        "business_model","value_proposition","team_size","target_market",
        "competitive_advantages","revenue_model","current_revenue","monthly_growth_rate",
        "customer_count","market_size","addressable_market","traction_metrics",
        "intellectual_property","regulatory_considerations"
    ]:
        if field in data:
            setattr(sp, field, data[field])

    db.session.add(sp)
    db.session.commit()
    return jsonify({"message":"Startup profile saved","id": str(sp.id)}), 200

# ---------- Metrics ----------
@startup_bp.route("/startup/metrics/<uuid:enterprise_id>", methods=["GET"])
def list_metrics(enterprise_id):
    user, _, error = require_auth()
    if error: return error
    if not ensure_membership(user.id, enterprise_id, allowed=("owner","admin","member","viewer")):
        return jsonify({"error":"Not a member of this enterprise"}), 403

    sp = StartupProfile.query.filter_by(enterprise_id=enterprise_id).first()
    if not sp: return jsonify({"error":"Startup profile not found"}), 404

    rows = StartupMetrics.query.filter_by(startup_profile_id=sp.id).order_by(StartupMetrics.recorded_at.desc()).all()
    return jsonify([{
        "id": str(r.id),
        "metric_type": r.metric_type,
        "metric_name": r.metric_name,
        "value": float(r.value),
        "unit": r.unit,
        "period_start": r.period_start.isoformat() if r.period_start else None,
        "period_end": r.period_end.isoformat() if r.period_end else None,
        "is_public": r.is_public,
        "notes": r.notes,
        "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
    } for r in rows]), 200

@startup_bp.route("/startup/metrics/<uuid:enterprise_id>", methods=["POST"])
def add_metric(enterprise_id):
    user, _, error = require_auth()
    if error: return error
    if not ensure_membership(user.id, enterprise_id, allowed=("owner","admin","member")):
        return jsonify({"error":"Owner/Admin/Member required"}), 403

    sp = StartupProfile.query.filter_by(enterprise_id=enterprise_id).first()
    if not sp: return jsonify({"error":"Startup profile not found"}), 404

    data = request.get_json() or {}
    required = ["metric_type","metric_name","value"]
    missing = [k for k in required if k not in data]
    if missing: return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    row = StartupMetrics(
        startup_profile_id=sp.id,
        metric_type=data["metric_type"],
        metric_name=data["metric_name"],
        value=data["value"],
        unit=data.get("unit"),
        period_start=_parse_date(data.get("period_start")),
        period_end=_parse_date(data.get("period_end")),
        is_public=bool(data.get("is_public", False)),
        notes=data.get("notes"),
        created_by=user.id,
    )
    db.session.add(row)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    return jsonify({"message":"Metric added","id": str(row.id)}), 201

# ---------- Funding rounds ----------
@startup_bp.route("/startup/funding-rounds/<uuid:enterprise_id>", methods=["GET"])
def list_funding_rounds(enterprise_id):
    user, _, error = require_auth()
    if error: return error
    if not ensure_membership(user.id, enterprise_id, allowed=("owner","admin","member","viewer")):
        return jsonify({"error":"Not a member of this enterprise"}), 403

    sp = StartupProfile.query.filter_by(enterprise_id=enterprise_id).first()
    if not sp: return jsonify({"error":"Startup profile not found"}), 404

    rows = FundingRound.query.filter_by(startup_profile_id=sp.id).order_by(FundingRound.close_date.desc()).all()
    return jsonify([{
        "id": str(r.id),
        "round_type": r.round_type,
        "amount_raised": float(r.amount_raised or 0),
        "pre_money_valuation": float(r.pre_money_valuation or 0),
        "post_money_valuation": float(r.post_money_valuation or 0),
        "lead_investor": r.lead_investor,
        "investors": r.investors or [],
        "close_date": r.close_date.isoformat() if r.close_date else None,
        "announcement_date": r.announcement_date.isoformat() if r.announcement_date else None,
        "is_public": r.is_public,
        "notes": r.notes,
    } for r in rows]), 200

@startup_bp.route("/startup/funding-rounds/<uuid:enterprise_id>", methods=["POST"])
def add_funding_round(enterprise_id):
    user, _, error = require_auth()
    if error: return error
    if not ensure_membership(user.id, enterprise_id, allowed=("owner","admin")):
        return jsonify({"error":"Owner/Admin required"}), 403

    sp = StartupProfile.query.filter_by(enterprise_id=enterprise_id).first()
    if not sp: return jsonify({"error":"Startup profile not found"}), 404

    data = request.get_json() or {}
    required = ["round_type","amount_raised"]
    missing = [k for k in required if k not in data]
    if missing: return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    fr = FundingRound(
        startup_profile_id=sp.id,
        round_type=data["round_type"],
        amount_raised=data["amount_raised"],
        pre_money_valuation=data.get("pre_money_valuation"),
        post_money_valuation=data.get("post_money_valuation"),
        lead_investor=data.get("lead_investor"),
        investors=data.get("investors", []),
        close_date=_parse_date(data.get("close_date")),
        announcement_date=_parse_date(data.get("announcement_date")),
        use_of_funds=data.get("use_of_funds"),
        terms_summary=data.get("terms_summary"),
        is_public=bool(data.get("is_public", False)),
        notes=data.get("notes"),
    )
    db.session.add(fr)
    db.session.commit()
    return jsonify({"message":"Funding round added","id": str(fr.id)}), 201

def _parse_date(val):
    if not val:
        return None
    if isinstance(val, date):
        return val
    try:
        return date.fromisoformat(val[:10])
    except Exception:
        return None