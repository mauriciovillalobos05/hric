# src/routes/messages.py

from datetime import datetime
import os
import uuid

import requests
from flask import Blueprint, request, jsonify
from sqlalchemy import or_

from src.extensions import db
from src.models.user import User, Messaging

messages_bp = Blueprint("messages", __name__)

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

    user = User.query.get(user_id)
    if not user:
        return None, None, (jsonify({"error": "User not found in database"}), 404)

    return user, token, None


# --------------------- Helpers --------------------- #

def _user_summary(u: User):
    return {
        "id": str(u.id),
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "profile_image_url": u.profile_image_url,
    }

def _message_to_dict(m: Messaging):
    return {
        "id": str(m.id),
        "thread_id": str(m.thread_id) if m.thread_id else None,
        "parent_message_id": str(m.parent_message_id) if m.parent_message_id else None,
        "sender_user_id": str(m.sender_user_id),
        "recipient_user_id": str(m.recipient_user_id),
        "subject": m.subject,
        "content": m.content,
        "message_type": m.message_type,
        "priority": m.priority,
        "is_read": m.is_read,
        "is_archived": m.is_archived,
        "is_deleted": m.is_deleted,
        "attachments": m.attachments or [],
        "sent_at": m.sent_at.isoformat() if m.sent_at else None,
        "read_at": m.read_at.isoformat() if m.read_at else None,
        "replied_at": m.replied_at.isoformat() if m.replied_at else None,
    }


# --------------------- Routes --------------------- #

@messages_bp.route("/inbox", methods=["GET"])
def get_inbox():
    user, _, err = require_auth()
    if err:
        return err

    # Find all threads the user participates in
    threads = (
        db.session.query(Messaging.thread_id)
        .filter(
            or_(
                Messaging.sender_user_id == user.id,
                Messaging.recipient_user_id == user.id,
            ),
            Messaging.thread_id.isnot(None),
        )
        .distinct()
        .all()
    )
    thread_ids = [t[0] for t in threads if t[0]]

    inbox_data = []
    for tid in thread_ids:
        last_msg = (
            Messaging.query.filter(Messaging.thread_id == tid)
            .order_by(Messaging.sent_at.desc())
            .first()
        )
        if not last_msg:
            continue

        other_user = last_msg.sender if last_msg.sender_user_id != user.id else last_msg.recipient
        unread_count = (
            Messaging.query.filter_by(
                thread_id=tid, recipient_user_id=user.id, is_read=False
            ).count()
        )

        inbox_data.append({
            "thread_id": str(tid),
            "last_message": _message_to_dict(last_msg),
            "other_user": _user_summary(other_user) if other_user else None,
            "unread_count": unread_count,
        })

    return jsonify({"inbox": inbox_data}), 200


@messages_bp.route("/thread/<uuid:thread_id>", methods=["GET"])
def get_thread(thread_id):
    user, _, err = require_auth()
    if err:
        return err

    messages = (
        Messaging.query.filter(Messaging.thread_id == thread_id)
        .filter(
            or_(
                Messaging.sender_user_id == user.id,
                Messaging.recipient_user_id == user.id,
            )
        )
        .order_by(Messaging.sent_at.asc())
        .all()
    )

    # Mark all received messages in this thread as read
    updated = False
    now = datetime.utcnow()
    for msg in messages:
        if msg.recipient_user_id == user.id and not msg.is_read:
            msg.is_read = True
            msg.read_at = now
            updated = True
    if updated:
        db.session.commit()

    return jsonify({"messages": [_message_to_dict(m) for m in messages]}), 200


@messages_bp.route("/send", methods=["POST"])
def send_message():
    user, _, err = require_auth()
    if err:
        return err

    data = request.get_json() or {}
    recipient_id = data.get("recipient_id")
    content = data.get("content")
    subject = data.get("subject")
    provided_thread_id = data.get("thread_id")
    attachments = data.get("attachments", [])

    if not recipient_id or not content:
        return jsonify({"error": "recipient_id and content are required"}), 400

    try:
        # Ensure recipient exists
        recipient = User.query.get(recipient_id)
        if not recipient:
            return jsonify({"error": "Recipient not found"}), 404

        thread_id = provided_thread_id or uuid.uuid4()

        msg = Messaging(
            sender_user_id=user.id,
            recipient_user_id=recipient.id,
            thread_id=thread_id,
            subject=subject,
            content=content,
            attachments=attachments,
            # sent_at uses server_default=func.now(); it's fine to omit explicitly
        )
        db.session.add(msg)
        db.session.commit()

        return jsonify({"message": "Sent", "data": _message_to_dict(msg)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@messages_bp.route("/unread-count", methods=["GET"])
def unread_count():
    user, _, err = require_auth()
    if err:
        return err

    count = Messaging.query.filter_by(recipient_user_id=user.id, is_read=False).count()
    return jsonify({"unread_count": count}), 200


@messages_bp.route("/archive/<uuid:message_id>", methods=["PUT"])
def archive_message(message_id):
    user, _, err = require_auth()
    if err:
        return err

    msg = Messaging.query.get(message_id)
    if not msg:
        return jsonify({"error": "Message not found"}), 404
    if msg.recipient_user_id != user.id:
        return jsonify({"error": "Not authorized to archive this message"}), 403

    try:
        msg.is_archived = True
        db.session.commit()
        return jsonify({"message": "Archived"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@messages_bp.route("/delete/<uuid:message_id>", methods=["DELETE"])
def delete_message(message_id):
    user, _, err = require_auth()
    if err:
        return err

    msg = Messaging.query.get(message_id)
    if not msg:
        return jsonify({"error": "Message not found"}), 404
    if msg.sender_user_id != user.id:
        return jsonify({"error": "Not authorized to delete this message"}), 403

    try:
        msg.is_deleted = True
        db.session.commit()
        return jsonify({"message": "Deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500