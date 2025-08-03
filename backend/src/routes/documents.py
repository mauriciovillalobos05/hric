from flask import Blueprint, request, jsonify, session, send_file
from werkzeug.utils import secure_filename
from ..models.user import db, Users, Document, DocumentAccess
from datetime import datetime, timedelta
import os
import uuid
import boto3
from botocore.exceptions import ClientError
import zipfile
import io
import io

def create_zip_response(files_dict):
    """
    Creates a zip file response from a dictionary of {filename: file_content}
    """
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
        for filename, content in files_dict.items():
            zip_file.writestr(filename, content)

    zip_buffer.seek(0)
    return send_file(zip_buffer, mimetype='application/zip', as_attachment=True, download_name='files.zip')

documents_bp = Blueprint('documents', __name__)

# ---- Utility Functions ----

def require_auth():
    Users_id = session.get('Users_id')
    if not Users_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    Users = Users.query.get(Users_id)
    if not Users:
        return None, jsonify({'error': 'Users not found'}), 404
    return Users, None, None

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
    Users, error_response, status = require_auth()
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
            owner_id=Users.id,
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
    Users, error_response, status = require_auth()
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
                owner_id=Users.id,
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
    Users, error_response, status = require_auth()
    if error_response:
        return error_response, status

    ids = request.json.get('document_ids', [])
    docs = Document.query.filter(Document.id.in_(ids), Document.owner_id == Users.id).all()

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
    Users, error_response, status = require_auth()
    if error_response:
        return error_response, status

    document = Document.query.get(doc_id)
    if not document or document.owner_id != Users.id:
        return jsonify({'error': 'Unauthorized or document not found'}), 403

    data = request.json
    target_Users_id = data.get('Users_id')
    access_type = data.get('access_type', 'view')
    expires_in = data.get('expires_in_minutes')

    if not target_Users_id:
        return jsonify({'error': 'Target Users required'}), 400

    expiration_time = datetime.utcnow() + timedelta(minutes=expires_in) if expires_in else None

    access = DocumentAccess(
        document_id=doc_id,
        Users_id=target_Users_id,
        access_type=access_type,
        expires_at=expiration_time
    )
    db.session.add(access)
    db.session.commit()

    target_Users = Users.query.get(target_Users_id)
    if target_Users:
        send_email(
            to=target_Users.email,
            subject="You've been granted document access",
            body=f"You now have {access_type} access to document '{document.filename}'."
        )

    return jsonify({'message': 'Access granted'}), 200

@documents_bp.route('/revoke-access/<int:doc_id>/<uuid:target_Users_id>', methods=['DELETE'])
def revoke_access(doc_id, target_Users_id):
    Users, error_response, status = require_auth()
    if error_response:
        return error_response, status

    access = DocumentAccess.query.filter_by(document_id=doc_id, Users_id=target_Users_id).first()
    if not access:
        return jsonify({'error': 'Access not found'}), 404

    document = Document.query.get(doc_id)
    if document.owner_id != Users.id:
        return jsonify({'error': 'Not authorized'}), 403

    db.session.delete(access)
    db.session.commit()
    return jsonify({'message': 'Access revoked'}), 200

@documents_bp.route('/admin/shared-documents', methods=['GET'])
def admin_shared_documents():
    Users, error_response, status = require_auth()
    if error_response:
        return error_response, status

    if Users.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    shared = DocumentAccess.query.all()
    data = [{
        'document': access.document.to_dict(),
        'granted_to': access.Users.to_summary(),
        'access_type': access.access_type,
        'granted_at': access.granted_at.isoformat(),
        'expires_at': access.expires_at.isoformat() if access.expires_at else None
    } for access in shared]

    return jsonify({'shared_documents': data}), 200
