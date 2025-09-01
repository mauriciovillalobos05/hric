# src/routes/user.py

from flask import Blueprint, request, jsonify
from sqlalchemy import func

from src.extensions import db
from src.models.user import User

users_bp = Blueprint("users", __name__)

def user_to_dict(u: User):
    return {
        "id": str(u.id),
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "phone": u.phone,
        "profile_image_url": u.profile_image_url,
        "bio": u.bio,
        "linkedin_url": u.linkedin_url,
        "twitter_url": u.twitter_url,
        "website_url": u.website_url,
        "timezone": u.timezone,
        "language_preference": u.language_preference,
        "onboarding_completed": bool(u.onboarding_completed),
        "last_active_at": u.last_active_at.isoformat() if u.last_active_at else None,
        "is_active": bool(u.is_active),
        "created_at": u.created_at.isoformat() if getattr(u, "created_at", None) else None,
        "updated_at": u.updated_at.isoformat() if getattr(u, "updated_at", None) else None,
    }


# GET /users  (optional pagination + filters)
@users_bp.route("/users", methods=["GET"])
def list_users():
    page = request.args.get("page", type=int)
    per_page = min(request.args.get("per_page", 50, type=int), 200)

    q = User.query

    # optional filters
    email_like = request.args.get("email")
    if email_like:
        q = q.filter(User.email.ilike(f"%{email_like}%"))

    is_active = request.args.get("is_active")
    if is_active is not None:
        val = is_active.lower() in ("1", "true", "yes")
        q = q.filter(User.is_active.is_(val))

    if page:
        pagination = q.order_by(User.created_at.desc().nullslast()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        return jsonify({
            "users": [user_to_dict(u) for u in pagination.items],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": pagination.total,
                "pages": pagination.pages,
                "has_next": pagination.has_next,
                "has_prev": pagination.has_prev,
            },
        }), 200

    users = q.order_by(User.created_at.desc().nullslast()).all()
    return jsonify([user_to_dict(u) for u in users]), 200


# POST /users  (creates an app user row; Supabase Auth user is handled elsewhere)
@users_bp.route("/users", methods=["POST"])
def create_user():
    data = request.get_json(force=True) or {}
    required = ["email", "first_name", "last_name"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    email = (data.get("email") or "").lower()
    if User.query.filter(func.lower(User.email) == email).first():
        return jsonify({"error": "Email already in use"}), 409

    user = User(
        email=email,
        first_name=data["first_name"],
        last_name=data["last_name"],
        phone=data.get("phone"),
        profile_image_url=data.get("profile_image_url"),
        bio=data.get("bio"),
        linkedin_url=data.get("linkedin_url"),
        twitter_url=data.get("twitter_url"),
        website_url=data.get("website_url"),
        timezone=data.get("timezone", "UTC"),
        language_preference=data.get("language_preference", "en"),
        onboarding_completed=bool(data.get("onboarding_completed", False)),
        is_active=bool(data.get("is_active", True)),
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(user_to_dict(user)), 201


# GET /users/<uuid:user_id>
@users_bp.route("/users/<uuid:user_id>", methods=["GET"])
def get_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user_to_dict(user)), 200


# PUT /users/<uuid:user_id>
@users_bp.route("/users/<uuid:user_id>", methods=["PUT"])
def update_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json(silent=True) or {}

    # email update with uniqueness check (lowercased)
    if "email" in data and data["email"]:
        new_email = data["email"].lower()
        if new_email != user.email and User.query.filter(func.lower(User.email) == new_email).first():
            return jsonify({"error": "Email already in use"}), 409
        user.email = new_email

    updatable_fields = [
        "first_name", "last_name", "phone", "profile_image_url", "bio",
        "linkedin_url", "twitter_url", "website_url", "timezone",
        "language_preference", "onboarding_completed", "is_active",
    ]
    for f in updatable_fields:
        if f in data:
            setattr(user, f, data[f])

    db.session.commit()
    return jsonify(user_to_dict(user)), 200


# DELETE /users/<uuid:user_id>
@users_bp.route("/users/<uuid:user_id>", methods=["DELETE"])
def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    db.session.delete(user)
    db.session.commit()
    return "", 204