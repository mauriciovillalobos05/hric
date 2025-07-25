from flask import Blueprint, jsonify, request, session
from src.models.user import User, Message, db
from datetime import datetime
import uuid

messaging_bp = Blueprint('messaging', __name__)

def require_auth():
    user_id = session.get('user_id')
    if not user_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    
    user = User.query.get(user_id)
    if not user:
        return None, jsonify({'error': 'User not found'}), 404
    
    return user, None, None

@messaging_bp.route('/conversations', methods=['GET'])
def get_conversations():
    """Get user's conversations (grouped messages)"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        
        # Get latest message for each conversation partner
        # This is a simplified approach - in production, you'd want more sophisticated conversation grouping
        subquery = db.session.query(
            Message.sender_id,
            Message.recipient_id,
            db.func.max(Message.created_at).label('latest_message_time')
        ).filter(
            db.or_(Message.sender_id == user.id, Message.recipient_id == user.id)
        ).group_by(
            db.case(
                [(Message.sender_id == user.id, Message.recipient_id)],
                else_=Message.sender_id
            )
        ).subquery()
        
        # Get the actual latest messages
        conversations = db.session.query(Message).join(
            subquery,
            db.and_(
                Message.created_at == subquery.c.latest_message_time,
                db.or_(
                    db.and_(Message.sender_id == subquery.c.sender_id, Message.recipient_id == subquery.c.recipient_id),
                    db.and_(Message.sender_id == subquery.c.recipient_id, Message.recipient_id == subquery.c.sender_id)
                )
            )
        ).order_by(Message.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        result = []
        for message in conversations.items:
            # Determine the other participant
            other_user_id = message.recipient_id if message.sender_id == user.id else message.sender_id
            other_user = User.query.get(other_user_id)
            
            # Count unread messages in this conversation
            unread_count = Message.query.filter_by(
                sender_id=other_user_id,
                recipient_id=user.id,
                is_read=False
            ).count()
            
            conversation_data = {
                'other_user': other_user.to_dict() if other_user else None,
                'latest_message': message.to_dict(),
                'unread_count': unread_count
            }
            result.append(conversation_data)
        
        return jsonify({
            'conversations': result,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': conversations.total,
                'pages': conversations.pages,
                'has_next': conversations.has_next,
                'has_prev': conversations.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@messaging_bp.route('/messages', methods=['GET'])
def get_messages():
    """Get messages with a specific user"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        other_user_id = request.args.get('user_id', type=int)
        if not other_user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 100)
        
        # Verify other user exists
        other_user = User.query.get(other_user_id)
        if not other_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get messages between the two users
        messages = Message.query.filter(
            db.or_(
                db.and_(Message.sender_id == user.id, Message.recipient_id == other_user_id),
                db.and_(Message.sender_id == other_user_id, Message.recipient_id == user.id)
            )
        ).order_by(Message.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        result = []
        for message in messages.items:
            message_data = message.to_dict()
            result.append(message_data)
        
        # Mark messages from other user as read
        Message.query.filter_by(
            sender_id=other_user_id,
            recipient_id=user.id,
            is_read=False
        ).update({
            'is_read': True,
            'read_at': datetime.utcnow()
        })
        db.session.commit()
        
        return jsonify({
            'messages': result,
            'other_user': other_user.to_dict(),
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': messages.total,
                'pages': messages.pages,
                'has_next': messages.has_next,
                'has_prev': messages.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@messaging_bp.route('/send', methods=['POST'])
def send_message():
    """Send a message to another user"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        data = request.json
        
        # Validate required fields
        recipient_id = data.get('recipient_id')
        content = data.get('content')
        
        if not recipient_id or not content:
            return jsonify({'error': 'Recipient ID and content are required'}), 400
        
        if not content.strip():
            return jsonify({'error': 'Message content cannot be empty'}), 400
        
        # Verify recipient exists
        recipient = User.query.get(recipient_id)
        if not recipient:
            return jsonify({'error': 'Recipient not found'}), 404
        
        # Cannot send message to self
        if recipient_id == user.id:
            return jsonify({'error': 'Cannot send message to yourself'}), 400
        
        # Create thread ID for grouping related messages
        thread_id = data.get('thread_id')
        if not thread_id:
            # Generate new thread ID based on user IDs
            user_ids = sorted([user.id, recipient_id])
            thread_id = f"thread_{user_ids[0]}_{user_ids[1]}"
        
        # Create message
        message = Message(
            sender_id=user.id,
            recipient_id=recipient_id,
            subject=data.get('subject', ''),
            content=content.strip(),
            message_type=data.get('message_type', 'direct'),
            thread_id=thread_id
        )
        
        # Handle attachments if provided
        if 'attachments' in data:
            message.set_attachments(data['attachments'])
        
        db.session.add(message)
        db.session.commit()
        
        return jsonify({
            'message': 'Message sent successfully',
            'message_data': message.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messaging_bp.route('/messages/<int:message_id>/read', methods=['POST'])
def mark_message_read():
    """Mark a message as read"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        message = Message.query.get(message_id)
        if not message:
            return jsonify({'error': 'Message not found'}), 404
        
        # Only recipient can mark message as read
        if message.recipient_id != user.id:
            return jsonify({'error': 'Can only mark your own messages as read'}), 403
        
        if not message.is_read:
            message.is_read = True
            message.read_at = datetime.utcnow()
            db.session.commit()
        
        return jsonify({'message': 'Message marked as read'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messaging_bp.route('/messages/<int:message_id>', methods=['DELETE'])
def delete_message():
    """Delete a message (only sender can delete)"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        message = Message.query.get(message_id)
        if not message:
            return jsonify({'error': 'Message not found'}), 404
        
        # Only sender can delete message
        if message.sender_id != user.id:
            return jsonify({'error': 'Can only delete your own messages'}), 403
        
        db.session.delete(message)
        db.session.commit()
        
        return jsonify({'message': 'Message deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messaging_bp.route('/unread-count', methods=['GET'])
def get_unread_count():
    """Get count of unread messages"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        unread_count = Message.query.filter_by(
            recipient_id=user.id,
            is_read=False
        ).count()
        
        return jsonify({'unread_count': unread_count}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@messaging_bp.route('/mark-all-read', methods=['POST'])
def mark_all_read():
    """Mark all messages as read"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # Update all unread messages for this user
        updated_count = Message.query.filter_by(
            recipient_id=user.id,
            is_read=False
        ).update({
            'is_read': True,
            'read_at': datetime.utcnow()
        })
        
        db.session.commit()
        
        return jsonify({
            'message': f'{updated_count} messages marked as read'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messaging_bp.route('/search', methods=['GET'])
def search_messages():
    """Search messages by content or sender"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        query_text = request.args.get('q', '').strip()
        if not query_text:
            return jsonify({'error': 'Search query is required'}), 400
        
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        
        # Search in messages where user is sender or recipient
        messages = Message.query.filter(
            db.and_(
                db.or_(Message.sender_id == user.id, Message.recipient_id == user.id),
                db.or_(
                    Message.content.ilike(f'%{query_text}%'),
                    Message.subject.ilike(f'%{query_text}%')
                )
            )
        ).order_by(Message.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        result = []
        for message in messages.items:
            message_data = message.to_dict()
            result.append(message_data)
        
        return jsonify({
            'messages': result,
            'search_query': query_text,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': messages.total,
                'pages': messages.pages,
                'has_next': messages.has_next,
                'has_prev': messages.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@messaging_bp.route('/thread/<thread_id>', methods=['GET'])
def get_thread_messages():
    """Get all messages in a specific thread"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 100)
        
        # Get messages in thread where user is participant
        messages = Message.query.filter(
            db.and_(
                Message.thread_id == thread_id,
                db.or_(Message.sender_id == user.id, Message.recipient_id == user.id)
            )
        ).order_by(Message.created_at.asc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        result = []
        for message in messages.items:
            message_data = message.to_dict()
            result.append(message_data)
        
        # Mark unread messages in this thread as read
        Message.query.filter(
            db.and_(
                Message.thread_id == thread_id,
                Message.recipient_id == user.id,
                Message.is_read == False
            )
        ).update({
            'is_read': True,
            'read_at': datetime.utcnow()
        })
        db.session.commit()
        
        return jsonify({
            'messages': result,
            'thread_id': thread_id,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': messages.total,
                'pages': messages.pages,
                'has_next': messages.has_next,
                'has_prev': messages.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@messaging_bp.route('/analytics', methods=['GET'])
def get_messaging_analytics():
    """Get messaging analytics for the user"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # Message statistics
        total_sent = Message.query.filter_by(sender_id=user.id).count()
        total_received = Message.query.filter_by(recipient_id=user.id).count()
        unread_messages = Message.query.filter_by(recipient_id=user.id, is_read=False).count()
        
        # Recent activity (last 30 days)
        from datetime import timedelta
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        recent_sent = Message.query.filter(
            Message.sender_id == user.id,
            Message.created_at >= thirty_days_ago
        ).count()
        
        recent_received = Message.query.filter(
            Message.recipient_id == user.id,
            Message.created_at >= thirty_days_ago
        ).count()
        
        # Conversation partners count
        conversation_partners = db.session.query(
            db.func.count(db.distinct(
                db.case(
                    [(Message.sender_id == user.id, Message.recipient_id)],
                    else_=Message.sender_id
                )
            ))
        ).filter(
            db.or_(Message.sender_id == user.id, Message.recipient_id == user.id)
        ).scalar() or 0
        
        analytics = {
            'total_sent': total_sent,
            'total_received': total_received,
            'unread_messages': unread_messages,
            'recent_sent': recent_sent,
            'recent_received': recent_received,
            'conversation_partners': conversation_partners,
            'response_rate': (total_sent / total_received * 100) if total_received > 0 else 0
        }
        
        return jsonify({'analytics': analytics}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

