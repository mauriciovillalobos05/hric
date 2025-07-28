# src/websockets/messages_ws.py

from flask_socketio import emit, join_room
from src.socketio import socketio
from src.models.user import db, Message, User
from datetime import datetime
import uuid
import requests
from jose import jwt
from src.models.user import User

SUPABASE_JWKS_URL = "https://dtnvirvfisilixuqterg.supabase.co/auth/v1/keys"

_jwks = None  # cache

def get_jwks():
    global _jwks
    if not _jwks:
        resp = requests.get(SUPABASE_JWKS_URL)
        resp.raise_for_status()
        _jwks = resp.json()
    return _jwks

def verify_token(token):
    try:
        jwks = get_jwks()
        unverified_header = jwt.get_unverified_header(token)

        key = next(
            (k for k in jwks["keys"] if k["kid"] == unverified_header["kid"]),
            None
        )
        if not key:
            return None

        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            options={"verify_aud": False}  # or set your audience
        )

        user_id = payload.get("sub")
        if not user_id:
            return None

        return User.query.get(user_id)

    except Exception as e:
        print(f"Token verification failed: {e}")
        return None


@socketio.on('connect')
def on_connect():
    emit('connected', {'message': 'WebSocket connected'})

@socketio.on('join')
def on_join(data):
    user_id = data.get('user_id')
    if user_id:
        join_room(str(user_id))
        emit('joined', {'message': f'Joined room for user {user_id}'})

@socketio.on('send_message')
def handle_send_message(data):
    token = data.get('token')  # Assume frontend sends an auth token
    sender = verify_token(token)
    if not sender:
        emit('error', {'error': 'Unauthorized'})
        return

    recipient_id = data.get('recipient_id')
    content = data.get('content')
    thread_id = data.get('thread_id') or str(uuid.uuid4())
    attachments = data.get('attachments', [])

    if not recipient_id or not content:
        emit('error', {'error': 'Missing recipient or content'})
        return

    msg = Message(
        sender_id=sender.id,
        recipient_id=recipient_id,
        content=content,
        thread_id=thread_id,
        attachments=attachments,
        created_at=datetime.utcnow()
    )
    db.session.add(msg)
    db.session.commit()

    message_data = msg.to_dict()

    # Emit to recipient room
    emit('new_message', message_data, room=str(recipient_id))
    # Emit to sender for confirmation
    emit('message_sent', message_data, room=str(sender.id))
