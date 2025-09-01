from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, Any
import hashlib
import hmac
import os
import datetime as dt
from flask import Blueprint, jsonify, request, current_app
from sqlalchemy import func, and_
import json
import requests
from src.extensions import db

# ⬇️ Models (make sure these exist)
from src.models.user import (
    User,
    Enterprise,
    EnterpriseUser,
    GeographicArea,
    StartupProfile,
    IntellegesRegistration,
    IntellegesEvent,
)

# Optional: plan validation
try:
    from src.models.user import UserPlan  # type: ignore
except Exception:
    UserPlan = None  # type: ignore

from src.routes.supabase_auth import require_auth as require_supabase_auth

auth_bp = Blueprint("auth", __name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _upsert_user_status(user: User, status: str) -> None:
    if hasattr(user, "intelleges_status") and status in STATUSES:
        user.intelleges_status = status

def _default_enterprise_name(first_name: str, last_name: str) -> str:
    first = (first_name or "").strip() or "New"
    last = (last_name or "").strip() or "User"
    return f"{first} {last} Startup"

def _serialize_user(u: User) -> Dict[str, Any]:
    return {
        "id": str(u.id),
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "phone": u.phone,
        "location": u.location,
        "stripe_customer_id": getattr(u, "stripe_customer_id", None),
        "profile_image_url": getattr(u, "profile_image_url", None),
        "bio": getattr(u, "bio", None),
        "linkedin_url": getattr(u, "linkedin_url", None),
        "twitter_url": getattr(u, "twitter_url", None),
        "website_url": getattr(u, "website_url", None),
        "timezone": getattr(u, "timezone", None),
        "language_preference": getattr(u, "language_preference", None),
        "onboarding_completed": bool(getattr(u, "onboarding_completed", False)),
        "is_active": bool(getattr(u, "is_active", True)),
        "created_at": u.created_at.isoformat() if getattr(u, "created_at", None) else None,
        "updated_at": u.updated_at.isoformat() if getattr(u, "updated_at", None) else None,
    }

def _serialize_membership(m: EnterpriseUser) -> Dict[str, Any]:
    ent = m.enterprise
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
        "enterprise_type": ent.enterprise_type if ent else None,
    }

def _validate_plan_key(plan_key: str) -> Optional[str]:
    """Return normalized valid entrepreneur_* plan_key or None."""
    if not plan_key:
        return None
    key = str(plan_key).strip()
    if not key.startswith("entrepreneur_"):
        return None
    if UserPlan is None:
        return key
    plan = (
        db.session.query(UserPlan)
        .filter(
            func.lower(UserPlan.plan_key) == func.lower(key),
            UserPlan.is_active.is_(True),
        )
        .first()
    )
    return plan.plan_key if plan else None

STATUSES = {
    "NOT_STARTED",
    "EMAIL_SUBMITTED",
    "EMAIL_VERIFIED",
    "QUESTIONNAIRE_LINK_ISSUED",
    "IN_PROGRESS",
    "COMPLETED",
}

def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)

def _sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def _require_cfg(*keys: str):
    """
    Returns (Response, code) if any required key is missing; otherwise returns None.
    Callers should do:  cfg_err = _require_cfg(...);  if cfg_err: return cfg_err
    """
    missing = [k for k in keys if not os.getenv(k)]
    if missing:
        msg = f"Server not configured: missing {', '.join(missing)}"
        current_app.logger.error("[cfg] %s", msg)
        return jsonify({"error": msg}), 500
    return None

def _sign_outgoing(ts: str, payload_dict: dict, secret: str) -> str:
    """
    Intelleges HMAC: sha256( timestamp + compact_json(payload), shared_secret ) -> hex
    """
    msg = ts + json.dumps(payload_dict, separators=(",", ":"), ensure_ascii=False)
    return hmac.new(secret.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).hexdigest()

def _verify_incoming(ts: str, raw_body: bytes, provided_sig: str, secret: str) -> bool:
    if not ts or not provided_sig:
        return False
    try:
        sent = dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return False
    if abs((_now() - sent).total_seconds()) > 300:
        return False  # >5 minutes skew
    expected = hmac.new(secret.encode("utf-8"), (ts + raw_body.decode("utf-8")).encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided_sig)

def _upsert_user_status(user: User, status: str) -> None:
    if hasattr(user, "intelleges_status") and status in STATUSES:
        user.intelleges_status = status

def _hmac_signature(secret: str, timestamp: str, raw_body: bytes) -> str:
    # spec: X-Signature = sha256(timestamp + body, shared_secret)  (hex)
    msg = timestamp.encode("utf-8") + raw_body
    return hashlib.sha256(secret.encode("utf-8") + msg).hexdigest()

def _verify_webhook_hmac() -> Optional[tuple]:
    """
    Verify Intelleges → HRIC webhook HMAC.
    Headers:
      X-Timestamp: UTC ISO8601
      X-Signature: hex sha256(secret + (timestamp + body))
    Reject if clock skew > 5 minutes.
    """
    secret = os.getenv("INTELLEGES_WEBHOOK_SECRET")
    if not secret:
        current_app.logger.warning("[intelleges_webhook] no INTELLEGES_WEBHOOK_SECRET set; skipping HMAC verify")
        return None

    ts = request.headers.get("X-Timestamp", "")
    sig = request.headers.get("X-Signature", "")
    if not ts or not sig:
        return jsonify({"error": "Missing HMAC headers"}), 401

    try:
        sent = dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return jsonify({"error": "Invalid X-Timestamp"}), 401

    if abs((_now() - sent).total_seconds()) > 300:
        return jsonify({"error": "Clock skew too large"}), 401

    raw = request.get_data(cache=False)  # raw body (works for JSON and multipart)
    expected = _hmac_signature(secret, ts, raw)
    if not hmac.compare_digest(expected, sig):
        current_app.logger.warning("[intelleges_webhook] bad signature; expected %s, got %s", expected, sig)
        return jsonify({"error": "Invalid signature"}), 401

    return None

# ---- Intelleges client flags / secrets -------------------------------------

# IMPORTANT: this must be exactly "true" to enable the DEV fake path.
DEV_FAKE_INTELLEGES = os.getenv("DEV_FAKE_INTELLEGES", "false").lower() == "true"
INTELLEGES_WEBHOOK_SECRET = os.getenv("INTELLEGES_WEBHOOK_SECRET", "dev-secret")

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@auth_bp.route("/onboarding/startup", methods=["POST"])
def onboarding_startup():
    current_app.logger.info("[onboarding_startup] begin")
    user, claims, err = require_supabase_auth(db, User, allow_missing_user=True)
    if err:
        current_app.logger.warning("[onboarding_startup] auth error -> %s", err[0].json.get("error"))
        return err

    supabase_id = (claims or {}).get("sub")
    jwt_email = ((claims or {}).get("email") or "").strip().lower()
    current_app.logger.info("[onboarding_startup] uid=%s email=%s", supabase_id, jwt_email)

    if not supabase_id or not jwt_email:
        return jsonify({"error": "Invalid auth token"}), 401

    data = request.get_json(silent=True) or {}
    first_name = (data.get("first_name") or "").strip()
    last_name  = (data.get("last_name") or "").strip()
    phone      = (data.get("phone") or "").strip() or None
    location   = (data.get("location") or "").strip() or None
    linkedin_url = (data.get("linkedin_url") or "").strip() or None
    twitter_url  = (data.get("twitter_url") or "").strip() or None
    website_url  = (data.get("website_url") or "").strip() or None
    bio = (data.get("bio") or "").strip() or None
    timezone_ = (data.get("timezone") or "UTC").strip()
    language_preference = (data.get("language_preference") or "en").strip()
    profile_image_url   = (data.get("profile_image_url") or "").strip() or None

    plan_key = _validate_plan_key(str(data.get("plan_key") or ""))
    if not plan_key:
        return jsonify({"error": "Invalid or inactive plan for startups"}), 400

    try:
        # NOTE: no `with db.session.begin()` here – SQLAlchemy already opened one.
        # We just commit at the end.
        if user is None:
            current_app.logger.info("[onboarding_startup] creating user row")
            user = User(
                id=supabase_id,
                email=jwt_email,
                first_name=first_name or "New",
                last_name=last_name or "User",
                phone=phone,
                location=location,
            )
            db.session.add(user)
        else:
            current_app.logger.info("[onboarding_startup] updating user row %s", user.id)
            user.email = jwt_email
            if first_name: user.first_name = first_name
            if last_name:  user.last_name = last_name
            user.phone = phone
            user.location = location

        # Optional columns (guarded)
        if hasattr(user, "linkedin_url"):         user.linkedin_url = linkedin_url
        if hasattr(user, "twitter_url"):          user.twitter_url = twitter_url
        if hasattr(user, "website_url"):          user.website_url = website_url
        if hasattr(user, "bio"):                  user.bio = bio
        if hasattr(user, "timezone"):             user.timezone = timezone_
        if hasattr(user, "language_preference"):  user.language_preference = language_preference
        if hasattr(user, "profile_image_url"):    user.profile_image_url = profile_image_url
        if hasattr(user, "role"):                 user.role = "startup"
        if hasattr(user, "intelleges_status") and not getattr(user, "intelleges_status", None):
            user.intelleges_status = "pending"
        if hasattr(user, "plan_key"):
            user.plan_key = plan_key

        # Geo tag
        if location:
            exists = (
                db.session.query(GeographicArea.id)
                .filter(GeographicArea.name.ilike(location))
                .first()
            )
            if not exists:
                current_app.logger.info("[onboarding_startup] creating GeographicArea %s", location)
                db.session.add(GeographicArea(name=location))

        # Enterprise + membership
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
            current_app.logger.info("[onboarding_startup] creating enterprise for user %s", user.id)
            ent = Enterprise(
                name=_default_enterprise_name(first_name, last_name),
                enterprise_type="startup",
                location=location,
                status="active",
            )
            db.session.add(ent)
            db.session.flush()  # need ent.id

            db.session.add(
                EnterpriseUser(
                    enterprise_id=ent.id,
                    user_id=user.id,
                    role="owner",
                    is_active=True,
                    joined_date=_now(),
                )
            )
        else:
            if getattr(ent, "enterprise_type", None) != "startup":
                ent.enterprise_type = "startup"

        # Startup profile
        sp = (
            db.session.query(StartupProfile)
            .filter(StartupProfile.enterprise_id == ent.id)
            .first()
        )
        if not sp:
            current_app.logger.info("[onboarding_startup] creating startup_profile for ent %s", ent.id)
            sp = StartupProfile(enterprise_id=ent.id)
            db.session.add(sp)
            db.session.flush()

        db.session.commit()
        current_app.logger.info("[onboarding_startup] committed")

        payload = {
            "user_id": str(user.id),
            "email": user.email,
            "enterprise_id": str(ent.id),
            "enterprise_type": "startup",
            "startup_profile_id": str(sp.id),
            "plan_key": plan_key,
            "intelleges_status": getattr(user, "intelleges_status", "pending"),
            "next_step_url": "/questionnaire",
            "next_step_action": "initiate_intelleges",
        }
        return jsonify(payload), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("onboarding_startup failed")
        return jsonify({"error": str(e)}), 500

# ---------- POST /intelleges/initiate ----------
@auth_bp.route("/intelleges/initiate", methods=["POST"])
def intelleges_initiate():
    """
    HRIC → Intelleges: initiate and persist the REAL questionnaire link.
    """
    # Auth
    user, _, err = require_supabase_auth(db, User)
    if err:
        return err

    # If DEV fake is enabled, synthesize a link (useful for local dev)
    if DEV_FAKE_INTELLEGES:
        email = (user.email or "").strip().lower()
        body = request.get_json(silent=True) or {}
        tier = (body.get("product_tier") or "HRIC_STARTUP_BASIC_UNVERIFIED").strip()

        # idempotent per-day record
        idk_seed = f"{email}|{tier}|{_now().date().isoformat()}".lower()
        idk = _sha256_hex(idk_seed)
        reg = (
            db.session.query(IntellegesRegistration)
            .filter(func.lower(IntellegesRegistration.idempotency_key) == idk)
            .one_or_none()
        )
        if not reg:
            reg = IntellegesRegistration(
                user_id=user.id,
                email=email,
                product_tier=tier,
                status="EMAIL_SUBMITTED",
                idempotency_key=idk,
            )
            db.session.add(reg)
            db.session.flush()

        rid = reg.registration_id or f"ilgs_{hashlib.sha1(f'{email}|{tier}|{_now().isoformat()}'.encode()).hexdigest()[:16]}"
        reg.registration_id = rid
        reg.questionnaire_link = reg.questionnaire_link or f"https://example.intelleges/qs/{rid}"
        reg.link_expires_at = reg.link_expires_at or (_now() + dt.timedelta(days=2))
        reg.status = "QUESTIONNAIRE_LINK_ISSUED"
        _upsert_user_status(user, reg.status)
        db.session.commit()

        return jsonify({
            "registration_id": reg.registration_id,
            "questionnaire_link": reg.questionnaire_link,
            "status": reg.status,
            "link_expires_at": reg.link_expires_at.isoformat() if reg.link_expires_at else None,
            "mode": "dev-fake",
        }), 200

    # PROD path: require config
    cfg_err = _require_cfg("INTELLEGES_API_BASE", "INTELLEGES_CLIENT_HMAC_SECRET")
    if cfg_err:
        return cfg_err

    api_base = os.getenv("INTELLEGES_API_BASE").rstrip("/")
    hmac_secret = os.getenv("INTELLEGES_CLIENT_HMAC_SECRET")
    source = os.getenv("INTELLEGES_SOURCE", "HRIC")
    locale = os.getenv("INTELLEGES_LOCALE", "en-US")
    redirect = os.getenv("INTELLEGES_REDIRECT_BASE_URL", "https://hric-fe.vercel.app").rstrip("/")

    body = request.get_json(silent=True) or {}
    email = (user.email or "").strip().lower()
    country = (body.get("country_of_origin") or "MX").strip().upper()
    tier = (body.get("product_tier") or "HRIC_STARTUP_BASIC_UNVERIFIED").strip()

    # Idempotency: per-day key keeps retries stable while allowing regeneration next day
    idk_seed = f"{email}|{tier}|{_now().date().isoformat()}".lower()
    idk = _sha256_hex(idk_seed)

    # Upsert a local row so UI can reflect status and we can mirror webhooks
    reg = (
        db.session.query(IntellegesRegistration)
        .filter(func.lower(IntellegesRegistration.idempotency_key) == idk)
        .one_or_none()
    )
    if not reg:
        reg = IntellegesRegistration(
            user_id=user.id,
            email=email,
            product_tier=tier,
            status="EMAIL_SUBMITTED",
            idempotency_key=idk,
        )
        if hasattr(reg, "country_of_origin"):
            reg.country_of_origin = country
        db.session.add(reg)
        db.session.flush()

    payload = {
        "email": email,
        "country_of_origin": country,
        "product_tier": tier,
        "source": source,
        "redirect_base_url": redirect,
        "locale": locale,
        "idempotency_key": idk,
    }
    ts = _now().isoformat()
    sig = _sign_outgoing(ts, payload, hmac_secret)

    try:
        url = f"{api_base}/api/hric/registrations/initiate"
        current_app.logger.info("[intelleges_initiate] POST %s payload=%s", url, payload)
        resp = requests.post(
            url,
            headers={"Content-Type": "application/json", "X-Timestamp": ts, "X-Signature": sig},
            json=payload,
            timeout=(5, 20),
        )
        if resp.status_code not in (200, 201):
            txt = (resp.text or "")[:500]
            current_app.logger.warning("[intelleges_initiate] upstream %s: %s", resp.status_code, txt)
            return jsonify({"error": "Intelleges initiate failed", "upstream_status": resp.status_code}), 502

        data = resp.json()
        # Persist the REAL link and status from Intelleges (QUESTIONNAIRE_LINK_ISSUED at this step)
        reg.registration_id = data.get("registration_id") or reg.registration_id
        reg.questionnaire_link = data.get("questionnaire_link") or reg.questionnaire_link
        upstream_status = (data.get("status") or "QUESTIONNAIRE_LINK_ISSUED").upper()
        reg.status = upstream_status if upstream_status in STATUSES else "QUESTIONNAIRE_LINK_ISSUED"

        # Link expiry handling
        try:
            iso = (data.get("link_expires_at") or "").replace("Z", "+00:00")
            reg.link_expires_at = dt.datetime.fromisoformat(iso) if iso else None
        except Exception:
            reg.link_expires_at = None

        _upsert_user_status(user, reg.status)
        db.session.commit()

        return jsonify({
            "registration_id": reg.registration_id,
            "questionnaire_link": reg.questionnaire_link,
            "status": reg.status,
            "link_expires_at": reg.link_expires_at.isoformat() if reg.link_expires_at else None,
            "mode": "prod",
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("intelleges_initiate failed")
        return jsonify({"error": str(e)}), 500

@auth_bp.route("/intelleges/status", methods=["GET"])
def intelleges_status_proxy():
    """
    Optional: HRIC → Intelleges status check (used by HRIC on login).
    Mirrors Intelleges /status?email= and updates our local registration row.
    """
    # Auth (user must be signed in, we use their email)
    user, _, err = require_supabase_auth(db, User)
    if err:
        return err

    cfg_err = _require_cfg("INTELLEGES_API_BASE", "INTELLEGES_CLIENT_HMAC_SECRET")
    if cfg_err:
        return cfg_err

    api_base = os.getenv("INTELLEGES_API_BASE").rstrip("/")
    hmac_secret = os.getenv("INTELLEGES_CLIENT_HMAC_SECRET")

    email = (request.args.get("email") or user.email or "").strip().lower()
    if not email:
        return jsonify({"error": "email is required"}), 400

    # For GET, spec signature still uses sha256(timestamp + body) (empty JSON "{}")
    payload = {}
    ts = _now().isoformat()
    sig = _sign_outgoing(ts, payload, hmac_secret)

    try:
        url = f"{api_base}/api/hric/registrations/status"
        current_app.logger.info("[intelleges_status] GET %s?email=%s", url, email)
        resp = requests.get(
            url,
            params={"email": email},
            headers={"X-Timestamp": ts, "X-Signature": sig},
            timeout=(5, 15),
        )
        if resp.status_code != 200:
            current_app.logger.warning("[intelleges_status] upstream %s: %s", resp.status_code, (resp.text or "")[:300])
            return jsonify({"error": "Intelleges status fetch failed", "upstream_status": resp.status_code}), 502

        data = resp.json()
        # Update our local mirror
        reg = None
        if data.get("registration_id"):
            reg = (
                db.session.query(IntellegesRegistration)
                .filter(IntellegesRegistration.registration_id == data["registration_id"])
                .first()
            )
        if not reg:
            reg = (
                db.session.query(IntellegesRegistration)
                .filter(func.lower(IntellegesRegistration.email) == email)
                .order_by(IntellegesRegistration.created_at.desc())
                .first()
            )
        if reg:
            status = (data.get("status") or "").upper()
            if status in STATUSES:
                reg.status = status
                usr = db.session.get(User, reg.user_id)
                if usr:
                    _upsert_user_status(usr, status)
            db.session.commit()

        return jsonify(data), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("intelleges_status failed")
        return jsonify({"error": str(e)}), 500

@auth_bp.route("/intelleges/webhook", methods=["POST"])
def intelleges_webhook():
    """
    Intelleges → HRIC webhooks.
    Supports:
      - JSON journey update: { event_id, type:'registration.progress', registration_id, email, status, occurred_at_utc }
      - multipart/form-data on completion with fields:
          payload (JSON like above, but status:'COMPLETED'), answers_csv (file)
    """
    # Verify HMAC (if configured)
    secret = os.getenv("INTELLEGES_WEBHOOK_SECRET", "")
    if secret:
        ts = request.headers.get("X-Timestamp", "")
        sig = request.headers.get("X-Signature", "")
        raw = request.get_data(cache=False)  # must read raw for signature
        if not _verify_incoming(ts, raw, sig, secret):
            return jsonify({"error": "Invalid webhook signature"}), 401

    # --- multipart (COMPLETED + CSV) ---
    if request.content_type and "multipart/form-data" in request.content_type:
        try:
            payload_json = request.form.get("payload") or "{}"
            payload = json.loads(payload_json)
        except Exception:
            return jsonify({"error": "Invalid JSON in 'payload'"}), 400

        event_id = payload.get("event_id")
        etype = payload.get("type")
        reg_id = payload.get("registration_id")
        status = (payload.get("status") or "").upper()
        occurred = payload.get("occurred_at_utc") or _now().isoformat()

        csv_file = request.files.get("answers_csv")
        if not csv_file:
            return jsonify({"error": "Missing answers_csv file"}), 400

        # Save CSV per filename convention answers_{registration_id}_{yyyymmddHHMM}.csv
        stamp = dt.datetime.fromisoformat(occurred.replace("Z", "+00:00")).strftime("%Y%m%d%H%M")
        folder = os.getenv("INTELLEGES_CSV_DIR", "/tmp/intelleges")
        os.makedirs(folder, exist_ok=True)
        fname = f"answers_{reg_id}_{stamp}.csv"
        fpath = os.path.join(folder, fname)
        csv_file.save(fpath)

        try:
            # dedupe event
            ex = db.session.query(IntellegesEvent).filter_by(event_id=event_id).first()
            if not ex:
                db.session.add(IntellegesEvent(
                    event_id=event_id,
                    registration_id=reg_id,
                    type=etype,
                    occurred_at_utc=_now(),
                    payload_json=payload,
                ))

            reg = db.session.query(IntellegesRegistration).filter_by(registration_id=reg_id).first()
            if reg:
                if status in STATUSES:
                    reg.status = status
                reg.answers_csv_path = fpath
                reg.answers_csv_received_at = _now()
                usr = db.session.get(User, reg.user_id)
                if usr:
                    _upsert_user_status(usr, reg.status)

            db.session.commit()
            return jsonify({"ok": True}), 200

        except Exception as e:
            db.session.rollback()
            current_app.logger.exception("intelleges_webhook (multipart) failed")
            return jsonify({"error": str(e)}), 500

    # --- JSON journey updates (progress/link-issued etc.) ---
    try:
        event = request.get_json(silent=True) or {}
        event_id = event.get("event_id") or event.get("id")
        etype = event.get("type")
        reg_id = event.get("registration_id")
        status = (event.get("status") or "").upper()

        ex = db.session.query(IntellegesEvent).filter_by(event_id=event_id).first()
        if not ex:
            db.session.add(IntellegesEvent(
                event_id=event_id,
                registration_id=reg_id,
                type=etype,
                occurred_at_utc=_now(),
                payload_json=event,
            ))

        if status in STATUSES:
            reg = db.session.query(IntellegesRegistration).filter_by(registration_id=reg_id).first()
            if reg:
                reg.status = status
                if status == "QUESTIONNAIRE_LINK_ISSUED" and "questionnaire_link" in event:
                    reg.questionnaire_link = event.get("questionnaire_link")
                usr = db.session.get(User, reg.user_id)
                if usr:
                    _upsert_user_status(usr, status)

        db.session.commit()
        return jsonify({"ok": True}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("intelleges_webhook failed")
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------------------------
# Existing utility endpoints
# ---------------------------------------------------------------------------

@auth_bp.route("/profile", methods=["PUT", "PATCH"])
def update_profile():
    user, claims, err = require_supabase_auth(db, User, allow_missing_user=False)
    if err:
        return err

    data = request.get_json() or {}

    for field in [
        "first_name", "last_name", "phone", "linkedin_url",
        "twitter_url", "website_url", "bio", "timezone",
        "language_preference", "profile_image_url"
    ]:
        if hasattr(user, field) and field in data:
            setattr(user, field, data[field])

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
    user, claims, err = require_supabase_auth(db, User, allow_missing_user=False)
    if err:
        return err
    try:
        if hasattr(user, "last_active_at"):
            user.last_active_at = _now()
            db.session.commit()
        memberships = [_serialize_membership(m) for m in getattr(user, "enterprise_memberships", [])]
        return jsonify({"user": _serialize_user(user), "memberships": memberships}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@auth_bp.route("/after-login", methods=["POST"])
def after_login():
    user, claims, err = require_supabase_auth(db, User, allow_missing_user=False)
    if err:
        return err
    try:
        if hasattr(user, "last_active_at"):
            user.last_active_at = _now()
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
    user, claims, err = require_supabase_auth(db, User, allow_missing_user=False)
    if err:
        return err
    try:
        from src.models.user import UserActivity
        if hasattr(user, "last_active_at"):
            user.last_active_at = _now()
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
        return jsonify({"ok": True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500