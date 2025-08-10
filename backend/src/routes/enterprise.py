# src/routes/enterprise.py

from datetime import datetime, timedelta
import os
import uuid
from functools import wraps

import requests
from flask import Blueprint, jsonify, request, g
from sqlalchemy import func

from src.extensions import db
from src.models.user import (
    # core
    User, Enterprise, EnterpriseUser,
    # profiles / lookups
    EnterpriseProfile, StartupProfile, Industry, Stage,
    # matching
    MatchScore, MatchInteraction,
)

enterprise_bp = Blueprint("enterprise", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
LOCAL_API_BASE_URL = os.getenv("LOCAL_API_BASE_URL")

# -------------------------------------------------
# Auth / role helpers
# -------------------------------------------------
def require_auth():
    """Validate Supabase JWT and return (user, token, error_response_or_None)."""
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


def require_enterprise_role(required_roles=("owner", "admin")):
    """
    Decorator to ensure the caller has one of the roles on the target enterprise.
    Looks for <uuid:enterprise_id> in the URL params by default.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user, _, err = require_auth()
            if err:
                return err

            enterprise_id = kwargs.get("enterprise_id")
            if enterprise_id is None:
                # try read from body as fallback
                enterprise_id = (request.get_json() or {}).get("enterprise_id")

            if not enterprise_id:
                return jsonify({"error": "enterprise_id required"}), 400

            membership = EnterpriseUser.query.filter_by(
                user_id=user.id,
                enterprise_id=enterprise_id,
                is_active=True,
            ).first()

            if not membership or (membership.role not in required_roles):
                return jsonify({"error": f"{'/'.join(required_roles)} access required"}), 403

            g.user = user
            g.membership = membership
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def is_admin_like(user: User):
    """Treat owner/admin of any org as admin-like for admin endpoints."""
    exists = (
        db.session.query(EnterpriseUser.id)
        .filter(
            EnterpriseUser.user_id == user.id,
            EnterpriseUser.is_active.is_(True),
            EnterpriseUser.role.in_(["owner", "admin"]),
        )
        .first()
    )
    return exists is not None


# -------------------------------------------------
# Utility (serialize / lookups)
# -------------------------------------------------
def _enterprise_summary(ent: Enterprise):
    return {
        "id": str(ent.id),
        "name": ent.name,
        "enterprise_type": ent.enterprise_type,
        "location": ent.location,
        "website": ent.website,
        "logo_url": ent.logo_url,
        "employee_count": ent.employee_count,
        "status": ent.status,
        "is_verified": ent.is_verified,
        "created_at": ent.created_at.isoformat() if hasattr(ent, "created_at") and ent.created_at else None,
        "updated_at": ent.updated_at.isoformat() if hasattr(ent, "updated_at") and ent.updated_at else None,
    }


def _enterprise_detail(ent: Enterprise):
    profile = EnterpriseProfile.query.filter_by(enterprise_id=ent.id).first()
    startup = StartupProfile.query.filter_by(enterprise_id=ent.id).first()
    owner_membership = EnterpriseUser.query.filter_by(
        enterprise_id=ent.id, role="owner", is_active=True
    ).first()
    industry = Stage_ = None
    if profile and profile.industry_id:
        ind = Industry.query.get(profile.industry_id)
        industry = ind.name if ind else None
    if profile and profile.stage_id:
        st = Stage.query.get(profile.stage_id)
        Stage_ = st.name if st else None

    return {
        **_enterprise_summary(ent),
        "profile": {
            "industry": industry,
            "stage": Stage_,
            "description": profile.description if profile else None,
            "key_metrics": profile.key_metrics if profile else {},
            "target_markets": profile.target_markets if profile else [],
            "competitive_advantages": profile.competitive_advantages if profile else [],
        },
        "startup_profile": {
            "business_model": startup.business_model if startup else None,
            "team_size": startup.team_size if startup else None,
            "target_market": startup.target_market if startup else None,
            "revenue_model": startup.revenue_model if startup else None,
            "current_revenue": float(startup.current_revenue or 0) if startup else 0,
            "monthly_growth_rate": float(startup.monthly_growth_rate or 0) if startup else 0,
            "customer_count": startup.customer_count if startup else None,
        },
        "owner": {
            "id": str(owner_membership.user_id),
        } if owner_membership else None,
    }


def _resolve_industry_stage(industry_id=None, industry_name=None, stage_id=None, stage_name=None):
    iid = None
    sid = None
    if industry_id:
        try:
            iid = uuid.UUID(str(industry_id))
        except Exception:
            iid = None
    elif industry_name:
        ind = Industry.query.filter(func.lower(Industry.name) == industry_name.lower()).first()
        if ind:
            iid = ind.id

    if stage_id:
        try:
            sid = uuid.UUID(str(stage_id))
        except Exception:
            sid = None
    elif stage_name:
        st = Stage.query.filter(func.lower(Stage.name) == stage_name.lower()).first()
        if st:
            sid = st.id
    return iid, sid


# -------------------------------------------------
# Routes
# -------------------------------------------------

@enterprise_bp.route("/profile", methods=["POST"])
def create_enterprise_profile():
    """
    Create a STARTUP enterprise + its EnterpriseProfile + StartupProfile.
    Body JSON may include:
      name*,
      industry_id or industry_name,
      stage_id or stage_name,
      business_model, team_size, target_market, revenue_model, description, etc.
    """
    user, token, err = require_auth()
    if err:
        return err

    data = request.get_json() or {}
    name = data.get("name")
    if not name:
        return jsonify({"error": "name is required"}), 400

    # Optional: prevent creating multiple owned startups
    existing_owned = (
        db.session.query(Enterprise.id)
        .join(EnterpriseUser, EnterpriseUser.enterprise_id == Enterprise.id)
        .filter(
            EnterpriseUser.user_id == user.id,
            EnterpriseUser.role == "owner",
            EnterpriseUser.is_active.is_(True),
            Enterprise.enterprise_type.in_(["startup", "both"]),
        )
        .first()
    )
    if existing_owned:
        return jsonify({"error": "You already own a startup enterprise"}), 400

    # Create Enterprise
    ent = Enterprise(
        name=name,
        enterprise_type="startup",
        location=data.get("location"),
        website=data.get("website"),
        logo_url=data.get("logo_url"),
        employee_count=data.get("team_size"),
        status="active",
        is_verified=False,
    )
    db.session.add(ent)
    db.session.flush()  # get ent.id

    # Make caller the owner
    owner = EnterpriseUser(
        enterprise_id=ent.id,
        user_id=user.id,
        role="owner",
        permissions={},
        is_active=True,
    )
    db.session.add(owner)

    # Resolve industry / stage
    industry_id, stage_id = _resolve_industry_stage(
        industry_id=data.get("industry_id"),
        industry_name=data.get("industry"),
        stage_id=data.get("stage_id"),
        stage_name=data.get("stage"),
    )

    # Create EnterpriseProfile
    prof = EnterpriseProfile(
        enterprise_id=ent.id,
        industry_id=industry_id,
        stage_id=stage_id,
        description=data.get("description"),
        contact_info=data.get("contact_info") or {},
        social_media=data.get("social_media") or {},
        key_metrics=data.get("key_metrics") or {},
        competitive_advantages=data.get("competitive_advantages") or [],
        target_markets=data.get("target_markets") or [],
    )
    db.session.add(prof)

    # Create StartupProfile
    sp = StartupProfile(
        enterprise_id=ent.id,
        business_model=data.get("business_model"),
        value_proposition=data.get("value_proposition"),
        team_size=data.get("team_size"),
        target_market=data.get("target_market"),
        competitive_advantages=data.get("competitive_advantages"),
        revenue_model=data.get("revenue_model"),
        current_revenue=data.get("current_revenue"),
        monthly_growth_rate=data.get("monthly_growth_rate"),
        customer_count=data.get("customer_count"),
        market_size=data.get("market_size"),
        addressable_market=data.get("addressable_market"),
        traction_metrics=data.get("traction_metrics") or {},
        intellectual_property=data.get("intellectual_property") or {},
        regulatory_considerations=data.get("regulatory_considerations"),
    )
    db.session.add(sp)
    db.session.commit()

    # (Optional) call local matching generator
    try:
        if LOCAL_API_BASE_URL:
            _ = requests.get(
                f"{LOCAL_API_BASE_URL}/api/matching/matches",
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
    except Exception:
        pass  # non-blocking

    return jsonify({
        "message": "Enterprise profile created",
        "enterprise": _enterprise_detail(ent),
    }), 201


@enterprise_bp.route("/explore", methods=["GET"])
def list_explorable_enterprises():
    """
    List startups to explore with optional filters:
      ?industry=<name>  or  ?industry_id=<uuid>
      ?stage=<name>     or  ?stage_id=<uuid>
      ?page=1&per_page=20
    """
    try:
        page = request.args.get("page", 1, type=int)
        per_page = min(request.args.get("per_page", 20, type=int), 100)

        industry_name = request.args.get("industry")
        industry_id = request.args.get("industry_id")
        stage_name = request.args.get("stage")
        stage_id = request.args.get("stage_id")

        iid, sid = _resolve_industry_stage(industry_id, industry_name, stage_id, stage_name)

        q = db.session.query(Enterprise).join(
            EnterpriseProfile, EnterpriseProfile.enterprise_id == Enterprise.id
        ).filter(
            Enterprise.enterprise_type.in_(["startup", "both"]),
            Enterprise.status.in_(["active", "pending"])  # visible-ish
        )

        if iid:
            q = q.filter(EnterpriseProfile.industry_id == iid)
        if sid:
            q = q.filter(EnterpriseProfile.stage_id == sid)

        q = q.order_by(Enterprise.created_at.desc()) if hasattr(Enterprise, "created_at") else q

        pagination = q.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            "enterprises": [_enterprise_detail(e) for e in pagination.items],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": pagination.total,
                "pages": pagination.pages,
                "has_next": pagination.has_next,
                "has_prev": pagination.has_prev,
            },
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@enterprise_bp.route("/enterprises/<uuid:enterprise_id>", methods=["GET"])
def get_enterprise_detail(enterprise_id):
    try:
        ent = Enterprise.query.get(enterprise_id)
        if not ent or ent.status not in ("active", "pending"):
            return jsonify({"error": "Enterprise not found or inactive"}), 404
        return jsonify({"enterprise": _enterprise_detail(ent)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@enterprise_bp.route("/enterprises/<uuid:enterprise_id>", methods=["PUT"])
@require_enterprise_role(required_roles=("owner", "admin"))
def update_enterprise_core_data(enterprise_id):
    """
    Update enterprise + profiles (owner/admin only).
    Allowed fields (mapped to proper tables):
      - Enterprise: name, location, website, logo_url, employee_count, status
      - EnterpriseProfile: description, industry(_id|_name), stage(_id|_name),
                           contact_info, social_media, key_metrics,
                           competitive_advantages, target_markets
      - StartupProfile: business_model, team_size, target_market, revenue_model,
                        current_revenue, monthly_growth_rate, customer_count,
                        traction_metrics, intellectual_property, regulatory_considerations
    """
    try:
        data = request.get_json() or {}
        ent = Enterprise.query.get(enterprise_id)
        if not ent:
            return jsonify({"error": "Enterprise not found"}), 404

        # Enterprise fields
        for f in ["name", "location", "website", "logo_url", "employee_count", "status"]:
            if f in data:
                setattr(ent, f, data[f])

        # EnterpriseProfile
        prof = EnterpriseProfile.query.filter_by(enterprise_id=enterprise_id).first()
        if not prof:
            prof = EnterpriseProfile(enterprise_id=enterprise_id)
            db.session.add(prof)

        # resolve industry/stage if provided
        iid, sid = _resolve_industry_stage(
            industry_id=data.get("industry_id"),
            industry_name=data.get("industry"),
            stage_id=data.get("stage_id"),
            stage_name=data.get("stage"),
        )
        if iid is not None:
            prof.industry_id = iid
        if sid is not None:
            prof.stage_id = sid

        for f in [
            "description", "contact_info", "social_media", "key_metrics",
            "competitive_advantages", "target_markets",
        ]:
            if f in data:
                setattr(prof, f, data[f])

        # StartupProfile
        sp = StartupProfile.query.filter_by(enterprise_id=enterprise_id).first()
        if not sp:
            sp = StartupProfile(enterprise_id=enterprise_id)
            db.session.add(sp)

        for f in [
            "business_model", "value_proposition", "team_size", "target_market",
            "revenue_model", "current_revenue", "monthly_growth_rate",
            "customer_count", "market_size", "addressable_market",
            "traction_metrics", "intellectual_property", "regulatory_considerations",
        ]:
            if f in data:
                setattr(sp, f, data[f])

        db.session.commit()
        return jsonify({"message": "Enterprise updated successfully", "enterprise": _enterprise_detail(ent)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@enterprise_bp.route("/fundraising-status", methods=["PUT"])
def update_fundraising_status():
    """
    Your schema doesn't have 'is_actively_fundraising'.
    We map this endpoint to update Enterprise.status instead (active/inactive/pending/suspended).
    If you send { "status": "active" }, we'll apply it to the caller's owned startup enterprise.
    """
    user, _, err = require_auth()
    if err:
        return err

    # Find first owned startup enterprise
    owned = (
        db.session.query(Enterprise)
        .join(EnterpriseUser, EnterpriseUser.enterprise_id == Enterprise.id)
        .filter(
            EnterpriseUser.user_id == user.id,
            EnterpriseUser.role == "owner",
            EnterpriseUser.is_active.is_(True),
            Enterprise.enterprise_type.in_(["startup", "both"]),
        )
        .first()
    )
    if not owned:
        return jsonify({"error": "No owned startup enterprise found"}), 404

    data = request.get_json() or {}
    new_status = data.get("status")
    allowed = {"active", "inactive", "pending", "suspended"}
    if new_status and new_status in allowed:
        owned.status = new_status
        db.session.commit()
        return jsonify({"message": "Status updated", "enterprise": _enterprise_detail(owned)}), 200
    return jsonify({"error": f"Provide valid 'status' in {sorted(allowed)}"}), 400


@enterprise_bp.route("/stats", methods=["GET"])
def get_entrepreneur_stats():
    """
    Stats for the caller's owned startup enterprise:
      - total_matches
      - investor_interest (MatchInteraction 'investment_interest')
      - recent_matches_30d
      - interest_rate (% interactions / matches)
    """
    user, _, err = require_auth()
    if err:
        return err

    ent = (
        db.session.query(Enterprise)
        .join(EnterpriseUser, EnterpriseUser.enterprise_id == Enterprise.id)
        .filter(
            EnterpriseUser.user_id == user.id,
            EnterpriseUser.role.in_(["owner", "admin"]),
            EnterpriseUser.is_active.is_(True),
            Enterprise.enterprise_type.in_(["startup", "both"]),
        )
        .first()
    )
    if not ent:
        return jsonify({"error": "No startup enterprise found for user"}), 404

    total_matches = MatchScore.query.filter_by(starter_enterprise_id=ent.id).count() \
        if hasattr(MatchScore, "starter_enterprise_id") else \
        MatchScore.query.filter(MatchScore.startup_enterprise_id == ent.id).count()

    investor_interest = db.session.query(func.count(MatchInteraction.id)).join(
        MatchScore, MatchInteraction.match_id == MatchScore.id
    ).filter(
        MatchScore.startup_enterprise_id == ent.id,
        MatchInteraction.interaction_type == "investment_interest",
    ).scalar() or 0

    recent_30d = MatchScore.query.filter(
        MatchScore.startup_enterprise_id == ent.id,
        MatchScore.calculated_at >= (datetime.utcnow() - timedelta(days=30)),
    ).count()

    interest_rate = round((investor_interest / total_matches * 100.0), 2) if total_matches else 0.0

    stats = {
        "enterprise_id": str(ent.id),
        "total_matches": total_matches,
        "investor_interest": investor_interest,
        "recent_matches_30d": recent_30d,
        "interest_rate_pct": interest_rate,
    }
    return jsonify({"stats": stats}), 200


@enterprise_bp.route("/admin/enterprise-stats", methods=["GET"])
def get_enterprise_analytics():
    """
    Admin-leaning overview. We consider 'admin-like' = owner/admin of any org.
    """
    user, _, err = require_auth()
    if err:
        return err
    if not is_admin_like(user):
        return jsonify({"error": "Admin access required"}), 403

    total = Enterprise.query.count()
    by_type = {
        "investor": Enterprise.query.filter(Enterprise.enterprise_type == "investor").count(),
        "startup": Enterprise.query.filter(Enterprise.enterprise_type == "startup").count(),
        "both": Enterprise.query.filter(Enterprise.enterprise_type == "both").count(),
    }
    by_status = {
        "active": Enterprise.query.filter(Enterprise.status == "active").count(),
        "inactive": Enterprise.query.filter(Enterprise.status == "inactive").count(),
        "pending": Enterprise.query.filter(Enterprise.status == "pending").count(),
        "suspended": Enterprise.query.filter(Enterprise.status == "suspended").count(),
    }

    # Industry distribution via EnterpriseProfile
    industry_rows = db.session.query(
        Industry.name, func.count(EnterpriseProfile.enterprise_id)
    ).join(EnterpriseProfile, EnterpriseProfile.industry_id == Industry.id
    ).group_by(Industry.name).order_by(func.count(EnterpriseProfile.enterprise_id).desc()).all()
    industries = {name or "Unspecified": count for (name, count) in industry_rows}

    # Stage distribution via EnterpriseProfile
    stage_rows = db.session.query(
        Stage.name, func.count(EnterpriseProfile.enterprise_id)
    ).join(EnterpriseProfile, EnterpriseProfile.stage_id == Stage.id
    ).group_by(Stage.name).all()
    stages = {name or "Unspecified": count for (name, count) in stage_rows}

    return jsonify({
        "total_enterprises": total,
        "by_type": by_type,
        "by_status": by_status,
        "by_industry": industries,
        "by_stage": stages,
    }), 200