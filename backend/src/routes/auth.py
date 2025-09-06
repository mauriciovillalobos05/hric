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
import base64
from urllib.parse import urlsplit

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

STATUSES = {"NOT_STARTED","EMAIL_SUBMITTED","EMAIL_VERIFIED",
            "QUESTIONNAIRE_LINK_ISSUED","IN_PROGRESS","COMPLETED"}

def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)

def _rfc3339_z(ts: dt.datetime | None = None) -> str:
    # 2025-09-01T19:42:00Z
    t = ts or dt.datetime.utcnow()
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")

def _compact_json(d: dict) -> str:
    return json.dumps(d, separators=(",", ":"), ensure_ascii=False)

def _require_cfg(*keys: str):
    missing = [k for k in keys if not os.getenv(k)]
    if missing:
        msg = f"Server not configured: missing {', '.join(missing)}"
        current_app.logger.error("[cfg] %s", msg)
        return jsonify({"error": msg}), 500
    return None

def _sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def _intelleges_paths():
    return {
        "initiate": os.getenv("INTELLEGES_INITIATE_PATH", "/api/hric/verification/initiate"),
        "status":   os.getenv("INTELLEGES_STATUS_PATH",   "/api/hric/verification/status"),
    }


def _upsert_user_status(user: User, status: str) -> None:
    if hasattr(user, "intelleges_status") and status in STATUSES:
        user.intelleges_status = status

# --- DEV flag exactly as string "true" to enable the fake path ---
DEV_FAKE_INTELLEGES = os.getenv("DEV_FAKE_INTELLEGES", "false").lower() == "true"
INTELLEGES_WEBHOOK_SECRET = os.getenv("INTELLEGES_WEBHOOK_SECRET", "dev-secret")

def _unix_ts() -> str:
    # UNIX timestamp (seconds, UTC) as a string, e.g. "1757176441"
    return str(int(dt.datetime.now(dt.timezone.utc).timestamp()))

def _strip_quotes(s: str) -> str:
    return s[1:-1] if s and len(s) >= 2 and s[0] == s[-1] and s[0] in ("'", '"') else s

def _sign_canonical(method: str, path: str, ts: str, body_str: str, b64_secret: str) -> str:
    """
    Canonical: "{METHOD}\n{PATH}\n{TIMESTAMP}\n{BODY}"
    TIMESTAMP must match the value you put in X-Timestamp (UNIX seconds).
    Secret is BASE64; return signature as BASE64 (not hex).
    """
    try:
        secret = base64.b64decode(_strip_quotes(b64_secret), validate=True)
    except Exception:
        raise ValueError("INTELLEGES_CLIENT_HMAC_SECRET must be valid base64")

    canonical = "\n".join([method.upper(), path, ts, body_str])
    digest = hmac.new(secret, canonical.encode("utf-8"), hashlib.sha256).digest()
    return base64.b64encode(digest).decode("ascii")

def _build_payload_pascal(*, email: str, country: str, tier: str,
                          source: str, redirect: str, locale: str,
                          idk: str, pptq: int | None, ttl_minutes: int | None,
                          extra: dict) -> dict:
    d = {
        "Email": email,
        "Country": country,
        "Tier": tier,
        "Source": source,
        "RedirectBaseUrl": redirect,
        "Locale": locale,
        "IdempotencyKey": idk,
    }
    if pptq is not None:
        d["Pptq"] = pptq
    if ttl_minutes is not None:
        d["LinkTtlMinutes"] = ttl_minutes
    # allow override / additions
    d.update({k: v for k, v in extra.items() if v is not None})
    return d

def _build_payload_camel(*, email: str, country: str, tier: str,
                         source: str, redirect: str, locale: str,
                         idk: str, ttl_minutes: int | None, extra: dict) -> dict:
    d = {
        "email": email,
        "countryOfOrigin": country,
        "productTier": tier,
        "source": source,
        "redirectBaseUrl": redirect,
        "locale": locale,
        "idempotencyKey": idk,
    }
    if ttl_minutes is not None:
        d["linkTtlMinutes"] = ttl_minutes
    d.update({k: v for k, v in extra.items() if v is not None})
    return d

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
    user, claims, err = require_supabase_auth(db, User)
    if err:
        return err

    body = request.get_json(silent=True) or {}
    email   = (user.email or "").strip().lower()
    country = (body.get("Country") or body.get("country") or body.get("country_of_origin") or body.get("countryOfOrigin") or "US").strip().upper()
    tier    = (body.get("Tier") or body.get("product_tier") or body.get("productTier") or "HRIC_STARTUP_BASIC_UNVERIFIED").strip()

    # DEV short-circuit unchanged
    if DEV_FAKE_INTELLEGES:
        idk_seed = f"{email}|{tier}|{_now().date().isoformat()}".lower()
        idk = _sha256_hex(idk_seed)
        reg = db.session.query(IntellegesRegistration)\
              .filter(func.lower(IntellegesRegistration.idempotency_key) == idk).one_or_none()
        if not reg:
            reg = IntellegesRegistration(user_id=user.id, email=email, product_tier=tier,
                                         status="EMAIL_SUBMITTED", idempotency_key=idk)
            db.session.add(reg); db.session.flush()
        rid = reg.registration_id or f"ilgs_{hashlib.sha1(f'{email}|{tier}|{_now().isoformat()}'.encode()).hexdigest()[:16]}"
        reg.registration_id = rid
        reg.questionnaire_link = reg.questionnaire_link or f"https://example.intelleges/qs/{rid}"
        reg.link_expires_at = reg.link_expires_at or (_now() + dt.timedelta(days=2))
        reg.status = "QUESTIONNAIRE_LINK_ISSUED"; _upsert_user_status(user, reg.status)
        db.session.commit()
        return jsonify({
            "registration_id": reg.registration_id,
            "questionnaire_link": reg.questionnaire_link,
            "status": reg.status,
            "link_expires_at": reg.link_expires_at.isoformat() if reg.link_expires_at else None,
            "mode": "dev-fake",
        }), 200

    # --- PROD CONFIG ---
    cfg_err = _require_cfg("INTELLEGES_API_BASE", "INTELLEGES_API_KEY", "INTELLEGES_CLIENT_HMAC_SECRET")
    if cfg_err: return cfg_err

    api_base    = os.getenv("INTELLEGES_API_BASE", "").rstrip("/")
    api_key     = os.getenv("INTELLEGES_API_KEY")
    hmac_secret = os.getenv("INTELLEGES_CLIENT_HMAC_SECRET")
    source      = os.getenv("INTELLEGES_SOURCE", "Test")
    locale      = os.getenv("INTELLEGES_LOCALE", "en-US")
    redirect    = (os.getenv("INTELLEGES_REDIRECT_BASE_URL") or "https://login.intelleges.com/").rstrip("/")

    host = (urlsplit(api_base).hostname or "").lower()
    if host.startswith("login."):
        current_app.logger.warning("[intelleges_initiate] Using login.* as API base per vendor instruction: %s", host)

    # UNIX timestamp for headers + signing
    ts_unix = _unix_ts()

    # IdempotencyKey per vendor hint: sha256(email|timestamp)
    idk = _sha256_hex(f"{email}|{ts_unix}")

    # Upsert local registration shell
    reg = db.session.query(IntellegesRegistration)\
          .filter(func.lower(IntellegesRegistration.idempotency_key) == idk).one_or_none()
    if not reg:
        reg = IntellegesRegistration(user_id=user.id, email=email, product_tier=tier,
                                     status="EMAIL_SUBMITTED", idempotency_key=idk)
        db.session.add(reg); db.session.flush()

    # Defaults per your sample
    try: pptq = int(body.get("Pptq") or os.getenv("INTELLEGES_PPTQ") or 111)
    except Exception: pptq = 111
    try: ttl_minutes = int(body.get("LinkTtlMinutes") or os.getenv("INTELLEGES_LINK_TTL_MINUTES") or 12)
    except Exception: ttl_minutes = 12

    # EXACT PascalCase payload
    payload = {
        "Pptq": pptq,
        "Email": email,
        "Country": country,
        "Tier": tier,
        "Source": source,
        "RedirectBaseUrl": redirect,
        "Locale": locale,
        "IdempotencyKey": idk,
        "LinkTtlMinutes": ttl_minutes,
    }
    body_str = _compact_json(payload)

    # Try multiple path candidates (env overrides first)
    candidates = [
        os.getenv("INTELLEGES_INITIATE_PATH") or "/api/hric/verification/initiate",
        "/api/HRIC/Verification/Initiate",
        "/api/verification/initiate",
    ]

    last_resp = None
    tried = []
    for path in candidates:
        url = f"{api_base}{path}"
        tried.append(path)
        try:
            sig = _sign_canonical("POST", path, ts_unix, body_str, hmac_secret)  # BASE64
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-Timestamp": ts_unix,                # UNIX seconds
                "X-Signature": sig,                    # base64
                "X-Api-Key": api_key,
                "Authorization": f"HMAC-SHA256 Credential={api_key}, Signature={sig}",
            }
            current_app.logger.info("[intelleges_initiate] POST %s headers=%s payload=%s", url,
                                    {k: (v if k != "Authorization" else "HMAC-SHA256 Credential=<redacted>, Signature=<redacted>") for k,v in headers.items()},
                                    payload)
            resp = requests.post(url, headers=headers, data=body_str, timeout=(10, 30))
            last_resp = resp
            if resp.status_code == 404:
                current_app.logger.warning("[intelleges_initiate] 404 on %s, trying next candidate", path)
                continue
            break
        except Exception as e:
            current_app.logger.exception("[intelleges_initiate] request error on %s", path)
            return jsonify({"error": f"Request to Intelleges failed at {path}: {str(e)}",
                            "tried_paths": tried}), 502

    if not last_resp:
        return jsonify({"error": "No response from Intelleges", "tried_paths": tried}), 502

    if last_resp.status_code not in (200, 201):
        snippet = (last_resp.text or "")[:500]
        return jsonify({"error": "Intelleges initiate failed",
                        "upstream_status": last_resp.status_code,
                        "upstream_body_snippet": snippet,
                        "tried_paths": tried}), 502

    try:
        data = last_resp.json()
    except ValueError:
        snippet = (last_resp.text or "")[:500]
        return jsonify({"error": "Intelleges returned non-JSON response",
                        "upstream_status": last_resp.status_code,
                        "upstream_body_snippet": snippet,
                        "tried_paths": tried}), 502

    reg.registration_id    = data.get("registration_id") or data.get("id") or reg.registration_id
    reg.questionnaire_link = data.get("questionnaire_link") or data.get("questionnaireLink") or reg.questionnaire_link
    upstream_status = (data.get("status") or "QUESTIONNAIRE_LINK_ISSUED").upper()
    reg.status = upstream_status if upstream_status in STATUSES else "QUESTIONNAIRE_LINK_ISSUED"
    try:
        iso = (data.get("link_expires_at") or data.get("linkExpiresAt") or "").replace("Z", "+00:00")
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

# ---------- GET /intelleges/status ----------
@auth_bp.route("/intelleges/status", methods=["GET"])
def intelleges_status_proxy():
    user, _, err = require_supabase_auth(db, User)
    if err:
        return err

    cfg_err = _require_cfg("INTELLEGES_API_BASE", "INTELLEGES_API_KEY", "INTELLEGES_CLIENT_HMAC_SECRET")
    if cfg_err: return cfg_err

    api_base    = os.getenv("INTELLEGES_API_BASE", "").rstrip("/")
    api_key     = os.getenv("INTELLEGES_API_KEY")
    hmac_secret = os.getenv("INTELLEGES_CLIENT_HMAC_SECRET")

    rid = (request.args.get("id") or "").strip()
    if not rid:
        reg = (db.session.query(IntellegesRegistration)
               .filter(IntellegesRegistration.user_id == user.id)
               .order_by(IntellegesRegistration.created_at.desc()).first())
        if not reg or not reg.registration_id:
            return jsonify({"error": "registration id not found"}), 404
        rid = reg.registration_id

    ts_unix = _unix_ts()
    candidates = [
        (os.getenv("INTELLEGES_STATUS_PATH") or "/api/hric/verification/status") + f"/{rid}",
        f"/api/HRIC/Verification/Status/{rid}",
        f"/api/verification/status/{rid}",
    ]

    last_resp = None
    tried = []
    for path in candidates:
        url = f"{api_base}{path}"
        tried.append(path)
        try:
            sig = _sign_canonical("GET", path, ts_unix, "", hmac_secret)  # BASE64
            headers = {
                "Accept": "application/json",
                "X-Timestamp": ts_unix,                # UNIX seconds
                "X-Signature": sig,                    # base64
                "X-Api-Key": api_key,
                "Authorization": f"HMAC-SHA256 Credential={api_key}, Signature={sig}",
            }
            current_app.logger.info("[intelleges_status] GET %s headers=%s", url,
                                    {k: (v if k != "Authorization" else "HMAC-SHA256 Credential=<redacted>, Signature=<redacted>") for k,v in headers.items()})
            resp = requests.get(url, headers=headers, timeout=(10, 20))
            last_resp = resp
            if resp.status_code == 404:
                current_app.logger.warning("[intelleges_status] 404 on %s, trying next candidate", path)
                continue
            break
        except Exception as e:
            current_app.logger.exception("[intelleges_status] request error on %s", path)
            return jsonify({"error": f"Request to Intelleges failed at {path}: {str(e)}",
                            "tried_paths": tried}), 502

    if not last_resp:
        return jsonify({"error": "No response from Intelleges", "tried_paths": tried}), 502

    if last_resp.status_code != 200:
        snippet = (last_resp.text or "")[:300]
        return jsonify({"error": "Intelleges status fetch failed",
                        "upstream_status": last_resp.status_code,
                        "upstream_body_snippet": snippet,
                        "tried_paths": tried}), 502

    try:
        data = last_resp.json()
    except ValueError:
        snippet = (last_resp.text or "")[:300]
        return jsonify({"error": "Intelleges returned non-JSON response",
                        "upstream_status": last_resp.status_code,
                        "upstream_body_snippet": snippet,
                        "tried_paths": tried}), 502

    # mirror to DB
    reg = db.session.query(IntellegesRegistration).filter_by(registration_id=rid).first()
    if reg:
        st = (data.get("status") or "").upper()
        if st in STATUSES:
            reg.status = st
            usr = db.session.get(User, reg.user_id)
            if usr: _upsert_user_status(usr, st)
        db.session.commit()

    return jsonify(data), 200

# ---------- POST /intelleges/webhook ----------
@auth_bp.route("/intelleges/webhook", methods=["POST"])
def intelleges_webhook():
    """
    Intelleges → HRIC webhooks.
    We verify timestamped HMAC using INTELLEGES_WEBHOOK_SECRET (base64).
    For multipart completion, we store the CSV to INTELLEGES_CSV_DIR.
    """
    secret_b64 = _strip_quotes(os.getenv("INTELLEGES_WEBHOOK_SECRET", ""))
    if secret_b64:
        try:
            secret = base64.b64decode(secret_b64, validate=True)
        except Exception:
            return jsonify({"error": "INTELLEGES_WEBHOOK_SECRET must be valid base64"}), 500
        ts  = request.headers.get("X-Timestamp", "")
        sig = request.headers.get("X-Signature", "")
        if not ts or not sig:
            return jsonify({"error": "Missing HMAC headers"}), 401
        # canonical for webhook: TIMESTAMP + "\n" + RAW_BODY
        raw = request.get_data(cache=False)
        expected = hmac.new(secret, (ts + "\n").encode("utf-8") + raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            return jsonify({"error": "Invalid webhook signature"}), 401

    # CSV multipart?
    if request.content_type and "multipart/form-data" in request.content_type:
        try:
            payload = json.loads(request.form.get("payload") or "{}")
        except Exception:
            return jsonify({"error": "Invalid JSON in 'payload'"}), 400

        event_id = payload.get("event_id") or payload.get("id")
        reg_id   = payload.get("registration_id") or payload.get("registrationId")
        status   = (payload.get("status") or "").upper()
        occurred = payload.get("occurred_at_utc") or payload.get("occurredAtUtc") or _now().isoformat()

        csv_file = request.files.get("answers_csv") or request.files.get("answersCsv")
        if not csv_file:
            return jsonify({"error": "Missing answers_csv file"}), 400

        stamp  = dt.datetime.fromisoformat(occurred.replace("Z", "+00:00")).strftime("%Y%m%d%H%M")
        folder = os.getenv("INTELLEGES_CSV_DIR", "/tmp/intelleges")
        os.makedirs(folder, exist_ok=True)
        fpath  = os.path.join(folder, f"answers_{reg_id}_{stamp}.csv")
        csv_file.save(fpath)

        try:
            if not db.session.query(IntellegesEvent).filter_by(event_id=event_id).first():
                db.session.add(IntellegesEvent(
                    event_id=event_id, registration_id=reg_id, type="registration.completed",
                    occurred_at_utc=_now(), payload_json=payload
                ))
            reg = db.session.query(IntellegesRegistration).filter_by(registration_id=reg_id).first()
            if reg:
                if status in STATUSES: reg.status = status
                reg.answers_csv_path = fpath
                reg.answers_csv_received_at = _now()
                usr = db.session.get(User, reg.user_id)
                if usr: _upsert_user_status(usr, reg.status)
            db.session.commit()
            return jsonify({"ok": True}), 200
        except Exception as e:
            db.session.rollback()
            current_app.logger.exception("intelleges_webhook (multipart) failed")
            return jsonify({"error": str(e)}), 500

    # JSON events (progress, link issued, etc.)
    try:
        event = request.get_json(silent=True) or {}
        event_id = event.get("event_id") or event.get("id")
        reg_id   = event.get("registration_id") or event.get("registrationId")
        status   = (event.get("status") or "").upper()

        if not db.session.query(IntellegesEvent).filter_by(event_id=event_id).first():
            db.session.add(IntellegesEvent(
                event_id=event_id, registration_id=reg_id, type=event.get("type"),
                occurred_at_utc=_now(), payload_json=event
            ))

        if status in STATUSES:
            reg = db.session.query(IntellegesRegistration).filter_by(registration_id=reg_id).first()
            if reg:
                reg.status = status
                if status == "QUESTIONNAIRE_LINK_ISSUED" and ("questionnaire_link" in event or "questionnaireLink" in event):
                    reg.questionnaire_link = event.get("questionnaire_link") or event.get("questionnaireLink")
                usr = db.session.get(User, reg.user_id)
                if usr: _upsert_user_status(usr, status)
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