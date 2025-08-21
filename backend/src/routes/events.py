# src/routes/events.py

from datetime import datetime, timedelta, timezone
import os

import requests
from flask import Blueprint, request, jsonify
from sqlalchemy import func

from src.extensions import db
from src.models.user import (
    User,
    Event,
    UserActivity,        # we'll use this to track registrations, payments, check-ins
    EnterpriseUser,      # for admin/owner checks
)

events_bp = Blueprint("events", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
LOCAL_API_BASE_URL = os.getenv("LOCAL_API_BASE_URL")


# --------------------- Helpers ---------------------

def _parse_dt(s: str):
    """Parse ISO-ish strings (supports trailing 'Z')."""
    if not s:
        return None
    try:
        # handle '2025-01-02T12:34:56Z'
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except Exception:
        return None


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


def _is_admin_like(user: User) -> bool:
    """Owner/admin of any enterprise counts as admin-like."""
    return (
        db.session.query(EnterpriseUser.id)
        .filter(
            EnterpriseUser.user_id == user.id,
            EnterpriseUser.is_active.is_(True),
            EnterpriseUser.role.in_(["owner", "admin"]),
        )
        .first()
        is not None
    )


def _can_manage_event(user: User, event: Event) -> bool:
    """Event creator OR owner/admin of the event's enterprise (if set) OR admin-like."""
    if not event:
        return False
    if event.created_by == user.id:
        return True
    if _is_admin_like(user):
        return True
    if event.enterprise_id:
        mem = EnterpriseUser.query.filter_by(
            user_id=user.id, enterprise_id=event.enterprise_id, is_active=True
        ).first()
        return bool(mem and mem.role in ("owner", "admin"))
    return False


def _event_to_dict(e: Event):
    return {
        "id": str(e.id),
        "enterprise_id": str(e.enterprise_id) if e.enterprise_id else None,
        "title": e.title,
        "description": e.description,
        "event_type": e.event_type,
        "start_time": e.start_time.isoformat() if e.start_time else None,
        "end_time": e.end_time.isoformat() if e.end_time else None,
        "location": e.location,
        "venue_details": e.venue_details or {},
        "ticket_price": float(e.ticket_price or 0),
        "max_attendees": e.max_attendees,
        "current_attendees": e.current_attendees or 0,
        "registration_deadline": e.registration_deadline.isoformat() if e.registration_deadline else None,
        "event_details": e.event_details or {},
        "agenda": e.agenda or [],
        "speakers": e.speakers or [],
        "sponsors": e.sponsors or [],
        "status": e.status,
        "is_public": e.is_public,
        "registration_required": e.registration_required,
        "created_by": str(e.created_by) if e.created_by else None,
        "created_at": e.created_at.isoformat() if hasattr(e, "created_at") and e.created_at else None,
        "updated_at": e.updated_at.isoformat() if hasattr(e, "updated_at") and e.updated_at else None,
    }


def _registration_activity(event_id, user_id):
    """Fetch a user's registration activity for a given event."""
    return UserActivity.query.filter(
        UserActivity.user_id == user_id,
        UserActivity.activity_type == "event_registration",
        UserActivity.activity_data["event_id"].astext == str(event_id),
    ).first()


def _payment_activity(event_id, user_id):
    """Fetch a user's payment activity for a given event."""
    return UserActivity.query.filter(
        UserActivity.user_id == user_id,
        UserActivity.activity_type == "event_payment",
        UserActivity.activity_data["event_id"].astext == str(event_id),
    ).first()


def _count_registrations(event_id):
    return (
        db.session.query(func.count(UserActivity.id))
        .filter(
            UserActivity.activity_type == "event_registration",
            UserActivity.activity_data["event_id"].astext == str(event_id),
        )
        .scalar()
        or 0
    )


def _sync_event_attendee_count(event: Event):
    """Optional: keep Event.current_attendees in sync with registrations."""
    try:
        event.current_attendees = _count_registrations(event.id)
        db.session.commit()
    except Exception:
        db.session.rollback()


# --------------------- Events ---------------------

@events_bp.route("/events", methods=["GET"])
def list_events():
    """
    Optional filters:
      ?status=planned|open_registration|in_progress|completed|cancelled
      ?from=ISO8601  ?to=ISO8601
    """
    try:
        q = Event.query

        status = request.args.get("status")
        if status:
            q = q.filter(Event.status == status)

        dt_from = _parse_dt(request.args.get("from"))
        dt_to = _parse_dt(request.args.get("to"))
        if dt_from:
            q = q.filter(Event.start_time >= dt_from)
        if dt_to:
            q = q.filter(Event.start_time <= dt_to)

        events = q.order_by(Event.start_time.desc()).all()
        return jsonify({"events": [_event_to_dict(e) for e in events]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@events_bp.route("/events/<uuid:event_id>", methods=["GET"])
def get_event(event_id):
    try:
        e = Event.query.get(event_id)
        if not e:
            return jsonify({"error": "Event not found"}), 404
        return jsonify({"event": _event_to_dict(e)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --------------------- Event creation (creator/owner/admin) ---------------------

@events_bp.route("/events", methods=["POST"])
def create_event():
    user, _, err = require_auth()
    if err:
        return err

    try:
        data = request.get_json() or {}
        title = data.get("title")
        start_time = _parse_dt(data.get("start_time"))
        end_time = _parse_dt(data.get("end_time"))
        if not title or not start_time or not end_time:
            return jsonify({"error": "title, start_time and end_time are required (ISO8601)"}), 400

        # Optional: enterprise_id (if provided, user must be owner/admin)
        enterprise_id = data.get("enterprise_id")
        if enterprise_id:
            mem = EnterpriseUser.query.filter_by(
                user_id=user.id, enterprise_id=enterprise_id, is_active=True
            ).first()
            if not mem or mem.role not in ("owner", "admin"):
                return jsonify({"error": "Owner/admin membership required for this enterprise"}), 403

        e = Event(
            enterprise_id=enterprise_id,
            title=title,
            description=data.get("description"),
            event_type=data.get("event_type"),
            start_time=start_time,
            end_time=end_time,
            location=data.get("location"),
            venue_details=data.get("venue_details"),
            ticket_price=data.get("ticket_price") or 0,
            max_attendees=data.get("max_attendees"),
            current_attendees=0,
            registration_deadline=_parse_dt(data.get("registration_deadline")),
            event_details=data.get("event_details"),
            agenda=data.get("agenda") or [],
            speakers=data.get("speakers") or [],
            sponsors=data.get("sponsors") or [],
            status=data.get("status") or "planned",
            is_public=bool(data.get("is_public", True)),
            registration_required=bool(data.get("registration_required", True)),
            created_by=user.id,
        )
        db.session.add(e)
        db.session.commit()
        return jsonify({"message": "Event created", "event": _event_to_dict(e)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# --------------------- Registration ---------------------

@events_bp.route("/events/<uuid:event_id>/register", methods=["POST"])
def register_for_event(event_id):
    user, _, err = require_auth()
    if err:
        return err

    try:
        e = Event.query.get(event_id)
        if not e:
            return jsonify({"error": "Event not found"}), 404

        # Check deadline / capacity
        if e.registration_deadline and datetime.now(timezone.utc) > e.registration_deadline:
            return jsonify({"error": "Registration deadline has passed"}), 400
        if e.max_attendees and _count_registrations(e.id) >= e.max_attendees:
            return jsonify({"error": "Event is full"}), 400

        answers = (request.get_json() or {}).get("answers", {})

        existing = _registration_activity(e.id, user.id)
        if existing:
            # already registered; update answers optionally
            data = existing.activity_data or {}
            data["answers"] = answers or data.get("answers") or {}
            data["registration_status"] = data.get("registration_status", "registered")
            existing.activity_data = data
        else:
            ua = UserActivity(
                user_id=user.id,
                activity_type="event_registration",
                activity_category="events",
                activity_data={
                    "event_id": str(e.id),
                    "answers": answers,
                    "registration_status": "registered",
                },
            )
            db.session.add(ua)

        db.session.commit()
        _sync_event_attendee_count(e)
        return jsonify({"message": "Registered successfully"}), 201
    except Exception as ex:
        db.session.rollback
        return jsonify({"error": str(ex)}), 500


# --------------------- Payment (record only) ---------------------

@events_bp.route("/events/<uuid:event_id>/pay", methods=["POST"])
def pay_for_event(event_id):
    user, _, err = require_auth()
    if err:
        return err

    try:
        e = Event.query.get(event_id)
        if not e:
            return jsonify({"error": "Event not found"}), 404

        data = request.get_json() or {}
        stripe_payment_id = data.get("stripe_payment_id")
        amount = data.get("amount")
        if not stripe_payment_id or amount is None:
            return jsonify({"error": "stripe_payment_id and amount are required"}), 400

        # record payment activity
        pay = _payment_activity(e.id, user.id)
        if pay:
            # idempotent-ish: update
            pdata = pay.activity_data or {}
            pdata.update({"stripe_payment_id": stripe_payment_id, "amount": amount})
            pay.activity_data = pdata
        else:
            pay = UserActivity(
                user_id=user.id,
                activity_type="event_payment",
                activity_category="events",
                activity_data={
                    "event_id": str(e.id),
                    "stripe_payment_id": stripe_payment_id,
                    "amount": amount,
                },
            )
            db.session.add(pay)

        # ensure registration exists & mark status 'paid'
        reg = _registration_activity(e.id, user.id)
        if not reg:
            reg = UserActivity(
                user_id=user.id,
                activity_type="event_registration",
                activity_category="events",
                activity_data={
                    "event_id": str(e.id),
                    "answers": {},
                    "registration_status": "paid",
                },
            )
            db.session.add(reg)
        else:
            data = reg.activity_data or {}
            data["registration_status"] = "paid"
            reg.activity_data = data

        db.session.commit()
        _sync_event_attendee_count(e)
        return jsonify({"message": "Payment recorded and registration updated"}), 201
    except Exception as ex:
        db.session.rollback()
        return jsonify({"error": str(ex)}), 500


# --------------------- Admin: attendees ---------------------

@events_bp.route("/admin/events/<uuid:event_id>/attendees", methods=["GET"])
def get_event_attendees(event_id):
    user, _, err = require_auth()
    if err:
        return err

    try:
        e = Event.query.get(event_id)
        if not e:
            return jsonify({"error": "Event not found"}), 404
        if not _can_manage_event(user, e):
            return jsonify({"error": "Admin/owner access required"}), 403

        regs = UserActivity.query.filter(
            UserActivity.activity_type == "event_registration",
            UserActivity.activity_data["event_id"].astext == str(e.id),
        ).all()

        attendees = []
        for reg in regs:
            u = User.query.get(reg.user_id)
            attendees.append({
                "user": {
                    "id": str(u.id),
                    "email": u.email,
                    "name": f"{u.first_name} {u.last_name}",
                } if u else {"id": str(reg.user_id)},
                "answers": (reg.activity_data or {}).get("answers", {}),
                "status": (reg.activity_data or {}).get("registration_status", "registered"),
                "registered_at": reg.activity_date.isoformat() if reg.activity_date else None,
            })

        return jsonify({"attendees": attendees}), 200
    except Exception as ex:
        return jsonify({"error": str(ex)}), 500


@events_bp.route("/admin/events/<uuid:event_id>/attendees/<uuid:user_id>/status", methods=["PUT"])
def update_attendee_status(event_id, user_id):
    user, _, err = require_auth()
    if err:
        return err

    try:
        e = Event.query.get(event_id)
        if not e:
            return jsonify({"error": "Event not found"}), 404
        if not _can_manage_event(user, e):
            return jsonify({"error": "Admin/owner access required"}), 403

        reg = _registration_activity(e.id, user_id)
        if not reg:
            return jsonify({"error": "Registration not found"}), 404

        new_status = (request.get_json() or {}).get("status")
        if new_status not in {"registered", "paid", "attended", "cancelled"}:
            return jsonify({"error": "Invalid status"}), 400

        data = reg.activity_data or {}
        data["registration_status"] = new_status
        reg.activity_data = data
        db.session.commit()
        _sync_event_attendee_count(e)
        return jsonify({"message": "Status updated"}), 200
    except Exception as ex:
        db.session.rollback()
        return jsonify({"error": str(ex)}), 500


# --------------------- Self check-in ---------------------

@events_bp.route("/events/<uuid:event_id>/check-in", methods=["POST"])
def check_in_user(event_id):
    user, _, err = require_auth()
    if err:
        return err

    try:
        e = Event.query.get(event_id)
        if not e:
            return jsonify({"error": "Event not found"}), 404

        reg = _registration_activity(e.id, user.id)
        if not reg:
            return jsonify({"error": "Not registered for this event"}), 404

        data = reg.activity_data or {}
        data["registration_status"] = "attended"
        reg.activity_data = data
        db.session.commit()
        _sync_event_attendee_count(e)
        return jsonify({"message": "Check-in successful"}), 200
    except Exception as ex:
        db.session.rollback()
        return jsonify({"error": str(ex)}), 500