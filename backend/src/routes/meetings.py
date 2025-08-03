# src/routes/meeting_bp.py

from flask import Blueprint, request, jsonify, session
from ..models.user import db, Meeting, Users
from datetime import datetime

meeting_bp = Blueprint('meeting', __name__)

def require_auth():
    Users_id = session.get('Users_id')
    if not Users_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    Users = Users.query.get(Users_id)
    if not Users:
        return None, jsonify({'error': 'Users not found'}), 404
    return Users, None, None


@meeting_bp.route('/schedule', methods=['POST'])
def schedule_meeting():
    Users, err, status = require_auth()
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
            Users_id=Users.id,
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
    Users, err, status = require_auth()
    if err:
        return err, status

    meetings = Meeting.query.filter_by(Users_id=Users.id).order_by(Meeting.scheduled_at.asc()).all()
    return jsonify({'meetings': [m.to_dict() for m in meetings]}), 200

@meeting_bp.route('/cancel/<int:meeting_id>', methods=['DELETE'])
def cancel_meeting(meeting_id):
    Users, err, status = require_auth()
    if err:
        return err, status

    meeting = Meeting.query.get(meeting_id)
    if not meeting or meeting.Users_id != Users.id:
        return jsonify({'error': 'Not found or unauthorized'}), 404

    db.session.delete(meeting)
    db.session.commit()
    return jsonify({'message': 'Meeting canceled'}), 200
