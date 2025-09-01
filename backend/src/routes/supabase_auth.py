# src/routes/supabase_auth.py
import os
import requests
from flask import request, jsonify, current_app
from jwt import decode as jwt_decode, ExpiredSignatureError, InvalidTokenError, InvalidAudienceError

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

def _remote_verify(token: str):
    """
    Verify client JWT by asking Supabase /auth/v1/user.
    Returns (claims_dict, err) where claims has at least {'sub', 'email'}.
    """
    if not (SUPABASE_URL and SUPABASE_ANON_KEY):
        return None, ("Missing SUPABASE_URL or SUPABASE_ANON_KEY", 500)
    try:
        r = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
            timeout=(3, 15),
        )
        if r.status_code != 200:
            current_app.logger.warning("Supabase /auth/v1/user returned %s", r.status_code)
            return None, ("Invalid or expired token", 401)

        data = r.json() or {}
        uid = data.get("id")
        if not uid:
            return None, ("Auth response missing id", 401)

        # Build minimal claims; add more fields if you need them later
        claims = {
            "sub": uid,
            "email": data.get("email"),
            # you can copy other keys from data if helpful
        }
        return claims, None
    except Exception as e:
        current_app.logger.exception("Remote token verify failed")
        return None, (f"Token verification failed: {e}", 500)

def require_auth(db, UserModel, *, allow_missing_user: bool = False):
    """
    Unified auth guard.
    - If SUPABASE_JWT_SECRET is set, verify locally.
    - Else, verify by calling Supabase /auth/v1/user.
    Returns (user_or_None, claims_dict, flask_error_response_or_None)
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, {}, (jsonify({"error": "Missing Bearer token"}), 401)

    token = auth_header.split(" ", 1)[1].strip()

    # Try local JWT verification first
    claims = None
    if SUPABASE_JWT_SECRET:
        try:
            try:
                claims = jwt_decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
            except InvalidAudienceError:
                # Some client tokens may omit/alter aud; skip aud check in that case
                claims = jwt_decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
        except ExpiredSignatureError:
            return None, {}, (jsonify({"error": "Invalid or expired token"}), 401)
        except InvalidTokenError as e:
            current_app.logger.warning("JWT decode failed: %s", e)
            return None, {}, (jsonify({"error": "Invalid or expired token"}), 401)
        except Exception as e:
            current_app.logger.exception("JWT verification failed")
            return None, {}, (jsonify({"error": f"Token verification failed: {str(e)}"}), 500)
    else:
        # Remote verify against Supabase
        claims, err = _remote_verify(token)
        if err:
            msg, code = err
            return None, {}, (jsonify({"error": msg}), code)

    uid = (claims or {}).get("sub")
    if not uid:
        return None, claims or {}, (jsonify({"error": "Invalid token: no sub"}), 401)

    user = db.session.get(UserModel, uid)

    if user is None and not allow_missing_user:
        # For most routes we require a local row
        return None, claims, (jsonify({"error": "User not found in database"}), 404)

    # For onboarding we may return user=None (caller handles creation)
    return user, claims, None