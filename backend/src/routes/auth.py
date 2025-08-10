from __future__ import annotations

from datetime import datetime, timezone
import os
from typing import Optional

import requests
from flask import Blueprint, jsonify, request

from src.extensions import db
# add to imports at the top
from src.models.user import User, Enterprise, EnterpriseUser, GeographicArea


auth_bp = Blueprint("auth", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")


# --------------------- Auth --------------------- #

def require_auth():
    """Validate Supabase JWT and return (user, token, error_tuple_or_None)."""
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


# --------------------- Helpers --------------------- #

def _role_to_enterprise_type(role: str) -> Optional[str]:
    r = (role or "").strip().lower()
    if r == "investor":
        return "investor"
    if r in ("entrepreneur", "startup", "founder"):
        return "startup"
    return None


def _default_enterprise_name(first_name: str, last_name: str, ent_type: str) -> str:
    first = (first_name or "").strip() or "New"
    last = (last_name or "").strip() or "User"
    if ent_type == "investor":
        return f"{first} {last} Capital"
    return f"{first} {last} Startup"


def _serialize_user(u: User):
    return {
        "id": str(u.id),
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "phone": u.phone,
        "location": u.location,  # NEW
        "stripe_customer_id": u.stripe_customer_id,
        "profile_image_url": u.profile_image_url,
        "bio": u.bio,
        "linkedin_url": u.linkedin_url,
        "twitter_url": u.twitter_url,
        "website_url": u.website_url,
        "timezone": u.timezone,
        "language_preference": u.language_preference,
        "onboarding_completed": bool(u.onboarding_completed),
        "is_active": bool(u.is_active),
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "updated_at": u.updated_at.isoformat() if u.updated_at else None,
    }


def _serialize_membership(m: EnterpriseUser):
    return {
        "id": str(m.id),
        "enterprise_id": str(m.enterprise_id),
        "user_id": str(m.user_id),
        "role": m.role,
        "is_active": bool(m.is_active),
        "joined_date": m.joined_date.isoformat() if m.joined_date else None,
    }


def _serialize_enterprise(e: Enterprise):
    return {
        "id": str(e.id),
        "name": e.name,
        "enterprise_type": e.enterprise_type,
        "description": e.description,
        "website": e.website,
        "location": e.location,
        "status": e.status,
        "is_verified": bool(e.is_verified),
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }

# in auth_bp file

def _serialize_membership(m: EnterpriseUser):
    # include enterprise details inline to avoid extra client calls
    ent = m.enterprise  # relationship access
    ent_payload = None
    if ent:
        ent_payload = {
            "id": str(ent.id),
            "name": ent.name,
            "enterprise_type": ent.enterprise_type,
            "location": ent.location,
            "website": ent.website,
            "status": ent.status,
        }
    return {
        "id": str(m.id),
        "enterprise_id": str(m.enterprise_id),
        "user_id": str(m.user_id),
        "role": m.role,
        "is_active": bool(m.is_active),
        "joined_date": m.joined_date.isoformat() if m.joined_date else None,
        "enterprise": ent_payload,
        # keep a flat copy for convenience:
        "enterprise_type": ent.enterprise_type if ent else None,
    }
# --------------------- Routes --------------------- #

@auth_bp.route("/register-complete", methods=["POST"])
def register_complete():
    data = request.get_json() or {}
    supabase_id = data.get("supabase_id")
    email       = data.get("email")
    first_name  = (data.get("first_name") or "").strip()
    last_name   = (data.get("last_name") or "").strip()
    phone       = (data.get("phone") or "").strip() or None
    role        = (data.get("role") or "entrepreneur").lower()
    raw_location= data.get("location")
    location    = (raw_location or "").strip() or None  # normalize

    if not (supabase_id and email):
        return jsonify({"error": "supabase_id and email required"}), 400

    # upsert (basic)
    user = db.session.get(User, supabase_id)
    if not user:
        user = User(
            id=supabase_id,
            email=email,
            first_name=first_name or "New",
            last_name=last_name or "User",
            phone=phone,
            location=location,
        )
        db.session.add(user)
    else:
        if first_name:
            user.first_name = first_name
        if last_name:
            user.last_name = last_name
        if phone is not None:
            user.phone = phone
        # set to None if empty string
        user.location = location

    # ensure GeographicArea row exists if we have a location
    if location:
        ga = db.session.query(GeographicArea).filter(GeographicArea.name.ilike(location)).first()
        if not ga:
            ga = GeographicArea(name=location)
            db.session.add(ga)

    # Create enterprise + owner membership if missing (active owner)
    ent_type = "investor" if role == "investor" else "startup"
    ent = (
        db.session.query(Enterprise)
        .join(EnterpriseUser, EnterpriseUser.enterprise_id == Enterprise.id)
        .filter(
            EnterpriseUser.user_id == user.id,
            EnterpriseUser.role == "owner",
            EnterpriseUser.is_active.is_(True),
        )
        .first()
    )

    if not ent:
        ent = Enterprise(
            name=f"{user.first_name} {user.last_name}".strip() or "New User",
            enterprise_type=ent_type,
            status="active",
        )
        db.session.add(ent)
        db.session.flush()  # get ent.id

        db.session.add(EnterpriseUser(
            enterprise_id=ent.id,
            user_id=user.id,
            role="owner",
            is_active=True,
        ))
    else:
        if ent.enterprise_type != ent_type:
            ent.enterprise_type = ent_type

    db.session.commit()
    return jsonify({"ok": True, "redirect": f"/complete-profile/{role}"}), 200


@auth_bp.route("/profile", methods=["PUT", "PATCH"])
def update_profile():
    user, _, err = require_auth()
    if err:
        return err

    data = request.get_json() or {}

    # simple fields
    for field in [
        "first_name", "last_name", "phone", "linkedin_url",
        "twitter_url", "website_url", "bio", "timezone",
        "language_preference", "profile_image_url"
    ]:
        if field in data:
            setattr(user, field, data[field])

    # normalize and set location (None if empty)
    if "location" in data:
        loc = (data.get("location") or "").strip() or None
        user.location = loc
        if loc:
            ga = db.session.query(GeographicArea).filter(GeographicArea.name.ilike(loc)).first()
            if not ga:
                db.session.add(GeographicArea(name=loc))

    db.session.commit()
    return jsonify({"message": "Profile updated"}), 200


@auth_bp.route("/me", methods=["GET"])
def me():
    user, _, err = require_auth()
    if err:
        return err
    try:
        # bump last_active_at on successful authenticated fetch
        user.last_active_at = datetime.now(timezone.utc)
        db.session.commit()

        memberships = [_serialize_membership(m) for m in user.enterprise_memberships]
        return jsonify({
            "user": _serialize_user(user),
            "memberships": memberships,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
@auth_bp.route("/after-login", methods=["POST"])
def after_login():
    user, _, err = require_auth()
    if err:
        return err

    try:
        user.last_active_at = datetime.now(timezone.utc)

        # Optional: write a UserActivity row
        from src.models.user import UserActivity
        ip = request.headers.get("X-Forwarded-For", request.remote_addr)
        ua = request.headers.get("User-Agent")
        db.session.add(UserActivity(
            user_id=user.id,
            activity_type="login",
            activity_category="auth",
            activity_data={},
            ip_address=ip,
            user_agent=ua,
            session_id=None,
        ))

        db.session.commit()
        return jsonify({"ok": True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@auth_bp.route("/logout", methods=["POST"])
def logout():
    user, _, err = require_auth()
    if err:
        return err
    try:
        from datetime import datetime, timezone
        from src.models.user import UserActivity

        user.last_active_at = datetime.now(timezone.utc)  # or last_logout_at if you add it
        db.session.add(UserActivity(
            user_id=user.id,
            activity_type="logout",
            activity_category="auth",
            activity_data={},
            ip_address=request.headers.get("X-Forwarded-For", request.remote_addr),
            user_agent=request.headers.get("User-Agent"),
            session_id=None,
        ))
        db.session.commit()
        return jsonify({"ok": True}), 200  # or: return ("", 204)
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
