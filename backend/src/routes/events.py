from flask import Blueprint, jsonify, request, session
from src.models.user import User, Event, EventRegistration, db
from datetime import datetime, timedelta

events_bp = Blueprint('events', __name__)

def require_auth():
    user_id = session.get('user_id')
    if not user_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    
    user = User.query.get(user_id)
    if not user:
        return None, jsonify({'error': 'User not found'}), 404
    
    return user, None, None

@events_bp.route('/', methods=['GET'])
def get_events():
    """Get list of events with filtering options"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        event_type = request.args.get('event_type')
        status = request.args.get('status', 'upcoming')
        upcoming_only = request.args.get('upcoming_only', 'true').lower() == 'true'
        
        query = Event.query
        
        # Filter by event type
        if event_type:
            query = query.filter_by(event_type=event_type)
        
        # Filter by status
        if status:
            query = query.filter_by(status=status)
        
        # Filter upcoming events
        if upcoming_only:
            query = query.filter(Event.date >= datetime.utcnow())
        
        # Order by date
        query = query.order_by(Event.date.asc())
        
        events = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        result = []
        for event in events.items:
            event_data = event.to_dict()
            result.append(event_data)
        
        return jsonify({
            'events': result,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': events.total,
                'pages': events.pages,
                'has_next': events.has_next,
                'has_prev': events.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@events_bp.route('/<int:event_id>', methods=['GET'])
def get_event_details(event_id):
    """Get detailed information about a specific event"""
    try:
        event = Event.query.get(event_id)
        if not event:
            return jsonify({'error': 'Event not found'}), 404
        
        event_data = event.to_dict()
        
        # Add registration information if user is authenticated
        user_id = session.get('user_id')
        if user_id:
            registration = EventRegistration.query.filter_by(
                event_id=event_id,
                user_id=user_id
            ).first()
            
            if registration:
                event_data['user_registration'] = registration.to_dict()
        
        # Add registration statistics
        total_registrations = len(event.registrations)
        paid_registrations = len([r for r in event.registrations if r.payment_status == 'paid'])
        
        event_data['registration_stats'] = {
            'total_registrations': total_registrations,
            'paid_registrations': paid_registrations,
            'available_spots': event.capacity - total_registrations if event.capacity else None
        }
        
        return jsonify({'event': event_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@events_bp.route('/', methods=['POST'])
def create_event():
    """Create a new event (admin function)"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # In a real implementation, this would be restricted to admin users
        data = request.json
        
        # Validate required fields
        required_fields = ['title', 'event_type', 'date']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Parse date
        try:
            event_date = datetime.fromisoformat(data['date'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use ISO format.'}), 400
        
        # Create event
        event = Event(
            title=data['title'],
            description=data.get('description', ''),
            event_type=data['event_type'],
            date=event_date,
            location=data.get('location', 'Hyatt Residence Main Lounge'),
            capacity=data.get('capacity'),
            price=data.get('price', 0.0),
            is_members_only=data.get('is_members_only', False),
            status='upcoming'
        )
        
        # Set agenda if provided
        if 'agenda' in data:
            event.set_agenda(data['agenda'])
        
        # Set presenters if provided
        if 'presenters' in data:
            event.set_presenters(data['presenters'])
        
        db.session.add(event)
        db.session.commit()
        
        return jsonify({
            'message': 'Event created successfully',
            'event': event.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@events_bp.route('/<int:event_id>', methods=['PUT'])
def update_event(event_id):
    """Update an existing event (admin function)"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        event = Event.query.get(event_id)
        if not event:
            return jsonify({'error': 'Event not found'}), 404
        
        data = request.json
        
        # Update basic fields
        updateable_fields = ['title', 'description', 'location', 'capacity', 'price', 'is_members_only', 'status']
        for field in updateable_fields:
            if field in data:
                setattr(event, field, data[field])
        
        # Update date if provided
        if 'date' in data:
            try:
                event.date = datetime.fromisoformat(data['date'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use ISO format.'}), 400
        
        # Update agenda if provided
        if 'agenda' in data:
            event.set_agenda(data['agenda'])
        
        # Update presenters if provided
        if 'presenters' in data:
            event.set_presenters(data['presenters'])
        
        event.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Event updated successfully',
            'event': event.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@events_bp.route('/<int:event_id>/register', methods=['POST'])
def register_for_event(event_id):
    """Register for an event"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        event = Event.query.get(event_id)
        if not event:
            return jsonify({'error': 'Event not found'}), 404
        
        # Check if event is in the future
        if event.date <= datetime.utcnow():
            return jsonify({'error': 'Cannot register for past events'}), 400
        
        # Check if user is already registered
        existing_registration = EventRegistration.query.filter_by(
            event_id=event_id,
            user_id=user.id
        ).first()
        
        if existing_registration:
            return jsonify({'error': 'Already registered for this event'}), 409
        
        # Check capacity
        if event.capacity:
            current_registrations = len(event.registrations)
            if current_registrations >= event.capacity:
                return jsonify({'error': 'Event is at full capacity'}), 400
        
        # Check membership requirement
        if event.is_members_only and user.subscription_tier == 'free':
            return jsonify({'error': 'This event is for members only'}), 403
        
        data = request.json or {}
        
        # Create registration
        registration = EventRegistration(
            event_id=event_id,
            user_id=user.id,
            payment_status='pending' if event.price > 0 else 'paid',
            special_requests=data.get('special_requests', '')
        )
        
        db.session.add(registration)
        db.session.commit()
        
        return jsonify({
            'message': 'Successfully registered for event',
            'registration': registration.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@events_bp.route('/<int:event_id>/unregister', methods=['DELETE'])
def unregister_from_event(event_id):
    """Unregister from an event"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        registration = EventRegistration.query.filter_by(
            event_id=event_id,
            user_id=user.id
        ).first()
        
        if not registration:
            return jsonify({'error': 'Registration not found'}), 404
        
        event = Event.query.get(event_id)
        
        # Check if event is too close (e.g., within 24 hours)
        if event and event.date <= datetime.utcnow() + timedelta(hours=24):
            return jsonify({'error': 'Cannot unregister within 24 hours of event'}), 400
        
        db.session.delete(registration)
        db.session.commit()
        
        return jsonify({'message': 'Successfully unregistered from event'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@events_bp.route('/<int:event_id>/registrations', methods=['GET'])
def get_event_registrations(event_id):
    """Get registrations for an event (admin function)"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # In a real implementation, this would be restricted to admin users
        event = Event.query.get(event_id)
        if not event:
            return jsonify({'error': 'Event not found'}), 404
        
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 100)
        payment_status = request.args.get('payment_status')
        attendance_status = request.args.get('attendance_status')
        
        query = EventRegistration.query.filter_by(event_id=event_id)
        
        if payment_status:
            query = query.filter_by(payment_status=payment_status)
        
        if attendance_status:
            query = query.filter_by(attendance_status=attendance_status)
        
        registrations = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        result = []
        for registration in registrations.items:
            registration_data = registration.to_dict()
            result.append(registration_data)
        
        # Calculate statistics
        total_registrations = len(event.registrations)
        paid_count = len([r for r in event.registrations if r.payment_status == 'paid'])
        attended_count = len([r for r in event.registrations if r.attendance_status == 'attended'])
        
        return jsonify({
            'registrations': result,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': registrations.total,
                'pages': registrations.pages,
                'has_next': registrations.has_next,
                'has_prev': registrations.has_prev
            },
            'stats': {
                'total_registrations': total_registrations,
                'paid_registrations': paid_count,
                'attended_count': attended_count,
                'payment_rate': (paid_count / total_registrations * 100) if total_registrations > 0 else 0,
                'attendance_rate': (attended_count / total_registrations * 100) if total_registrations > 0 else 0
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@events_bp.route('/my-registrations', methods=['GET'])
def get_my_registrations():
    """Get current user's event registrations"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        upcoming_only = request.args.get('upcoming_only', 'false').lower() == 'true'
        
        query = EventRegistration.query.filter_by(user_id=user.id).join(Event)
        
        if upcoming_only:
            query = query.filter(Event.date >= datetime.utcnow())
        
        query = query.order_by(Event.date.desc())
        
        registrations = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        result = []
        for registration in registrations.items:
            registration_data = registration.to_dict()
            # Include event details
            registration_data['event'] = registration.event.to_dict()
            result.append(registration_data)
        
        return jsonify({
            'registrations': result,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': registrations.total,
                'pages': registrations.pages,
                'has_next': registrations.has_next,
                'has_prev': registrations.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@events_bp.route('/upcoming', methods=['GET'])
def get_upcoming_events():
    """Get upcoming events"""
    try:
        limit = min(request.args.get('limit', 5, type=int), 20)
        event_type = request.args.get('event_type')
        
        query = Event.query.filter(
            Event.date >= datetime.utcnow(),
            Event.status == 'upcoming'
        )
        
        if event_type:
            query = query.filter_by(event_type=event_type)
        
        events = query.order_by(Event.date.asc()).limit(limit).all()
        
        result = []
        for event in events:
            event_data = event.to_dict()
            
            # Add registration status if user is authenticated
            user_id = session.get('user_id')
            if user_id:
                registration = EventRegistration.query.filter_by(
                    event_id=event.id,
                    user_id=user_id
                ).first()
                
                event_data['is_registered'] = registration is not None
                if registration:
                    event_data['registration_status'] = registration.payment_status
            
            result.append(event_data)
        
        return jsonify({'events': result}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@events_bp.route('/types', methods=['GET'])
def get_event_types():
    """Get available event types"""
    event_types = [
        {
            'value': 'monthly_meeting',
            'label': 'Monthly Meeting',
            'description': 'Regular monthly investor-entrepreneur networking event'
        },
        {
            'value': 'enterprise_showcase',
            'label': 'Enterprise Showcase',
            'description': 'Premium presentation slots for established companies'
        },
        {
            'value': 'networking',
            'label': 'Networking Event',
            'description': 'Casual networking and relationship building'
        },
        {
            'value': 'workshop',
            'label': 'Workshop',
            'description': 'Educational workshops on investment and entrepreneurship'
        },
        {
            'value': 'pitch_competition',
            'label': 'Pitch Competition',
            'description': 'Competitive pitching events with prizes'
        }
    ]
    
    return jsonify({'event_types': event_types}), 200

@events_bp.route('/analytics', methods=['GET'])
def get_event_analytics():
    """Get event analytics"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # Overall event statistics
        total_events = Event.query.count()
        upcoming_events = Event.query.filter(
            Event.date >= datetime.utcnow(),
            Event.status == 'upcoming'
        ).count()
        
        completed_events = Event.query.filter_by(status='completed').count()
        
        # Registration statistics
        total_registrations = EventRegistration.query.count()
        paid_registrations = EventRegistration.query.filter_by(payment_status='paid').count()
        attended_registrations = EventRegistration.query.filter_by(attendance_status='attended').count()
        
        # Recent activity (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_events = Event.query.filter(Event.created_at >= thirty_days_ago).count()
        recent_registrations = EventRegistration.query.filter(
            EventRegistration.registration_date >= thirty_days_ago
        ).count()
        
        # Event type distribution
        event_type_stats = db.session.query(
            Event.event_type,
            db.func.count(Event.id).label('count')
        ).group_by(Event.event_type).all()
        
        # Average attendance
        avg_attendance = db.session.query(
            db.func.avg(db.func.count(EventRegistration.id))
        ).join(Event).group_by(Event.id).scalar() or 0
        
        analytics = {
            'total_events': total_events,
            'upcoming_events': upcoming_events,
            'completed_events': completed_events,
            'total_registrations': total_registrations,
            'paid_registrations': paid_registrations,
            'attended_registrations': attended_registrations,
            'recent_events': recent_events,
            'recent_registrations': recent_registrations,
            'payment_rate': (paid_registrations / total_registrations * 100) if total_registrations > 0 else 0,
            'attendance_rate': (attended_registrations / total_registrations * 100) if total_registrations > 0 else 0,
            'average_attendance': round(avg_attendance, 1),
            'event_type_distribution': [
                {'type': event_type, 'count': count}
                for event_type, count in event_type_stats
            ]
        }
        
        return jsonify({'analytics': analytics}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

