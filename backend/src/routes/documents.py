from flask import Blueprint, jsonify, request, session, send_file, current_app
from src.models.user import User, Document, DocumentAccess, db
from datetime import datetime
import os
import uuid
from werkzeug.utils import secure_filename

documents_bp = Blueprint('documents', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'jpg', 'jpeg', 'png'}

def require_auth():
    user_id = session.get('user_id')
    if not user_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    
    user = User.query.get(user_id)
    if not user:
        return None, jsonify({'error': 'User not found'}), 404
    
    return user, None, None

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def generate_unique_filename(original_filename):
    """Generate a unique filename while preserving the extension"""
    name, ext = os.path.splitext(secure_filename(original_filename))
    unique_id = str(uuid.uuid4())[:8]
    return f"{name}_{unique_id}{ext}"

@documents_bp.route('/', methods=['GET'])
def get_documents():
    """Get user's documents with filtering options"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        document_type = request.args.get('document_type')
        access_level = request.args.get('access_level')
        
        query = Document.query.filter_by(owner_id=user.id)
        
        if document_type:
            query = query.filter_by(document_type=document_type)
        
        if access_level:
            query = query.filter_by(access_level=access_level)
        
        documents = query.order_by(Document.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        result = []
        for doc in documents.items:
            doc_data = doc.to_dict()
            result.append(doc_data)
        
        return jsonify({
            'documents': result,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': documents.total,
                'pages': documents.pages,
                'has_next': documents.has_next,
                'has_prev': documents.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/upload', methods=['POST'])
def upload_document():
    """Upload a new document"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
        # Get form data
        document_type = request.form.get('document_type', 'other')
        description = request.form.get('description', '')
        access_level = request.form.get('access_level', 'private')
        
        # Validate access level
        if access_level not in ['private', 'members', 'public']:
            return jsonify({'error': 'Invalid access level'}), 400
        
        # Generate unique filename
        original_filename = file.filename
        unique_filename = generate_unique_filename(original_filename)
        
        # Save file
        upload_folder = current_app.config['UPLOAD_FOLDER']
        file_path = os.path.join(upload_folder, unique_filename)
        file.save(file_path)
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Get file type
        file_type = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''
        
        # Create document record
        document = Document(
            owner_id=user.id,
            filename=unique_filename,
            original_filename=original_filename,
            file_path=file_path,
            file_size=file_size,
            file_type=file_type,
            document_type=document_type,
            description=description,
            access_level=access_level
        )
        
        db.session.add(document)
        db.session.commit()
        
        return jsonify({
            'message': 'Document uploaded successfully',
            'document': document.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/<int:document_id>', methods=['GET'])
def get_document_details(document_id):
    """Get document details"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        document = Document.query.get(document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Check access permissions
        if not can_access_document(user, document):
            return jsonify({'error': 'Access denied'}), 403
        
        doc_data = document.to_dict()
        
        # Include access grants if user is the owner
        if document.owner_id == user.id:
            doc_data['access_grants'] = [
                access.to_dict() for access in document.access_grants
            ]
        
        return jsonify({'document': doc_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/<int:document_id>/download', methods=['GET'])
def download_document(document_id):
    """Download a document"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        document = Document.query.get(document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Check access permissions
        if not can_access_document(user, document):
            return jsonify({'error': 'Access denied'}), 403
        
        # Check if file exists
        if not os.path.exists(document.file_path):
            return jsonify({'error': 'File not found on server'}), 404
        
        # Increment download count
        document.download_count += 1
        db.session.commit()
        
        return send_file(
            document.file_path,
            as_attachment=True,
            download_name=document.original_filename
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/<int:document_id>', methods=['PUT'])
def update_document(document_id):
    """Update document metadata"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        document = Document.query.get(document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Only owner can update document
        if document.owner_id != user.id:
            return jsonify({'error': 'Only document owner can update'}), 403
        
        data = request.json
        
        # Update allowed fields
        updateable_fields = ['document_type', 'description', 'access_level']
        for field in updateable_fields:
            if field in data:
                if field == 'access_level' and data[field] not in ['private', 'members', 'public']:
                    return jsonify({'error': 'Invalid access level'}), 400
                setattr(document, field, data[field])
        
        document.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Document updated successfully',
            'document': document.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/<int:document_id>', methods=['DELETE'])
def delete_document(document_id):
    """Delete a document"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        document = Document.query.get(document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Only owner can delete document
        if document.owner_id != user.id:
            return jsonify({'error': 'Only document owner can delete'}), 403
        
        # Delete file from filesystem
        if os.path.exists(document.file_path):
            os.remove(document.file_path)
        
        # Delete database record (cascades to access grants)
        db.session.delete(document)
        db.session.commit()
        
        return jsonify({'message': 'Document deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/<int:document_id>/grant-access', methods=['POST'])
def grant_document_access(document_id):
    """Grant access to a document"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        document = Document.query.get(document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Only owner can grant access
        if document.owner_id != user.id:
            return jsonify({'error': 'Only document owner can grant access'}), 403
        
        data = request.json
        target_user_id = data.get('user_id')
        access_type = data.get('access_type', 'view')
        expires_at = data.get('expires_at')
        
        if not target_user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        if access_type not in ['view', 'download', 'edit']:
            return jsonify({'error': 'Invalid access type'}), 400
        
        # Check if target user exists
        target_user = User.query.get(target_user_id)
        if not target_user:
            return jsonify({'error': 'Target user not found'}), 404
        
        # Check if access already exists
        existing_access = DocumentAccess.query.filter_by(
            document_id=document_id,
            user_id=target_user_id
        ).first()
        
        if existing_access:
            # Update existing access
            existing_access.access_type = access_type
            existing_access.granted_at = datetime.utcnow()
            existing_access.is_active = True
            if expires_at:
                existing_access.expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            access_grant = existing_access
        else:
            # Create new access grant
            access_grant = DocumentAccess(
                document_id=document_id,
                user_id=target_user_id,
                access_type=access_type,
                granted_by=user.id
            )
            
            if expires_at:
                access_grant.expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            
            db.session.add(access_grant)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Access granted successfully',
            'access_grant': access_grant.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/<int:document_id>/revoke-access/<uuid:user_id>', methods=['DELETE'])
def revoke_document_access(document_id, user_id):
    """Revoke access to a document"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        document = Document.query.get(document_id)
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Only owner can revoke access
        if document.owner_id != user.id:
            return jsonify({'error': 'Only document owner can revoke access'}), 403
        
        access_grant = DocumentAccess.query.filter_by(
            document_id=document_id,
            user_id=user_id
        ).first()
        
        if not access_grant:
            return jsonify({'error': 'Access grant not found'}), 404
        
        access_grant.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'Access revoked successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/shared-with-me', methods=['GET'])
def get_shared_documents():
    """Get documents shared with the current user"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        
        # Get documents shared with user through access grants
        shared_docs = db.session.query(Document).join(DocumentAccess).filter(
            DocumentAccess.user_id == user.id,
            DocumentAccess.is_active == True
        ).order_by(DocumentAccess.granted_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        result = []
        for doc in shared_docs.items:
            doc_data = doc.to_dict()
            # Include access information
            access_grant = DocumentAccess.query.filter_by(
                document_id=doc.id,
                user_id=user.id,
                is_active=True
            ).first()
            if access_grant:
                doc_data['access_info'] = access_grant.to_dict()
            result.append(doc_data)
        
        return jsonify({
            'documents': result,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': shared_docs.total,
                'pages': shared_docs.pages,
                'has_next': shared_docs.has_next,
                'has_prev': shared_docs.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/types', methods=['GET'])
def get_document_types():
    """Get available document types"""
    document_types = [
        {'value': 'pitch_deck', 'label': 'Pitch Deck'},
        {'value': 'financial_statement', 'label': 'Financial Statement'},
        {'value': 'business_plan', 'label': 'Business Plan'},
        {'value': 'legal_document', 'label': 'Legal Document'},
        {'value': 'market_research', 'label': 'Market Research'},
        {'value': 'product_demo', 'label': 'Product Demo'},
        {'value': 'team_info', 'label': 'Team Information'},
        {'value': 'other', 'label': 'Other'}
    ]
    
    return jsonify({'document_types': document_types}), 200

def can_access_document(user, document):
    """Check if user can access a document"""
    # Owner can always access
    if document.owner_id == user.id:
        return True
    
    # Check public access
    if document.access_level == 'public':
        return True
    
    # Check members access
    if document.access_level == 'members' and user.subscription_tier != 'free':
        return True
    
    # Check explicit access grants
    access_grant = DocumentAccess.query.filter_by(
        document_id=document.id,
        user_id=user.id,
        is_active=True
    ).first()
    
    if access_grant:
        # Check if access has expired
        if access_grant.expires_at and access_grant.expires_at <= datetime.utcnow():
            return False
        return True
    
    return False

