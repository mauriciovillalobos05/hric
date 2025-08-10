# src/routes/enterprise.py

from __future__ import annotations

from datetime import datetime, timedelta
import os
import uuid
from functools import wraps
from decimal import Decimal, InvalidOperation

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

# -------------------------------------------------
# Blueprints
# -------------------------------------------------
enterprise_bp = Blueprint("enterprise", __name__)
entrepreneur_bp = Blueprint("entrepreneur", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
LOCAL_API_BASE_URL = os.getenv("LOCAL_API_BASE_URL")

# -------------------------------------------------
# Auth / role helpers (shared)
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
# Shared utils
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
            # NEW: headline tags
            "headline_tags": profile.headline_tags if profile and profile.headline_tags else [],
        },
        "startup_profile": {
            "business_model": startup.business_model if startup else None,
            "team_size": startup.team_size if startup else None,
            "target_market": startup.target_market if startup else None,
            "revenue_model": startup.revenue_model if startup else None,
            "current_revenue": float(startup.current_revenue or 0) if startup else 0,
            "monthly_growth_rate": float(startup.monthly_growth_rate or 0) if startup else 0,
            "customer_count": startup.customer_count if startup else None,
            # NEW: richer financial & team signals
            "mrr_usd": float(startup.display_mrr_usd) if startup and startup.display_mrr_usd is not None else None,
            "arr_usd": float(startup.arr_usd) if startup and startup.arr_usd is not None else None,
            "current_valuation_usd": float(startup.display_valuation_usd) if startup and startup.display_valuation_usd is not None else None,
            "current_investors": startup.current_investors if startup and startup.current_investors else [],
            "technical_founders_pct": float(startup.technical_founders_pct) if startup and startup.technical_founders_pct is not None else None,
            "previous_exits_pct": float(startup.previous_exits_pct) if startup and startup.previous_exits_pct is not None else None,
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


def _to_decimal(v):
    if v is None or v == "":
        return None
    try:
        return Decimal(str(v))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _to_number(v):
    """Return float or None; avoids Decimal in JSON responses."""
    d = _to_decimal(v)
    return float(d) if d is not None else None


def _team_size_to_int(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return int(v)
    s = str(v)
    if s.endswith("+"):
        try:
            return int(s[:-1])
        except ValueError:
            return None
    if "-" in s:
        try:
            a, b = s.split("-", 1)
            a, b = int(a), int(b)
            return max(a, b)
        except Exception:
            return None
    try:
        return int(s)
    except ValueError:
        return None


def _json_safe(obj):
    """Recursively convert Decimals -> float for JSONB safety."""
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, Decimal):
        return float(obj)
    return obj


def _to_str_list(v):
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    if isinstance(v, str):
        return [x.strip() for x in v.split(",") if x.strip()]
    return []


# -------------------------------------------------
# Enterprise routes (startup creation, explore, admin, etc.)
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
      NEW:
        profile.headline_tags (array of strings)
        startup: mrr_usd, arr_usd, current_valuation_usd, current_investors (array of strings),
                 technical_founders_pct, previous_exits_pct
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
        employee_count=_team_size_to_int(data.get("team_size")),
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
        contact_info=_json_safe(data.get("contact_info") or {}),
        social_media=_json_safe(data.get("social_media") or {}),
        key_metrics=_json_safe(data.get("key_metrics") or {}),
        competitive_advantages=data.get("competitive_advantages") or [],
        target_markets=data.get("target_markets") or [],
        # NEW
        headline_tags=_to_str_list(data.get("headline_tags") or data.get("tags")),
    )
    db.session.add(prof)

    # Create StartupProfile (+ NEW fields)
    mrr = _to_decimal(data.get("mrr_usd"))
    arr = _to_decimal(data.get("arr_usd")) or (mrr * 12 if mrr is not None else None)

    sp = StartupProfile(
        enterprise_id=ent.id,
        business_model=data.get("business_model"),
        value_proposition=data.get("value_proposition"),
        team_size=_team_size_to_int(data.get("team_size")),
        target_market=data.get("target_market"),
        competitive_advantages=data.get("competitive_advantages"),
        revenue_model=data.get("revenue_model"),
        current_revenue=_to_decimal(data.get("current_revenue")),
        monthly_growth_rate=_to_decimal(data.get("monthly_growth_rate")),
        customer_count=data.get("customer_count"),
        market_size=_to_decimal(data.get("market_size")),
        addressable_market=_to_decimal(data.get("addressable_market")),
        traction_metrics=_json_safe(data.get("traction_metrics") or {}),
        intellectual_property=_json_safe(data.get("intellectual_property") or {}),
        regulatory_considerations=data.get("regulatory_considerations"),
        # NEW
        mrr_usd=mrr,
        arr_usd=arr,
        current_valuation_usd=_to_decimal(data.get("current_valuation_usd")),
        current_investors=_to_str_list(data.get("current_investors")),
        technical_founders_pct=_to_decimal(data.get("technical_founders_pct")),
        previous_exits_pct=_to_decimal(data.get("previous_exits_pct")),
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
                           competitive_advantages, target_markets, headline_tags
      - StartupProfile: business_model, team_size, target_market, revenue_model,
                        current_revenue, monthly_growth_rate, customer_count,
                        traction_metrics, intellectual_property, regulatory_considerations,
                        mrr_usd, arr_usd, current_valuation_usd, current_investors,
                        technical_founders_pct, previous_exits_pct
    """
    try:
        data = request.get_json() or {}
        ent = Enterprise.query.get(enterprise_id)
        if not ent:
            return jsonify({"error": "Enterprise not found"}), 404

        # Enterprise fields
        for f in ["name", "location", "website", "logo_url", "status"]:
            if f in data:
                setattr(ent, f, data[f])
        if "employee_count" in data or "team_size" in data:
            ent.employee_count = _team_size_to_int(data.get("employee_count", data.get("team_size")))

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
                setattr(prof, f, _json_safe(data[f]) if isinstance(data[f], (dict, list)) else data[f])

        # NEW: headline_tags
        if "headline_tags" in data or "tags" in data:
            prof.headline_tags = _to_str_list(data.get("headline_tags") or data.get("tags"))

        # StartupProfile
        sp = StartupProfile.query.filter_by(enterprise_id=enterprise_id).first()
        if not sp:
            sp = StartupProfile(enterprise_id=enterprise_id)
            db.session.add(sp)

        for f in ("business_model", "value_proposition", "target_market", "revenue_model"):
            if f in data:
                setattr(sp, f, data[f])

        if "team_size" in data:
            sp.team_size = _team_size_to_int(data.get("team_size"))
        if "current_revenue" in data:
            sp.current_revenue = _to_decimal(data.get("current_revenue"))
        if "monthly_growth_rate" in data:
            sp.monthly_growth_rate = _to_decimal(data.get("monthly_growth_rate"))
        if "customer_count" in data:
            sp.customer_count = data.get("customer_count")
        if "market_size" in data:
            sp.market_size = _to_decimal(data.get("market_size"))
        if "addressable_market" in data:
            sp.addressable_market = _to_decimal(data.get("addressable_market"))
        if "traction_metrics" in data:
            sp.traction_metrics = _json_safe(data.get("traction_metrics") or {})
        if "intellectual_property" in data:
            sp.intellectual_property = _json_safe(data.get("intellectual_property") or {})
        if "regulatory_considerations" in data:
            sp.regulatory_considerations = data.get("regulatory_considerations")

        # NEW numeric & list fields
        if "mrr_usd" in data:
            sp.mrr_usd = _to_decimal(data.get("mrr_usd"))
        if "arr_usd" in data:
            sp.arr_usd = _to_decimal(data.get("arr_usd"))
        # compute arr if not provided but mrr was
        if sp.arr_usd is None and sp.mrr_usd is not None:
            sp.arr_usd = (sp.mrr_usd or Decimal(0)) * 12

        if "current_valuation_usd" in data:
            sp.current_valuation_usd = _to_decimal(data.get("current_valuation_usd"))
        if "current_investors" in data:
            sp.current_investors = _to_str_list(data.get("current_investors"))
        if "technical_founders_pct" in data:
            sp.technical_founders_pct = _to_decimal(data.get("technical_founders_pct"))
        if "previous_exits_pct" in data:
            sp.previous_exits_pct = _to_decimal(data.get("previous_exits_pct"))

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

    total_matches = MatchScore.query.filter(MatchScore.startup_enterprise_id == ent.id).count()

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


# -------------------------------------------------
# Entrepreneur routes (owner-upsert + reads/updates)
# -------------------------------------------------

def _ensure_owner_startup_enterprise(user: User, name: str | None, location: str | None) -> Enterprise:
    """
    Return an enterprise where the user is OWNER and enterprise_type in ('startup','both').
    If none, create one (startup) and add owner membership.
    """
    eu = (
        db.session.query(EnterpriseUser)
        .join(Enterprise, Enterprise.id == EnterpriseUser.enterprise_id)
        .filter(
            EnterpriseUser.user_id == user.id,
            EnterpriseUser.role == "owner",
            EnterpriseUser.is_active.is_(True),
            Enterprise.enterprise_type.in_(["startup", "both"]),
        )
        .first()
    )
    if eu:
        ent = db.session.get(Enterprise, eu.enterprise_id)
        return ent

    # Create a new startup enterprise
    ent = Enterprise(
        name=name or f"{user.first_name}'s Startup",
        enterprise_type="startup",
        location=location,
        is_verified=False,
        status="active",
    )
    db.session.add(ent)
    db.session.flush()

    owner = EnterpriseUser(enterprise_id=ent.id, user_id=user.id, role="owner", is_active=True)
    db.session.add(owner)
    db.session.flush()
    return ent


@entrepreneur_bp.route("/profile", methods=["POST"])
def upsert_startup_profile():
    """
    Create/update the entrepreneur's startup profile for their OWNER enterprise.
    If the user has no owner startup enterprise, a new one is created.

    NEW fields accepted:
      headline_tags (array of strings) on EnterpriseProfile
      mrr_usd, arr_usd, current_valuation_usd, current_investors (array),
      technical_founders_pct, previous_exits_pct on StartupProfile
    """
    try:
        user, _, err = require_auth()
        if err:
            return err

        data = request.get_json(silent=True) or {}

        # Ensure enterprise (owner)
        ent = _ensure_owner_startup_enterprise(user, data.get("name"), data.get("location"))

        # Enterprise basics
        if data.get("name"):
            ent.name = data["name"]
        if data.get("location"):
            ent.location = data["location"]
        if ent.enterprise_type not in ("startup", "both"):
            ent.enterprise_type = "startup"

        # Ensure EnterpriseProfile
        ep = db.session.query(EnterpriseProfile).filter_by(enterprise_id=ent.id).first()
        if not ep:
            ep = EnterpriseProfile(enterprise_id=ent.id)
            db.session.add(ep)
            db.session.flush()

        # Link lookups
        if "industry" in data:
            ind = Industry.query.filter(Industry.name.ilike(data["industry"].strip())).first()
            if not ind:
                ind = Industry(name=data["industry"].strip(), is_active=True)
                db.session.add(ind)
                db.session.flush()
            ep.industry_id = ind.id

        if "stage" in data:
            st = Stage.query.filter(Stage.name.ilike(data["stage"].strip())).first()
            if not st:
                # simple append; order sequence handled by your seeds/migrations
                st = Stage(name=data["stage"].strip(), order_sequence=99, stage_type="both", is_active=True)
                db.session.add(st)
                db.session.flush()
            ep.stage_id = st.id

        # Description & links
        ep.description = data.get("problem_solved") or data.get("description") or ep.description
        ep.social_media = {
            **(ep.social_media or {}),
            "pitch_deck_url": data.get("pitch_deck_url"),
            "demo_url": data.get("demo_url"),
        }
        # Headline tags (NEW)
        if "headline_tags" in data or "tags" in data:
            ep.headline_tags = _to_str_list(data.get("headline_tags") or data.get("tags"))

        # Key metrics
        km = (ep.key_metrics or {}).copy()
        if "funding_needed" in data:
            km["funding_needed"] = _to_number(data.get("funding_needed"))
        if "financials" in data and isinstance(data["financials"], dict):
            if "funding_goal" in data["financials"]:
                km["funding_goal"] = _to_number(data["financials"]["funding_goal"])
        if "team_size" in data:
            km["team_size"] = _team_size_to_int(data.get("team_size"))
        if "target_market" in data:
            km["target_market"] = data.get("target_market")
        ep.key_metrics = _json_safe(km)

        # Ensure StartupProfile
        sp = db.session.query(StartupProfile).filter_by(enterprise_id=ent.id).first()
        if not sp:
            sp = StartupProfile(enterprise_id=ent.id)
            db.session.add(sp)

        sp.business_model = data.get("business_model")
        sp.value_proposition = data.get("problem_solved") or data.get("value_proposition") or sp.value_proposition
        sp.team_size = _team_size_to_int(data.get("team_size"))
        sp.target_market = data.get("target_market")
        sp.traction_metrics = {**(sp.traction_metrics or {}), "summary": data.get("traction_summary")}

        # NEW numeric/list fields
        mrr = _to_decimal(data.get("mrr_usd"))
        arr = _to_decimal(data.get("arr_usd")) or (mrr * 12 if mrr is not None else None)
        sp.mrr_usd = mrr if mrr is not None else sp.mrr_usd
        sp.arr_usd = arr if arr is not None else sp.arr_usd
        if "current_valuation_usd" in data:
            sp.current_valuation_usd = _to_decimal(data.get("current_valuation_usd"))
        if "current_investors" in data:
            sp.current_investors = _to_str_list(data.get("current_investors"))
        if "technical_founders_pct" in data:
            sp.technical_founders_pct = _to_decimal(data.get("technical_founders_pct"))
        if "previous_exits_pct" in data:
            sp.previous_exits_pct = _to_decimal(data.get("previous_exits_pct"))

        # Optional: mark onboarding complete
        user.onboarding_completed = True

        db.session.commit()
        return jsonify({
            "message": "Entrepreneur profile saved",
            "enterprise_id": str(ent.id),
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to save entrepreneur profile: {str(e)}"}), 500


@entrepreneur_bp.route("/profile", methods=["GET"])
def get_startup_profile():
    """
    Optional: ?enterprise_id=<uuid>
    Returns the startup (entrepreneur) profile for that enterprise,
    or the first owner-startup enterprise if omitted.
    """
    try:
        user, _, err = require_auth()
        if err:
            return err

        enterprise_id = request.args.get("enterprise_id")
        ent = None

        if enterprise_id:
            # Ensure membership
            mem = (
                db.session.query(EnterpriseUser)
                .filter_by(user_id=user.id, enterprise_id=enterprise_id, is_active=True)
                .first()
            )
            if not mem:
                return jsonify({"error": "Not a member of this enterprise"}), 403
            ent = db.session.get(Enterprise, enterprise_id)
        else:
            # First owner startup/both enterprise
            eu = (
                db.session.query(EnterpriseUser)
                .join(Enterprise, Enterprise.id == EnterpriseUser.enterprise_id)
                .filter(
                    EnterpriseUser.user_id == user.id,
                    EnterpriseUser.role == "owner",
                    EnterpriseUser.is_active.is_(True),
                    Enterprise.enterprise_type.in_(["startup", "both"]),
                )
                .first()
            )
            if eu:
                ent = db.session.get(Enterprise, eu.enterprise_id)

        if not ent:
            return jsonify({"error": "Startup enterprise not found"}), 404

        ep = db.session.query(EnterpriseProfile).filter_by(enterprise_id=ent.id).first()
        sp = db.session.query(StartupProfile).filter_by(enterprise_id=ent.id).first()

        # Resolve lookup names
        industry_name = None
        stage_name = None
        if ep and ep.industry_id:
            ind = db.session.get(Industry, ep.industry_id)
            industry_name = ind.name if ind else None
        if ep and ep.stage_id:
            st = db.session.get(Stage, ep.stage_id)
            stage_name = st.name if st else None

        resp = {
            "enterprise": {
                "id": str(ent.id),
                "name": ent.name,
                "type": ent.enterprise_type,
                "location": ent.location,
                "website": ent.website,
                "logo_url": ent.logo_url,
            },
            "profile": {
                "industry": industry_name,
                "stage": stage_name,
                "description": ep.description if ep else None,
                "key_metrics": ep.key_metrics if ep else {},
                "social_media": ep.social_media if ep else {},
                # NEW
                "headline_tags": ep.headline_tags if ep and ep.headline_tags else [],
            },
            "startup_profile": {
                "business_model": sp.business_model if sp else None,
                "value_proposition": sp.value_proposition if sp else None,
                "team_size": sp.team_size if sp else None,
                "target_market": sp.target_market if sp else None,
                "traction_metrics": sp.traction_metrics if sp else {},
                # NEW richer fields
                "mrr_usd": float(sp.display_mrr_usd) if sp and sp.display_mrr_usd is not None else None,
                "arr_usd": float(sp.arr_usd) if sp and sp.arr_usd is not None else None,
                "current_valuation_usd": float(sp.display_valuation_usd) if sp and sp.display_valuation_usd is not None else None,
                "current_investors": sp.current_investors if sp and sp.current_investors else [],
                "technical_founders_pct": float(sp.technical_founders_pct) if sp and sp.technical_founders_pct is not None else None,
                "previous_exits_pct": float(sp.previous_exits_pct) if sp and sp.previous_exits_pct is not None else None,
            }
        }
        return jsonify(resp), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@entrepreneur_bp.route("/profile", methods=["PATCH"])
def update_startup_profile():
    """
    Update fields for a specific startup enterprise. Body must include enterprise_id.
    Supports NEW columns:
      headline_tags (EnterpriseProfile),
      mrr_usd, arr_usd, current_valuation_usd, current_investors,
      technical_founders_pct, previous_exits_pct (StartupProfile)
    """
    try:
        user, _, err = require_auth()
        if err:
            return err

        data = request.get_json() or {}
        enterprise_id = data.get("enterprise_id")
        if not enterprise_id:
            return jsonify({"error": "enterprise_id is required"}), 400

        mem = (
            db.session.query(EnterpriseUser)
            .filter_by(user_id=user.id, enterprise_id=enterprise_id, is_active=True)
            .first()
        )
        if not mem or mem.role not in ("owner", "admin"):
            return jsonify({"error": "Owner/admin membership required"}), 403

        ent = db.session.get(Enterprise, enterprise_id)
        if not ent:
            return jsonify({"error": "Enterprise not found"}), 404

        # Enterprise basics
        for f in ("name", "location", "website", "logo_url"):
            if f in data:
                setattr(ent, f, data.get(f))
        if ent.enterprise_type not in ("startup", "both"):
            ent.enterprise_type = "startup"

        # EnterpriseProfile
        ep = db.session.query(EnterpriseProfile).filter_by(enterprise_id=ent.id).first()
        if not ep:
            ep = EnterpriseProfile(enterprise_id=ent.id)
            db.session.add(ep)

        if "industry" in data:
            ind = Industry.query.filter(Industry.name.ilike(data["industry"].strip())).first()
            if not ind:
                ind = Industry(name=data["industry"].strip(), is_active=True)
                db.session.add(ind)
                db.session.flush()
            ep.industry_id = ind.id

        if "stage" in data:
            st = Stage.query.filter(Stage.name.ilike(data["stage"].strip())).first()
            if not st:
                st = Stage(name=data["stage"].strip(), order_sequence=99, stage_type="both", is_active=True)
                db.session.add(st)
                db.session.flush()
            ep.stage_id = st.id

        if "description" in data or "problem_solved" in data:
            ep.description = data.get("description") or data.get("problem_solved") or ep.description

        # social_media
        if "pitch_deck_url" in data or "demo_url" in data:
            ep.social_media = {
                **(ep.social_media or {}),
                "pitch_deck_url": data.get("pitch_deck_url", (ep.social_media or {}).get("pitch_deck_url")),
                "demo_url": data.get("demo_url", (ep.social_media or {}).get("demo_url")),
            }

        # key_metrics
        km = (ep.key_metrics or {}).copy()
        if "funding_needed" in data:
            km["funding_needed"] = _to_number(data.get("funding_needed"))
        if "financials" in data and isinstance(data["financials"], dict):
            if "funding_goal" in data["financials"]:
                km["funding_goal"] = _to_number(data["financials"]["funding_goal"])
        if "team_size" in data:
            km["team_size"] = _team_size_to_int(data.get("team_size"))
        if "target_market" in data:
            km["target_market"] = data.get("target_market")
        ep.key_metrics = _json_safe(km)

        # NEW: headline_tags
        if "headline_tags" in data or "tags" in data:
            ep.headline_tags = _to_str_list(data.get("headline_tags") or data.get("tags"))

        # StartupProfile
        sp = db.session.query(StartupProfile).filter_by(enterprise_id=ent.id).first()
        if not sp:
            sp = StartupProfile(enterprise_id=ent.id)
            db.session.add(sp)

        for f in ("business_model", "target_market"):
            if f in data:
                setattr(sp, f, data.get(f))
        if "team_size" in data:
            sp.team_size = _team_size_to_int(data.get("team_size"))
        if "problem_solved" in data:
            sp.value_proposition = data.get("problem_solved")
        if "traction_summary" in data:
            sp.traction_metrics = {**(sp.traction_metrics or {}), "summary": data.get("traction_summary")}

        # NEW numeric/list fields
        if "mrr_usd" in data:
            sp.mrr_usd = _to_decimal(data.get("mrr_usd"))
        if "arr_usd" in data:
            sp.arr_usd = _to_decimal(data.get("arr_usd"))
        if sp.arr_usd is None and sp.mrr_usd is not None:
            sp.arr_usd = (sp.mrr_usd or Decimal(0)) * 12

        if "current_valuation_usd" in data:
            sp.current_valuation_usd = _to_decimal(data.get("current_valuation_usd"))
        if "current_investors" in data:
            sp.current_investors = _to_str_list(data.get("current_investors"))
        if "technical_founders_pct" in data:
            sp.technical_founders_pct = _to_decimal(data.get("technical_founders_pct"))
        if "previous_exits_pct" in data:
            sp.previous_exits_pct = _to_decimal(data.get("previous_exits_pct"))

        db.session.commit()
        return jsonify({"message": "Entrepreneur profile updated"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to update entrepreneur profile: {str(e)}"}), 500


@entrepreneur_bp.route("/profile", methods=["DELETE"])
def delete_startup_profile():
    """
    Delete the startup profile (and related profile records) for an enterprise_id the user owns/admins.
    """
    try:
        user, _, err = require_auth()
        if err:
            return err

        enterprise_id = (request.get_json() or {}).get("enterprise_id")
        if not enterprise_id:
            return jsonify({"error": "enterprise_id is required"}), 400

        mem = (
            db.session.query(EnterpriseUser)
            .filter_by(user_id=user.id, enterprise_id=enterprise_id, is_active=True)
            .first()
        )
        if not mem or mem.role not in ("owner", "admin"):
            return jsonify({"error": "Owner/admin membership required"}), 403

        # Delete ONLY the startup-profile artifacts; keep the Enterprise shell.
        sp = db.session.query(StartupProfile).filter_by(enterprise_id=enterprise_id).first()
        ep = db.session.query(EnterpriseProfile).filter_by(enterprise_id=enterprise_id).first()
        if sp:
            db.session.delete(sp)
        if ep:
            db.session.delete(ep)

        db.session.commit()
        return jsonify({"message": "Entrepreneur profile deleted"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete entrepreneur profile: {str(e)}"}), 500