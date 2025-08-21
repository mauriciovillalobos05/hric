from flask import Blueprint, request, jsonify, session
from datetime import datetime
from src.models.user import Users, Event, EventRegistration, EventPayment, db

events_bp = Blueprint('event', __name__)

# ---------- AUTH HELPERS ----------
def require_auth():
    Users_id = session.get('Users_id')
    if not Users_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    Users = Users.query.get(Users_id)
    if not Users:
        return None, jsonify({'error': 'Users not found'}), 404
    return Users, None, None

def require_admin_auth():
    Users, err, status = require_auth()
    if err:
        return None, err, status
    if Users.role != 'admin':
        return None, jsonify({'error': 'Admin access required'}), 403
    return Users, None, None

# ---------- EVENTS ----------
@events_bp.route('/events', methods=['GET'])
def list_events():
    try:
        events = Event.query.order_by(Event.date.desc()).all()
        result = [e_to_dict(e) for e in events]
        return jsonify({'events': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@events_bp.route('/events/<int:event_id>', methods=['GET'])
def get_event(event_id):
    try:
        event = Event.query.get(event_id)
        if not event:
            return jsonify({'error': 'Event not found'}), 404
        return jsonify({'event': e_to_dict(event)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------- EVENT CREATION (ADMIN) ----------
@events_bp.route('/events', methods=['POST'])
def create_event():
    admin, err, status = require_admin_auth()
    if err:
        return err, status

    try:
        data = request.json
        event = Event(
            title=data['title'],
            date=datetime.strptime(data['date'], "%Y-%m-%dT%H:%M:%S"),
            description=data.get('description'),
            agenda=data.get('agenda', {}),
            presenters=data.get('presenters', {})
        )
        db.session.add(event)
        db.session.commit()
        return jsonify({'message': 'Event created', 'event': e_to_dict(event)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ---------- EVENT REGISTRATION ----------
@events_bp.route('/events/<int:event_id>/register', methods=['POST'])
def register_for_event(event_id):
    Users, err, status = require_auth()
    if err:
        return err, status

    try:
        event = Event.query.get(event_id)
        if not event:
            return jsonify({'error': 'Event not found'}), 404

        if EventRegistration.query.filter_by(event_id=event_id, Users_id=Users.id).first():
            return jsonify({'message': 'Already registered'}), 200

        registration = EventRegistration(
            event_id=event_id,
            Users_id=Users.id,
            answers=request.json.get('answers', {}),
            registration_status='registered'
        )
        db.session.add(registration)
        db.session.commit()
        return jsonify({'message': 'Registered successfully'}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ---------- EVENT ANALYTICS (ADMIN) ----------
@events_bp.route('/admin/events/<int:event_id>/attendees', methods=['GET'])
def get_event_attendees(event_id):
    admin, err, status = require_admin_auth()
    if err:
        return err, status

    try:
        event = Event.query.get(event_id)
        if not event:
            return jsonify({'error': 'Event not found'}), 404

        attendees = [
            {
                'Users': reg.Users.to_summary(),
                'answers': reg.answers,
                'status': reg.registration_status,
                'registered_at': reg.registration_date.isoformat()
            }
            for reg in event.registrations
        ]
        return jsonify({'attendees': attendees}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------- HELPERS ----------
def e_to_dict(event):
    return {
        'id': event.id,
        'title': event.title,
        'date': event.date.isoformat(),
        'description': event.description,
        'agenda': event.agenda,
        'presenters': event.presenters,
        'created_at': event.created_at.isoformat()
    }

@events_bp.route('/events/<int:event_id>/pay', methods=['POST'])
def pay_for_event(event_id):
    Users, err, status = require_auth()
    if err:
        return err, status

    try:
        event = Event.query.get(event_id)
        if not event:
            return jsonify({'error': 'Event not found'}), 404

        data = request.json
        stripe_payment_id = data.get('stripe_payment_id')
        amount = data.get('amount')

        if not stripe_payment_id or not amount:
            return jsonify({'error': 'Missing payment information'}), 400

        # Record payment
        payment = EventPayment(
            Users_id=Users.id,
            event_id=event.id,
            stripe_payment_id=stripe_payment_id,
            amount=amount,
            paid_at=datetime.utcnow()
        )
        db.session.add(payment)

        # Mark as registered (if not already)
        registration = EventRegistration.query.filter_by(event_id=event_id, Users_id=Users.id).first()
        if not registration:
            registration = EventRegistration(
                event_id=event_id,
                Users_id=Users.id,
                answers={},
                registration_status='paid'
            )
            db.session.add(registration)
        else:
            registration.registration_status = 'paid'

        db.session.commit()
        return jsonify({'message': 'Payment successful and registered'}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@events_bp.route('/admin/events/<int:event_id>/attendees/<uuid:Users_id>/status', methods=['PUT'])
def update_attendee_status(event_id, Users_id):
    admin, err, status = require_admin_auth()
    if err:
        return err, status

    try:
        reg = EventRegistration.query.filter_by(event_id=event_id, Users_id=Users_id).first()
        if not reg:
            return jsonify({'error': 'Registration not found'}), 404

        data = request.json
        new_status = data.get('status')  # 'attended', 'cancelled'
        if new_status not in ['attended', 'cancelled']:
            return jsonify({'error': 'Invalid status'}), 400

        reg.registration_status = new_status
        db.session.commit()
        return jsonify({'message': 'Status updated'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@events_bp.route('/events/<int:event_id>/check-in', methods=['POST'])
def check_in_Users(event_id):
    Users, err, status = require_auth()
    if err:
        return err, status

    try:
        reg = EventRegistration.query.filter_by(event_id=event_id, Users_id=Users.id).first()
        if not reg:
            return jsonify({'error': 'Not registered for this event'}), 404

        reg.registration_status = 'attended'
        db.session.commit()
        return jsonify({'message': 'Check-in successful'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
