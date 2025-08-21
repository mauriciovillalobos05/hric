from __future__ import annotations

import os
import requests
from decimal import Decimal, InvalidOperation

from flask import Blueprint, request, jsonify
from sqlalchemy import func

from src.extensions import db
from src.models.user import (
    # users & orgs
    User, Enterprise, EnterpriseUser, EnterpriseProfile, StartupProfile,
    # lookups
    Industry, Stage,
)
from decimal import Decimal, InvalidOperation

entrepreneur_bp = Blueprint("entrepreneur", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")


# ---------- Auth ----------

def require_auth():
    """Validate Supabase JWT and return (user, token, error_or_None)."""
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

    user = db.session.get(User, user_id)
    if not user:
        return None, None, (jsonify({"error": "User not found in database"}), 404)
    return user, token, None


# ---------- Helpers ----------
def _to_number(v):
    """For JSON fields: return float or None (never Decimal)."""
    if v is None or v == "":
        return None
    try:
        return float(Decimal(str(v)))
    except (InvalidOperation, TypeError, ValueError):
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

_STAGE_ORDER = {
    "idea": 0,
    "pre-seed": 1, "pre seed": 1, "preseed": 1,
    "seed": 2,
    "series a": 3, "series-a": 3,
    "series b": 4, "series-b": 4,
    "series c": 5, "series-c": 5,
    "growth": 6, "series d": 6,
    "ipo": 7,
}

def _normalize(s: str | None) -> str:
    return (s or "").strip()

def _normalize_key(s: str | None) -> str:
    return (s or "").strip().lower().replace("_", " ").replace("-", " ")

def _to_decimal(v):
    if v is None or v == "":
        return None
    try:
        return Decimal(str(v))
    except (InvalidOperation, TypeError, ValueError):
        return None

def _ensure_industry(name: str) -> Industry | None:
    n = _normalize(name)
    if not n:
        return None
    obj = db.session.query(Industry).filter(Industry.name.ilike(n)).first()
    if not obj:
        obj = Industry(name=n, is_active=True)
        db.session.add(obj)
        db.session.flush()
    return obj

def _ensure_stage(name: str) -> Stage | None:
    n = _normalize(name)
    if not n:
        return None
    st = db.session.query(Stage).filter(Stage.name.ilike(n)).first()
    if st:
        return st
    order = _STAGE_ORDER.get(_normalize_key(n), max(_STAGE_ORDER.values(), default=0) + 1)
    st = Stage(name=n, description=None, order_sequence=order, stage_type="both", is_active=True)
    db.session.add(st)
    db.session.flush()
    return st

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


# ---------- Routes ----------

@entrepreneur_bp.route("/profile", methods=["POST"])
def upsert_startup_profile():
    """
    Create/update the entrepreneur's startup profile for their OWNER enterprise.
    If the user has no owner startup enterprise, a new one is created.
    """
    try:
        user, _, err = require_auth()
        if err:
            return err

        data = request.get_json(silent=True) or {}

        # Ensure enterprise (owner)
        ent = _ensure_owner_startup_enterprise(user, data.get("name"), data.get("location"))

        # If user also owns an investor org, flip enterprise_type to 'both' when needed
        if ent.enterprise_type not in ("startup", "both"):
            ent.enterprise_type = "startup"
        if data.get("name"):
            ent.name = data["name"]
        if data.get("location"):
            ent.location = data["location"]

        # Ensure EnterpriseProfile
        ep = db.session.query(EnterpriseProfile).filter_by(enterprise_id=ent.id).first()
        if not ep:
            ep = EnterpriseProfile(enterprise_id=ent.id)
            db.session.add(ep)
            db.session.flush()

        # Link lookups
        if "industry" in data:
            ind = _ensure_industry(data.get("industry"))
            ep.industry_id = ind.id if ind else None

        if "stage" in data:
            st = _ensure_stage(data.get("stage"))
            ep.stage_id = st.id if st else None

        # Store descriptive fields
        ep.description = data.get("problem_solved") or ep.description
        # Social links: stash pitch deck / demo
        ep.social_media = {
            **(ep.social_media or {}),
            "pitch_deck_url": data.get("pitch_deck_url"),
            "demo_url": data.get("demo_url"),
        }
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
        ep.key_metrics = _json_safe(km)   # <- ensure no Decimals sneak in


        # Ensure StartupProfile
        sp = db.session.query(StartupProfile).filter_by(enterprise_id=ent.id).first()
        if not sp:
            sp = StartupProfile(enterprise_id=ent.id)
            db.session.add(sp)

        sp.business_model = data.get("business_model")
        sp.value_proposition = data.get("problem_solved")
        sp.team_size = _team_size_to_int(data.get("team_size"))
        sp.target_market = data.get("target_market")
        sp.traction_metrics = {
            **(sp.traction_metrics or {}),
            "summary": data.get("traction_summary"),
        }

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
            },
            "startup_profile": {
                "business_model": sp.business_model if sp else None,
                "value_proposition": sp.value_proposition if sp else None,
                "team_size": sp.team_size if sp else None,
                "target_market": sp.target_market if sp else None,
                "traction_metrics": sp.traction_metrics if sp else {},
            }
        }
        return jsonify(resp), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@entrepreneur_bp.route("/profile", methods=["PATCH"])
def update_startup_profile():
    """
    Update fields for a specific startup enterprise. Body must include enterprise_id.
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
            ind = _ensure_industry(data.get("industry"))
            ep.industry_id = ind.id if ind else None
        if "stage" in data:
            st = _ensure_stage(data.get("stage"))
            ep.stage_id = st.id if st else None
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