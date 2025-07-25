from flask import Blueprint, request, jsonify, session, send_file, zip_response
from werkzeug.utils import secure_filename
from src.models.user import db, User, Document, DocumentAccess
from datetime import datetime, timedelta
import os
import uuid
import boto3
from botocore.exceptions import ClientError
import zipfile
import io

documents_bp = Blueprint('documents', __name__)

# ---- Utility Functions ----

def require_auth():
    user_id = session.get('user_id')
    if not user_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    user = User.query.get(user_id)
    if not user:
        return None, jsonify({'error': 'User not found'}), 404
    return user, None, None

def send_email(to, subject, body):
    print(f"[EMAIL] To: {to} | Subject: {subject} | Body: {body}")
    # Integrate with real email system in production

# ---- S3 Config ----

S3_BUCKET = os.getenv("S3_BUCKET")
S3_REGION = os.getenv("S3_REGION")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")

s3_client = boto3.client(
    's3',
    region_name=S3_REGION,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY
)

# ---- Routes ----

@documents_bp.route('/upload', methods=['POST'])
def upload_document():
    user, error_response, status = require_auth()
    if error_response:
        return error_response, status

    file = request.files.get('file')
    tags = request.form.getlist('tags')
    access_level = request.form.get('access_level', 'private')

    if not file:
        return jsonify({'error': 'No file provided'}), 400

    filename = secure_filename(file.filename)
    file_id = str(uuid.uuid4())
    s3_key = f"documents/{file_id}/{filename}"

    try:
        s3_client.upload_fileobj(file, S3_BUCKET, s3_key)
        file_path = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"

        document = Document(
            owner_id=user.id,
            filename=filename,
            file_path=file_path,
            tags=tags,
            access_level=access_level
        )
        db.session.add(document)
        db.session.commit()

        return jsonify({'message': 'Upload successful', 'document': document.to_dict()}), 201

    except ClientError as e:
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/bulk-upload', methods=['POST'])
def bulk_upload():
    user, error_response, status = require_auth()
    if error_response:
        return error_response, status

    files = request.files.getlist('files')
    uploaded = []

    for file in files:
        filename = secure_filename(file.filename)
        file_id = str(uuid.uuid4())
        s3_key = f"documents/{file_id}/{filename}"
        try:
            s3_client.upload_fileobj(file, S3_BUCKET, s3_key)
            file_path = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"

            document = Document(
                owner_id=user.id,
                filename=filename,
                file_path=file_path,
                access_level='private'
            )
            db.session.add(document)
            uploaded.append(document)
        except ClientError:
            continue

    db.session.commit()
    return jsonify({'message': f"{len(uploaded)} files uploaded", 'documents': [d.to_dict() for d in uploaded]}), 201

@documents_bp.route('/bulk-download', methods=['POST'])
def bulk_download():
    user, error_response, status = require_auth()
    if error_response:
        return error_response, status

    ids = request.json.get('document_ids', [])
    docs = Document.query.filter(Document.id.in_(ids), Document.owner_id == user.id).all()

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w') as zipf:
        for doc in docs:
            key = '/'.join(doc.file_path.split('/')[-3:])
            try:
                file_obj = s3_client.get_object(Bucket=S3_BUCKET, Key=key)
                zipf.writestr(doc.filename, file_obj['Body'].read())
            except ClientError:
                continue
    zip_buffer.seek(0)
    return send_file(zip_buffer, download_name='documents.zip', as_attachment=True)

@documents_bp.route('/grant-access/<int:doc_id>', methods=['POST'])
def grant_document_access(doc_id):
    user, error_response, status = require_auth()
    if error_response:
        return error_response, status

    document = Document.query.get(doc_id)
    if not document or document.owner_id != user.id:
        return jsonify({'error': 'Unauthorized or document not found'}), 403

    data = request.json
    target_user_id = data.get('user_id')
    access_type = data.get('access_type', 'view')
    expires_in = data.get('expires_in_minutes')

    if not target_user_id:
        return jsonify({'error': 'Target user required'}), 400

    expiration_time = datetime.utcnow() + timedelta(minutes=expires_in) if expires_in else None

    access = DocumentAccess(
        document_id=doc_id,
        user_id=target_user_id,
        access_type=access_type,
        expires_at=expiration_time
    )
    db.session.add(access)
    db.session.commit()

    target_user = User.query.get(target_user_id)
    if target_user:
        send_email(
            to=target_user.email,
            subject="You've been granted document access",
            body=f"You now have {access_type} access to document '{document.filename}'."
        )

    return jsonify({'message': 'Access granted'}), 200

@documents_bp.route('/revoke-access/<int:doc_id>/<uuid:target_user_id>', methods=['DELETE'])
def revoke_access(doc_id, target_user_id):
    user, error_response, status = require_auth()
    if error_response:
        return error_response, status

    access = DocumentAccess.query.filter_by(document_id=doc_id, user_id=target_user_id).first()
    if not access:
        return jsonify({'error': 'Access not found'}), 404

    document = Document.query.get(doc_id)
    if document.owner_id != user.id:
        return jsonify({'error': 'Not authorized'}), 403

    db.session.delete(access)
    db.session.commit()
    return jsonify({'message': 'Access revoked'}), 200

@documents_bp.route('/admin/shared-documents', methods=['GET'])
def admin_shared_documents():
    user, error_response, status = require_auth()
    if error_response:
        return error_response, status

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    shared = DocumentAccess.query.all()
    data = [{
        'document': access.document.to_dict(),
        'granted_to': access.user.to_summary(),
        'access_type': access.access_type,
        'granted_at': access.granted_at.isoformat(),
        'expires_at': access.expires_at.isoformat() if access.expires_at else None
    } for access in shared]

    return jsonify({'shared_documents': data}), 200
