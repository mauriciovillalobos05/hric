# src/routes/supabase_auth.py
from __future__ import annotations
import os
from flask import request, jsonify, current_app
from jwt import decode as jwt_decode, ExpiredSignatureError, InvalidTokenError, InvalidAudienceError

def require_auth(db, User):
    """
    Validate Supabase JWT locally with SUPABASE_JWT_SECRET.
    Returns (user, token, error_tuple_or_None). On error, returns (None, None, (json, code)).
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, None, (jsonify({"error": "Missing or invalid Authorization header"}), 401)

    token = auth_header.split(" ", 1)[1].strip()
    secret = os.getenv("SUPABASE_JWT_SECRET")

    if not secret:
        # Fail fast with a clear message instead of trying requests.get (which triggers the SSL recursion loop).
        return None, None, (jsonify({"error": "Server misconfigured: SUPABASE_JWT_SECRET is not set"}), 500)

    try:
        # Supabase tokens typically use aud="authenticated"
        try:
            payload = jwt_decode(token, secret, algorithms=["HS256"], audience="authenticated")
        except InvalidAudienceError:
            # Some tokens may omit/alter aud; allow decode without audience if needed.
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

    user = db.session.get(User, user_id)
    if not user:
        return None, None, (jsonify({"error": "User not found in database"}), 404)

    return user, token, None