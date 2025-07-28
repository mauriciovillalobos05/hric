# src/routes/meeting_bp.py

from flask import Blueprint, request, jsonify, session
from src.models.user import db, Meeting, User
from datetime import datetime

meeting_bp = Blueprint('meeting', __name__)

def require_auth():
    user_id = session.get('user_id')
    if not user_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    user = User.query.get(user_id)
    if not user:
        return None, jsonify({'error': 'User not found'}), 404
    return user, None, None


@meeting_bp.route('/schedule', methods=['POST'])
def schedule_meeting():
    user, err, status = require_auth()
    if err:
        return err, status

    data = request.json
    meeting_url = data.get('meeting_url')
    scheduled_at = data.get('scheduled_at')
    metadata = data.get('metadata', {})

    if not meeting_url or not scheduled_at:
        return jsonify({'error': 'Meeting URL and time required'}), 400

    try:
        meeting = Meeting(
            user_id=user.id,
            meeting_url=meeting_url,
            scheduled_at=datetime.fromisoformat(scheduled_at),
            metadata=metadata
        )
        db.session.add(meeting)
        db.session.commit()
        return jsonify({'message': 'Meeting scheduled', 'meeting': meeting.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@meeting_bp.route('/my-meetings', methods=['GET'])
def get_my_meetings():
    user, err, status = require_auth()
    if err:
        return err, status

    meetings = Meeting.query.filter_by(user_id=user.id).order_by(Meeting.scheduled_at.asc()).all()
    return jsonify({'meetings': [m.to_dict() for m in meetings]}), 200

@meeting_bp.route('/cancel/<int:meeting_id>', methods=['DELETE'])
def cancel_meeting(meeting_id):
    user, err, status = require_auth()
    if err:
        return err, status

    meeting = Meeting.query.get(meeting_id)
    if not meeting or meeting.user_id != user.id:
        return jsonify({'error': 'Not found or unauthorized'}), 404

    db.session.delete(meeting)
    db.session.commit()
    return jsonify({'message': 'Meeting canceled'}), 200
