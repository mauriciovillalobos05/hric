# src/routes/supabase_auth.py
import os, requests
from flask import request, jsonify, current_app
from jwt import decode as jwt_decode, ExpiredSignatureError, InvalidTokenError, InvalidAudienceError

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

def _remote_verify(token: str):
    """Return minimal claims dict or None."""
    if not (SUPABASE_URL and SUPABASE_ANON_KEY):
        return None
    try:
        r = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
            timeout=(3, 15),
        )
        if r.status_code != 200:
            return None
        data = r.json()
        return {"sub": data.get("id"), "email": data.get("email")}
    except Exception:
        current_app.logger.exception("Remote token verify failed")
        return None

def require_auth(db, UserModel, *, allow_missing_user: bool = False):
    """Return (user, claims, error_response_or_None)."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None, {}, (jsonify({"error": "Missing Bearer token"}), 401)

    token = auth.split(" ", 1)[1].strip()
    claims = {}

    if SUPABASE_JWT_SECRET:
        try:
            try:
                claims = jwt_decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
            except InvalidAudienceError:
                claims = jwt_decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
        except ExpiredSignatureError:
            return None, {}, (jsonify({"error": "Invalid or expired token"}), 401)
        except InvalidTokenError:
            return None, {}, (jsonify({"error": "Invalid or expired token"}), 401)
        except Exception as e:
            current_app.logger.exception("JWT verification failed")
            return None, {}, (jsonify({"error": f"Token verification failed: {e}"}), 500)
    else:
        data = _remote_verify(token)
        if not data:
            return None, {}, (jsonify({"error": "Invalid or expired token"}), 401)
        claims = data

    uid = claims.get("sub")
    if not uid:
        return None, claims, (jsonify({"error": "Invalid token: no sub"}), 401)

    user = db.session.get(UserModel, uid)
    if user is None and not allow_missing_user:
        return None, claims, (jsonify({"error": "User not found in database"}), 404)

    return user, claims, None
