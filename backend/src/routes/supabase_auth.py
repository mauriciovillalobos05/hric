# src/routes/supabase_auth.py
import os, requests
from flask import request, jsonify, current_app
from jwt import decode as jwt_decode, ExpiredSignatureError, InvalidTokenError, InvalidAudienceError

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

def _remote_verify(token: str):
    if not (SUPABASE_URL and SUPABASE_ANON_KEY):
        return None, ("Missing SUPABASE_URL/ANON key", 500)
    try:
        r = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
            timeout=(3, 15),
        )
        if r.status_code != 200:
            return None, ("Invalid or expired token", 401)
        return r.json().get("id"), None
    except Exception as e:
        current_app.logger.exception("Remote token verify failed")
        return None, (f"Token verification failed: {e}", 500)

def require_auth(db, User):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, None, (jsonify({"error": "Missing or invalid Authorization header"}), 401)

    token = auth_header.split(" ", 1)[1].strip()
    secret = os.getenv("SUPABASE_JWT_SECRET")

    if secret:
        try:
            try:
                payload = jwt_decode(token, secret, algorithms=["HS256"], audience="authenticated")
            except InvalidAudienceError:
                payload = jwt_decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
            user_id = payload.get("sub")
            if not user_id:
                return None, None, (jsonify({"error": "Invalid token: missing 'sub'"}), 401)
        except ExpiredSignatureError:
            return None, None, (jsonify({"error": "Invalid or expired token"}), 401)
        except InvalidTokenError as e:
            current_app.logger.warning(f"JWT decode failed: {e}")
            return None, None, (jsonify({"error": "Invalid or expired token"}), 401)
        except Exception as e:
            current_app.logger.exception("JWT verification failed")
            return None, None, (jsonify({"error": f"Token verification failed: {str(e)}"}), 500)
    else:
        # Fallback to Supabase /auth/v1/user (only if you can avoid eventlet SSL issues)
        uid, err = _remote_verify(token)
        if err:
            msg, code = err
            return None, None, (jsonify({"error": f"Server misconfigured: SUPABASE_JWT_SECRET is not set; {msg}"}), code)
        user_id = uid

    user = db.session.get(User, user_id)
    if not user:
        return None, None, (jsonify({"error": "User not found in database"}), 404)

    return user, token, None