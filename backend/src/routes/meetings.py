# src/routes/meeting_bp.py

from datetime import datetime
from uuid import UUID

import os
import requests
from flask import Blueprint, request, jsonify
from sqlalchemy import or_

from src.extensions import db
from src.models.user import User, Meeting, EnterpriseUser

meeting_bp = Blueprint("meeting", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")


# --------------------- Auth --------------------- #

def require_auth():
    """Validate Supabase JWT and return (user, token, error_response_or_None)."""
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

    user = User.query.get(user_id)
    if not user:
        return None, None, (jsonify({"error": "User not found in database"}), 404)
    return user, token, None


# --------------------- Helpers --------------------- #

def _parse_iso_dt(value: str) -> datetime:
    """Accepts ISO 8601; supports trailing 'Z'."""
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)

def _my_enterprise_ids(user_id):
    rows = (
        db.session.query(EnterpriseUser.enterprise_id)
        .filter(EnterpriseUser.user_id == user_id, EnterpriseUser.is_active.is_(True))
        .all()
    )
    return [r[0] for r in rows]

def _meeting_to_dict(m: Meeting):
    return {
        "id": str(m.id),
        "enterprise_id": str(m.enterprise_id) if m.enterprise_id else None,
        "title": m.title,
        "description": m.description,
        "meeting_type": m.meeting_type,
        "scheduled_time": m.scheduled_time.isoformat() if m.scheduled_time else None,
        "duration_minutes": m.duration_minutes,
        "location": m.location,
        "meeting_url": m.meeting_url,
        "agenda": m.agenda,
        "attendees": m.attendees or [],
        "status": m.status,
        "meeting_notes": m.meeting_notes,
        "action_items": m.action_items or [],
        "follow_up_required": m.follow_up_required,
        "recording_url": m.recording_url,
        "created_by": str(m.created_by) if m.created_by else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


# --------------------- Routes --------------------- #

@meeting_bp.route("/schedule", methods=["POST"])
def schedule_meeting():
    user, _, error = require_auth()
    if error:
        return error

    data = request.get_json() or {}

    title = data.get("title")
    scheduled_time = data.get("scheduled_time")  # ISO8601 string
    enterprise_id = data.get("enterprise_id")    # optional (UUID string)
    meeting_url = data.get("meeting_url")
    description = data.get("description")
    meeting_type = data.get("meeting_type")      # must be one of the allowed values in the model constraint
    duration_minutes = data.get("duration_minutes", 60)
    location = data.get("location")
    agenda = data.get("agenda")
    attendees = data.get("attendees", [])        # list/json
    status = data.get("status", "scheduled")

    if not title or not scheduled_time:
        return jsonify({"error": "title and scheduled_time are required"}), 400

    # If enterprise_id not provided, try to infer if the user belongs to exactly one enterprise
    if not enterprise_id:
        my_eids = _my_enterprise_ids(user.id)
        if len(my_eids) == 1:
            enterprise_id = str(my_eids[0])

    try:
        when = _parse_iso_dt(scheduled_time)
    except Exception:
        return jsonify({"error": "scheduled_time must be a valid ISO-8601 datetime"}), 400

    try:
        meeting = Meeting(
            enterprise_id=UUID(enterprise_id) if enterprise_id else None,
            title=title,
            description=description,
            meeting_type=meeting_type,
            scheduled_time=when,
            duration_minutes=duration_minutes,
            location=location,
            meeting_url=meeting_url,
            agenda=agenda,
            attendees=attendees,
            status=status,
            created_by=user.id,
        )
        db.session.add(meeting)
        db.session.commit()
        return jsonify({"message": "Meeting scheduled", "meeting": _meeting_to_dict(meeting)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@meeting_bp.route("/my-meetings", methods=["GET"])
def get_my_meetings():
    user, _, error = require_auth()
    if error:
        return error

    my_eids = _my_enterprise_ids(user.id)

    meetings = (
        Meeting.query
        .filter(
            or_(
                Meeting.created_by == user.id,
                Meeting.enterprise_id.in_(my_eids) if my_eids else False,
            )
        )
        .order_by(Meeting.scheduled_time.asc())
        .all()
    )
    return jsonify({"meetings": [_meeting_to_dict(m) for m in meetings]}), 200


@meeting_bp.route("/cancel/<uuid:meeting_id>", methods=["DELETE"])
def cancel_meeting(meeting_id):
    user, _, error = require_auth()
    if error:
        return error

    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        return jsonify({"error": "Meeting not found"}), 404

    # Allow if creator, or owner/admin of the meeting's enterprise
    is_creator = (meeting.created_by == user.id)
    is_enterprise_admin = False
    if meeting.enterprise_id:
        eu = (
            EnterpriseUser.query
            .filter(
                EnterpriseUser.user_id == user.id,
                EnterpriseUser.enterprise_id == meeting.enterprise_id,
                EnterpriseUser.is_active.is_(True),
                EnterpriseUser.role.in_(["owner", "admin"]),
            )
            .first()
        )
        is_enterprise_admin = eu is not None

    if not (is_creator or is_enterprise_admin):
        return jsonify({"error": "Not authorized to cancel this meeting"}), 403

    try:
        db.session.delete(meeting)
        db.session.commit()
        return jsonify({"message": "Meeting canceled"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500