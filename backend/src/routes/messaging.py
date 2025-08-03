from flask import Blueprint, request, jsonify, session
from ..models.user import db, Users, Message
from datetime import datetime
import uuid

messages_bp = Blueprint('messages', __name__)

def require_auth():
    Users_id = session.get('Users_id')
    if not Users_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    Users = Users.query.get(Users_id)
    if not Users:
        return None, jsonify({'error': 'Users not found'}), 404
    return Users, None, None

@messages_bp.route('/inbox', methods=['GET'])
def get_inbox():
    Users, error, status = require_auth()
    if error:
        return error, status

    threads = db.session.query(Message.thread_id) \
        .filter((Message.sender_id == Users.id) | (Message.recipient_id == Users.id)) \
        .distinct().all()
    thread_ids = [t[0] for t in threads if t[0]]

    inbox_data = []
    for thread_id in thread_ids:
        last_msg = Message.query \
            .filter_by(thread_id=thread_id) \
            .order_by(Message.created_at.desc()).first()

        other_Users = last_msg.sender if last_msg.sender_id != Users.id else last_msg.recipient

        inbox_data.append({
            'thread_id': thread_id,
            'last_message': last_msg.to_dict(),
            'other_Users': other_Users.to_dict() if other_Users else None,
            'unread_count': Message.query.filter_by(
                thread_id=thread_id, recipient_id=Users.id, is_read=False
            ).count()
        })

    return jsonify({'inbox': inbox_data}), 200

@messages_bp.route('/thread/<string:thread_id>', methods=['GET'])
def get_thread(thread_id):
    Users, error, status = require_auth()
    if error:
        return error, status

    messages = Message.query.filter_by(thread_id=thread_id) \
        .filter((Message.sender_id == Users.id) | (Message.recipient_id == Users.id)) \
        .order_by(Message.created_at.asc()).all()

    # Mark all as read
    for msg in messages:
        if msg.recipient_id == Users.id and not msg.is_read:
            msg.is_read = True
            msg.read_at = datetime.utcnow()
    db.session.commit()

    return jsonify({'messages': [m.to_dict() for m in messages]}), 200

@messages_bp.route('/send', methods=['POST'])
def send_message():
    Users, error, status = require_auth()
    if error:
        return error, status

    data = request.json
    recipient_id = data.get('recipient_id')
    content = data.get('content')
    thread_id = data.get('thread_id')
    attachments = data.get('attachments', [])

    if not recipient_id or not content:
        return jsonify({'error': 'Recipient and content required'}), 400

    new_msg = Message(
        sender_id=Users.id,
        recipient_id=recipient_id,
        content=content,
        thread_id=thread_id or str(uuid.uuid4()),
        attachments=attachments,
        created_at=datetime.utcnow()
    )
    db.session.add(new_msg)
    db.session.commit()

    return jsonify({'message': 'Sent', 'data': new_msg.to_dict()}), 201

@messages_bp.route('/unread-count', methods=['GET'])
def unread_count():
    Users, error, status = require_auth()
    if error:
        return error, status

    count = Message.query.filter_by(recipient_id=Users.id, is_read=False).count()
    return jsonify({'unread_count': count}), 200

@messages_bp.route('/archive/<int:message_id>', methods=['PUT'])
def archive_message(message_id):
    Users, error, status = require_auth()
    if error:
        return error, status

    msg = Message.query.get(message_id)
    if not msg or msg.recipient_id != Users.id:
        return jsonify({'error': 'Message not found or unauthorized'}), 404

    msg.is_archived = True
    db.session.commit()
    return jsonify({'message': 'Archived'}), 200

@messages_bp.route('/delete/<int:message_id>', methods=['DELETE'])
def delete_message(message_id):
    Users, error, status = require_auth()
    if error:
        return error, status

    msg = Message.query.get(message_id)
    if not msg or msg.sender_id != Users.id:
        return jsonify({'error': 'Unauthorized'}), 403

    msg.is_deleted = True
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200
