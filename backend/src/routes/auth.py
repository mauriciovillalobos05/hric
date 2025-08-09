# src/routes/auth.py

from datetime import datetime
import os
import re
import requests
from flask import Blueprint, jsonify, request, session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from src.extensions import db
from src.models.user import (
    # core
    User, Enterprise, EnterpriseUser,
    # profiles / lookups
    EnterpriseProfile, InvestorProfile, InvestmentPreferences, StartupProfile,
    # matching
    MatchScore, MatchInteraction,
    # events & docs & comms
    Event, Document, Messaging,
)

auth_bp = Blueprint("auth", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------
def _require_bearer_token():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, jsonify({"error": "Missing or invalid Authorization header"}), 401
    return auth_header.split(" ")[1], None, None


def _fetch_supabase_user(token: str):
    """Calls Supabase /auth/v1/user to get the current user payload."""
    resp = requests.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
        timeout=15,
    )
    return resp


def _name_parts(meta):
    # Try to split a full_name if first/last are absent
    first = (meta or {}).get("first_name") or ""
    last = (meta or {}).get("last_name") or ""
    if not first and not last:
        full = (meta or {}).get("full_name") or ""
        parts = [p for p in full.strip().split(" ") if p]
        if len(parts) >= 2:
            first = parts[0]
            last = " ".join(parts[1:])
        elif len(parts) == 1:
            first = parts[0]
    return first, last


def _ensure_enterprise_and_membership(user: User, role: str, payload: dict):
    """
    For onboarding: create an investor or startup enterprise (and profile) and
    attach the current user as 'owner' if none exists yet.
    """
    role = (role or "").lower()
    if role not in ("investor", "entrepreneur", "startup"):
        return

    # Does user already own/belong to an enterprise of that type?
    existing = (
        db.session.query(Enterprise)
        .join(EnterpriseUser, EnterpriseUser.enterprise_id == Enterprise.id)
        .filter(
            EnterpriseUser.user_id == user.id,
            EnterpriseUser.is_active.is_(True),
            Enterprise.enterprise_type.in_(
                ["investor", "both"] if role == "investor" else ["startup", "both"]
            ),
        )
        .first()
    )
    if existing:
        return

    # Create minimal enterprise + profile
    if role == "investor":
        ent = Enterprise(
            name=payload.get("company_name") or f"{user.first_name} {user.last_name} Investments",
            enterprise_type="investor",
            website=payload.get("website_url"),
            location=payload.get("location"),
            status="active",
        )
        db.session.add(ent)
        db.session.flush()

        inv_profile = InvestorProfile(
            enterprise_id=ent.id,
            min_investment=payload.get("investment_range_min"),
            max_investment=payload.get("investment_range_max"),
            investment_thesis=payload.get("investment_thesis"),
            investment_approach=payload.get("investment_approach"),
            portfolio_companies=payload.get("portfolio_companies", []),
            value_add_services=payload.get("value_add_services", []),
            geographic_focus=payload.get("geographic_focus", []),
        )
        db.session.add(inv_profile)

        # optional preferences container
        prefs = InvestmentPreferences(
            investor_profile_id=None,  # set after flush
            preferred_industries=payload.get("industries", []),
            preferred_stages=payload.get("investment_stages", []),
            geographic_preferences=payload.get("geographic_focus", []),
            min_deal_size=payload.get("investment_range_min"),
            max_deal_size=payload.get("investment_range_max"),
        )
        db.session.flush()
        prefs.investor_profile_id = inv_profile.id
        db.session.add(prefs)

    else:
        ent = Enterprise(
            name=payload.get("company_name") or f"{user.first_name} {user.last_name} Startup",
            enterprise_type="startup",
            website=payload.get("website_url"),
            location=payload.get("location"),
            status="active",
        )
        db.session.add(ent)
        db.session.flush()

        # EnterpriseProfile with industry/stage if provided
        ep = EnterpriseProfile(
            enterprise_id=ent.id,
            description=payload.get("company_description"),
        )
        db.session.add(ep)

        sp = StartupProfile(
            enterprise_id=ent.id,
            business_model=payload.get("business_model"),
            team_size=payload.get("team_size"),
            value_proposition=payload.get("value_proposition"),
            target_market=payload.get("target_market"),
            revenue_model=payload.get("revenue_model"),
        )
        db.session.add(sp)

    # Owner membership
    db.session.add(
        EnterpriseUser(
            enterprise_id=ent.id,
            user_id=user.id,
            role="owner",
            is_active=True,
        )
    )


def _summarize_user(user: User):
    # Small helper for consistent shape
    memberships = [
        {
            "enterprise_id": str(m.enterprise_id),
            "role": m.role,
            "is_active": m.is_active,
        }
        for m in user.enterprise_memberships
    ]
    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "profile_image_url": user.profile_image_url,
        "onboarding_completed": bool(user.onboarding_completed),
        "last_active_at": user.last_active_at.isoformat() if user.last_active_at else None,
        "memberships": memberships,
    }


# -------------------------------------------------------------------
# POST /auth/register-complete
# -------------------------------------------------------------------
@auth_bp.route("/register-complete", methods=["POST"])
def register_complete():
    """
    Finalize onboarding for a Supabase user:
      - upsert User with provided supabase_id/email/basic fields
      - if role=investor or entrepreneur/startup, create enterprise+profile and make the user the owner
    """
    try:
        data = request.get_json() or {}
        for f in ("supabase_id", "email", "role", "first_name", "last_name"):
            if not data.get(f):
                return jsonify({"error": f"{f} is required"}), 400

        # Upsert user
        user = User.query.get(data["supabase_id"])
        if user:
            return jsonify({"error": "User already exists"}), 409

        user = User(
            id=data["supabase_id"],
            email=data["email"].lower(),
            first_name=data["first_name"],
            last_name=data["last_name"],
            phone=data.get("phone"),
            timezone=data.get("timezone") or "UTC",
            language_preference=data.get("language_preference") or "en",
            bio=data.get("bio"),
            profile_image_url=data.get("profile_image"),
            linkedin_url=data.get("linkedin_url"),
            twitter_url=data.get("twitter_url"),
            website_url=data.get("website_url"),
            onboarding_completed=False,
            is_active=True,
        )
        db.session.add(user)
        db.session.flush()

        # Create enterprise/profile for role
        _ensure_enterprise_and_membership(user, data.get("role"), data)

        # Mark onboarding as pending or complete (your choice)
        user.onboarding_completed = True
        db.session.commit()

        return jsonify({"message": "User onboarding complete", "user": _summarize_user(user)}), 201
    except IntegrityError as ie:
        db.session.rollback()
        return jsonify({"error": "Constraint error", "detail": str(ie)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------------
# POST /auth/track-login
# -------------------------------------------------------------------
@auth_bp.route("/track-login", methods=["POST"])
def track_login():
    try:
        token, err, code = _require_bearer_token()
        if err:
            return err, code

        resp = _fetch_supabase_user(token)
        if resp.status_code != 200:
            return jsonify({"error": "Invalid supabase token"}), 401
        supa = resp.json()
        user = User.query.get(supa["id"])
        if not user:
            return jsonify({"error": "User not found"}), 404

        user.last_active_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"message": "Login tracked"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------------
# POST /auth/logout
# -------------------------------------------------------------------
@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logout successful"}), 200


# -------------------------------------------------------------------
# GET /auth/me
# -------------------------------------------------------------------
@auth_bp.route("/me", methods=["GET"])
def get_current_user():
    try:
        token, err, code = _require_bearer_token()
        if err:
            return err, code

        resp = _fetch_supabase_user(token)
        if resp.status_code != 200:
            return jsonify({"error": "Invalid supabase token"}), 401
        supa = resp.json()

        user = User.query.get(supa["id"])
        if not user:
            return jsonify({"error": "User not found"}), 404

        payload = _summarize_user(user)
        # Add snapshot of orgs (names + types)
        ent_ids = [m.enterprise_id for m in user.enterprise_memberships if m.is_active]
        orgs = Enterprise.query.filter(Enterprise.id.in_(ent_ids)).all() if ent_ids else []
        payload["organizations"] = [{"id": str(o.id), "name": o.name, "type": o.enterprise_type} for o in orgs]

        return jsonify({"user": payload}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------------
# PUT /auth/profile
# -------------------------------------------------------------------
@auth_bp.route("/profile", methods=["PUT"])
def update_profile():
    try:
        token, err, code = _require_bearer_token()
        if err:
            return err, code

        resp = _fetch_supabase_user(token)
        if resp.status_code != 200:
            return jsonify({"error": "Invalid supabase token"}), 401
        supa = resp.json()
        user = User.query.get(supa["id"])
        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json() or {}

        # Update core fields
        for field in [
            "first_name",
            "last_name",
            "phone",
            "bio",
            "linkedin_url",
            "twitter_url",
            "website_url",
            "profile_image_url",
            "timezone",
            "language_preference",
        ]:
            if field in data and data[field] is not None:
                setattr(user, field, data[field])

        # Detect one investor org and one startup org the user belongs to
        ent_ids = [m.enterprise_id for m in user.enterprise_memberships if m.is_active]
        orgs = Enterprise.query.filter(Enterprise.id.in_(ent_ids)).all() if ent_ids else []

        investor_org = next((o for o in orgs if o.enterprise_type in ("investor", "both")), None)
        startup_org = next((o for o in orgs if o.enterprise_type in ("startup", "both")), None)

        # Update investor profile if present
        if investor_org:
            invp = InvestorProfile.query.filter_by(enterprise_id=investor_org.id).first()
            if invp:
                for f in [
                    "investment_thesis",
                    "investment_approach",
                    "years_experience",
                    "total_investments",
                    "successful_exits",
                ]:
                    if f in data:
                        setattr(invp, f, data[f])
                if "min_investment" in data:
                    invp.min_investment = data["min_investment"]
                if "max_investment" in data:
                    invp.max_investment = data["max_investment"]

                # Preferences
                prefs = InvestmentPreferences.query.filter_by(investor_profile_id=invp.id).first()
                if not prefs:
                    prefs = InvestmentPreferences(investor_profile_id=invp.id)
                    db.session.add(prefs)

                for f in [
                    "preferred_industries",
                    "preferred_stages",
                    "geographic_preferences",
                    "min_deal_size",
                    "max_deal_size",
                    "investment_criteria",
                    "exclusion_criteria",
                    "due_diligence_requirements",
                    "decision_timeline_days",
                    "follow_on_strategy",
                ]:
                    if f in data:
                        setattr(prefs, f, data[f])

        # Update startup profile if present
        if startup_org:
            sp = StartupProfile.query.filter_by(enterprise_id=startup_org.id).first()
            if sp:
                for f in [
                    "business_model",
                    "value_proposition",
                    "team_size",
                    "target_market",
                    "competitive_advantages",
                    "revenue_model",
                    "current_revenue",
                    "monthly_growth_rate",
                    "customer_count",
                    "market_size",
                    "addressable_market",
                    "traction_metrics",
                    "intellectual_property",
                    "regulatory_considerations",
                ]:
                    if f in data:
                        setattr(sp, f, data[f])

        db.session.commit()
        return jsonify({"message": "Profile updated", "user": _summarize_user(user)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------------
# POST/GET /auth/enterprise/<uuid>/likes
# -------------------------------------------------------------------
@auth_bp.route("/enterprise/<uuid:enterprise_id>/likes", methods=["POST", "GET"])
def handle_likes(enterprise_id):
    try:
        token, err, code = _require_bearer_token()
        if err:
            return err, code

        resp = _fetch_supabase_user(token)
        if resp.status_code != 200:
            return jsonify({"error": "Invalid supabase token"}), 401
        supa = resp.json()
        user = User.query.get(supa["id"])
        if not user:
            return jsonify({"error": "User not found"}), 404

        target = Enterprise.query.get(enterprise_id)
        if not target:
            return jsonify({"error": "Enterprise not found"}), 404

        # User must belong to an investor org to like a startup enterprise
        my_investor_org_ids = [
            m.enterprise_id
            for m in user.enterprise_memberships
            if m.is_active
        ]
        has_investor_org = (
            db.session.query(Enterprise.id)
            .filter(
                Enterprise.id.in_(my_investor_org_ids or []),
                Enterprise.enterprise_type.in_(["investor", "both"]),
            )
            .first()
            is not None
        )
        if not has_investor_org:
            return jsonify({"error": "Only investors can perform this action"}), 403

        if request.method == "POST":
            # Ensure a MatchScore row exists between one of my investor orgs and this startup
            investor_ent = (
                db.session.query(Enterprise)
                .filter(
                    Enterprise.id.in_(my_investor_org_ids or []),
                    Enterprise.enterprise_type.in_(["investor", "both"]),
                )
                .first()
            )
            if not investor_ent:
                return jsonify({"error": "No investor enterprise found for user"}), 400

            match = (
                MatchScore.query.filter_by(
                    investor_enterprise_id=investor_ent.id,
                    startup_enterprise_id=target.id,
                ).first()
            )
            if not match:
                match = MatchScore(
                    investor_enterprise_id=investor_ent.id,
                    startup_enterprise_id=target.id,
                    overall_score=0,
                    compatibility_score=0,
                    fit_score=0,
                    is_active=True,
                )
                db.session.add(match)
                db.session.flush()

            # Has the user already liked this match?
            exists = (
                MatchInteraction.query.filter_by(
                    match_id=match.id, user_id=user.id, interaction_type="like"
                ).first()
            )
            if exists:
                return jsonify({"message": "Already liked"}), 200

            db.session.add(
                MatchInteraction(
                    match_id=match.id,
                    user_id=user.id,
                    interaction_type="like",
                )
            )
            db.session.commit()
            return jsonify({"message": "Enterprise liked"}), 201

        # GET: return a count of likes for any match involving this startup
        like_count = (
            db.session.query(func.count(MatchInteraction.id))
            .join(MatchScore, MatchInteraction.match_id == MatchScore.id)
            .filter(
                MatchScore.startup_enterprise_id == target.id,
                MatchInteraction.interaction_type == "like",
            )
            .scalar()
            or 0
        )
        return jsonify({"enterprise_id": str(target.id), "likes": like_count}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------------
# NEW: POST /auth/sync-supabase
# -------------------------------------------------------------------
@auth_bp.route("/sync-supabase", methods=["POST"])
def sync_supabase():
    """
    Upsert the local User record with fields from Supabase /auth/v1/user.
    Useful when the user updates their name/email/avatar in Supabase.
    """
    try:
        token, err, code = _require_bearer_token()
        if err:
            return err, code

        resp = _fetch_supabase_user(token)
        if resp.status_code != 200:
            return jsonify({"error": "Invalid supabase token"}), 401

        data = resp.json()
        meta = data.get("user_metadata") or {}
        first_name, last_name = _name_parts(meta)

        user = User.query.get(data["id"])
        if not user:
            # create a minimal local record
            user = User(
                id=data["id"],
                email=(data.get("email") or "").lower() or None,
                first_name=first_name or "",
                last_name=last_name or "",
                phone=data.get("phone"),
                profile_image_url=meta.get("avatar_url"),
                is_active=True,
            )
            db.session.add(user)
        else:
            # update fields from Supabase
            email = (data.get("email") or "").lower() or user.email
            user.email = email
            if first_name:
                user.first_name = first_name
            if last_name:
                user.last_name = last_name
            if data.get("phone"):
                user.phone = data["phone"]
            if meta.get("avatar_url"):
                user.profile_image_url = meta["avatar_url"]

        user.last_active_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"message": "Synced from Supabase", "user": _summarize_user(user)}), 200

    except IntegrityError as ie:
        db.session.rollback()
        return jsonify({"error": "Constraint error", "detail": str(ie)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500