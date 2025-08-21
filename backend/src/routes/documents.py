# src/routes/documents.py

from datetime import datetime, timedelta
import io
import os
import uuid
import zipfile
from urllib.parse import urlparse

import boto3
from botocore.exceptions import ClientError
import requests
from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename
from sqlalchemy import func, and_

from src.extensions import db
from src.models.user import (
    User,
    Document,
    SecuredAccess,
    Enterprise,
    EnterpriseUser,
)

documents_bp = Blueprint("documents", __name__)

# --------------------------------------------------
# Config
# --------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

S3_BUCKET = os.getenv("S3_BUCKET")
S3_REGION = os.getenv("S3_REGION")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")

s3_client = boto3.client(
    "s3",
    region_name=S3_REGION,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
)

# --------------------------------------------------
# Helpers (auth / perms / utils)
# --------------------------------------------------
def _require_bearer_token():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, jsonify({"error": "Missing or invalid Authorization header"}), 401
    return auth_header.split(" ")[1], None, None


def _fetch_supabase_user(token: str):
    return requests.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
        timeout=15,
    )


def _require_auth_user():
    token, err, code = _require_bearer_token()
    if err:
        return None, err, code
    resp = _fetch_supabase_user(token)
    if resp.status_code != 200:
        return None, jsonify({"error": "Invalid or expired token"}), 401
    supa = resp.json()
    user = User.query.get(supa["id"])
    if not user:
        return None, jsonify({"error": "User not found"}), 404
    return user, None, None


def _user_enterprise_ids(user: User):
    return [
        m.enterprise_id
        for m in user.enterprise_memberships
        if getattr(m, "is_active", True)
    ]


def _can_access_document(user: User, doc: Document) -> bool:
    """
    Access rules:
      - public: anyone authenticated
      - owner (uploaded_by): full access
      - enterprise: any active member of the same enterprise
      - confidential/private: explicit SecuredAccess grant
    """
    if doc.is_public or (doc.access_level or "private") == "public":
        return True

    if doc.uploaded_by == user.id:
        return True

    if (doc.access_level or "private") == "enterprise" and doc.enterprise_id:
        if doc.enterprise_id in _user_enterprise_ids(user):
            return True

    # explicit grant
    grant = SecuredAccess.query.filter(
        SecuredAccess.user_id == user.id,
        SecuredAccess.resource_type == "document",
        SecuredAccess.resource_id == doc.id,
        SecuredAccess.is_active.is_(True),
        # not expired
        (SecuredAccess.expires_date.is_(None)) | (SecuredAccess.expires_date > datetime.utcnow()),
    ).first()
    return grant is not None


def _must_be_owner(user: User, doc: Document) -> bool:
    return doc.uploaded_by == user.id


def _is_admin_like(user: User) -> bool:
    """Treat org owners/admins as 'admins' for admin endpoints."""
    exists = (
        db.session.query(EnterpriseUser.id)
        .filter(
            EnterpriseUser.user_id == user.id,
            EnterpriseUser.is_active.is_(True),
            EnterpriseUser.role.in_(["owner", "admin"]),
        )
        .first()
    )
    return exists is not None


def _serialize_document(doc: Document):
    return {
        "id": str(doc.id),
        "enterprise_id": str(doc.enterprise_id) if doc.enterprise_id else None,
        "uploaded_by": str(doc.uploaded_by) if doc.uploaded_by else None,
        "title": doc.title,
        "document_type": doc.document_type,
        "file_path": doc.file_path,
        "file_name": doc.file_name,
        "file_size": doc.file_size,
        "mime_type": doc.mime_type,
        "version_number": doc.version_number,
        "is_public": bool(doc.is_public),
        "access_level": doc.access_level,
        "description": doc.description,
        "tags": doc.tags or [],
        "download_count": doc.download_count or 0,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        "last_accessed_at": doc.last_accessed_at.isoformat() if doc.last_accessed_at else None,
        "expires_at": doc.expires_at.isoformat() if doc.expires_at else None,
    }


def _s3_key_from_url(url: str) -> str:
    """
    Extract the key after *.amazonaws.com/
    Works for both https://<bucket>.s3.<region>.amazonaws.com/<key>
    and https://<bucket>.s3.amazonaws.com/<key>
    """
    if not url:
        return ""
    try:
        parsed = urlparse(url)
        # everything after the first slash in path is the key
        path = parsed.path.lstrip("/")
        return path
    except Exception:
        # fallback: try to split manually
        if ".amazonaws.com/" in url:
            return url.split(".amazonaws.com/")[1]
        return url


def _send_email(to, subject, body):
    # stub – integrate with your email service
    print(f"[EMAIL] To: {to} | Subject: {subject} | Body: {body}")


# --------------------------------------------------
# Routes
# --------------------------------------------------
@documents_bp.route("/upload", methods=["POST"])
def upload_document():
    """
    Multipart form-data:
      file: <File>
      title (optional) -> defaults to filename
      document_type (optional) -> defaults 'other'
      enterprise_id (optional UUID)
      access_level (optional) -> public | enterprise | private | confidential (default private)
      tags (optional, repeatable): tags=foo&tags=bar
    """
    user, err, code = _require_auth_user()
    if err:
        return err, code

    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file provided"}), 400

    filename = secure_filename(file.filename or "")
    if not filename:
        return jsonify({"error": "Invalid filename"}), 400

    title = request.form.get("title") or filename
    document_type = request.form.get("document_type") or "other"
    access_level = (request.form.get("access_level") or "private").lower()
    if access_level not in ("public", "enterprise", "private", "confidential"):
        return jsonify({"error": "Invalid access_level"}), 400

    enterprise_id = request.form.get("enterprise_id")
    enterprise_uuid = None
    if enterprise_id:
        try:
            enterprise_uuid = uuid.UUID(enterprise_id)
        except ValueError:
            return jsonify({"error": "Invalid enterprise_id"}), 400

    tags = request.form.getlist("tags") or []

    # S3 key convention
    file_id = str(uuid.uuid4())
    s3_key = f"documents/{user.id}/{file_id}/{filename}"

    try:
        extra = {"ContentType": file.mimetype} if file.mimetype else {}
        s3_client.upload_fileobj(file, S3_BUCKET, s3_key, ExtraArgs=extra)
        file_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"

        doc = Document(
            enterprise_id=enterprise_uuid,
            uploaded_by=user.id,
            title=title,
            document_type=document_type,
            file_path=file_url,
            file_name=filename,
            file_size=request.content_length,  # may be None; optional
            mime_type=file.mimetype,
            access_level=access_level,
            tags=tags,
            is_public=(access_level == "public"),
        )
        db.session.add(doc)
        db.session.commit()

        return jsonify({"message": "Upload successful", "document": _serialize_document(doc)}), 201
    except ClientError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@documents_bp.route("/bulk-upload", methods=["POST"])
def bulk_upload():
    """
    Multipart form-data:
      files: multiple files (files)
      enterprise_id (optional)
      access_level (optional, default private)
      document_type (optional, default 'other')
      tags (optional, repeatable)
    """
    user, err, code = _require_auth_user()
    if err:
        return err, code

    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "No files provided"}), 400

    access_level = (request.form.get("access_level") or "private").lower()
    if access_level not in ("public", "enterprise", "private", "confidential"):
        return jsonify({"error": "Invalid access_level"}), 400

    document_type = request.form.get("document_type") or "other"
    enterprise_id = request.form.get("enterprise_id")
    tags = request.form.getlist("tags") or []

    enterprise_uuid = None
    if enterprise_id:
        try:
            enterprise_uuid = uuid.UUID(enterprise_id)
        except ValueError:
            return jsonify({"error": "Invalid enterprise_id"}), 400

    uploaded_docs = []
    try:
        for f in files:
            filename = secure_filename(f.filename or "")
            if not filename:
                continue
            file_id = str(uuid.uuid4())
            s3_key = f"documents/{user.id}/{file_id}/{filename}"
            extra = {"ContentType": f.mimetype} if f.mimetype else {}
            try:
                s3_client.upload_fileobj(f, S3_BUCKET, s3_key, ExtraArgs=extra)
                file_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
            except ClientError:
                continue

            doc = Document(
                enterprise_id=enterprise_uuid,
                uploaded_by=user.id,
                title=filename,
                document_type=document_type,
                file_path=file_url,
                file_name=filename,
                mime_type=f.mimetype,
                access_level=access_level,
                tags=tags,
                is_public=(access_level == "public"),
            )
            db.session.add(doc)
            uploaded_docs.append(doc)

        db.session.commit()
        return jsonify(
            {
                "message": f"{len(uploaded_docs)} files uploaded",
                "documents": [_serialize_document(d) for d in uploaded_docs],
            }
        ), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@documents_bp.route("/bulk-download", methods=["POST"])
def bulk_download():
    """
    JSON body:
      { "document_ids": ["uuid", ...] }
    Returns a ZIP with the requested documents the user is allowed to access.
    """
    user, err, code = _require_auth_user()
    if err:
        return err, code

    ids = request.json.get("document_ids", []) if request.is_json else []
    if not ids:
        return jsonify({"error": "document_ids is required"}), 400

    # Validate UUIDs
    doc_ids = []
    for _id in ids:
        try:
            doc_ids.append(uuid.UUID(_id))
        except Exception:
            return jsonify({"error": f"Invalid document id: {_id}"}), 400

    docs = Document.query.filter(Document.id.in_(doc_ids)).all()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zipf:
        for doc in docs:
            if not _can_access_document(user, doc):
                continue
            key = _s3_key_from_url(doc.file_path)
            try:
                obj = s3_client.get_object(Bucket=S3_BUCKET, Key=key)
                content = obj["Body"].read()
                zipf.writestr(doc.file_name or f"{doc.id}", content)
                # update stats
                doc.download_count = (doc.download_count or 0) + 1
                doc.last_accessed_at = datetime.utcnow()
            except ClientError:
                continue

    db.session.commit()  # persist download_count/last_accessed_at
    buf.seek(0)
    return send_file(buf, download_name="documents.zip", as_attachment=True, mimetype="application/zip")


@documents_bp.route("/grant-access/<uuid:doc_id>", methods=["POST"])
def grant_document_access(doc_id):
    """
    JSON body:
      {
        "user_id": "<uuid>",            # required
        "access_level": "read|write|admin|owner",  # default 'read'
        "expires_in_minutes": 60        # optional
      }
    Uses SecuredAccess with resource_type='document'.
    """
    user, err, code = _require_auth_user()
    if err:
        return err, code

    doc = Document.query.get(doc_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404

    if not _must_be_owner(user, doc):
        return jsonify({"error": "Not authorized (only uploader can grant access)"}), 403

    data = request.get_json() or {}
    target_user_id = data.get("user_id")
    if not target_user_id:
        return jsonify({"error": "user_id is required"}), 400
    try:
        target_uuid = uuid.UUID(target_user_id)
    except ValueError:
        return jsonify({"error": "Invalid user_id"}), 400

    access_level = (data.get("access_level") or "read").lower()
    if access_level not in ("read", "write", "admin", "owner"):
        return jsonify({"error": "Invalid access_level"}), 400

    expires_in = data.get("expires_in_minutes")
    expires_at = None
    if expires_in is not None:
        try:
            expires_at = datetime.utcnow() + timedelta(minutes=int(expires_in))
        except Exception:
            return jsonify({"error": "expires_in_minutes must be an integer"}), 400

    grant = SecuredAccess.query.filter_by(
        user_id=target_uuid,
        resource_type="document",
        resource_id=doc.id,
    ).first()

    if not grant:
        grant = SecuredAccess(
            user_id=target_uuid,
            resource_type="document",
            resource_id=doc.id,
            access_level=access_level,
            expires_date=expires_at,
            is_active=True,
        )
        db.session.add(grant)
    else:
        grant.access_level = access_level
        grant.expires_date = expires_at
        grant.is_active = True

    db.session.commit()

    target_user = User.query.get(target_uuid)
    if target_user and target_user.email:
        _send_email(
            to=target_user.email,
            subject="You've been granted document access",
            body=f"You now have {access_level} access to '{doc.title or doc.file_name}'.",
        )

    return jsonify({"message": "Access granted"}), 200


@documents_bp.route("/revoke-access/<uuid:doc_id>/<uuid:target_user_id>", methods=["DELETE"])
def revoke_access(doc_id, target_user_id):
    user, err, code = _require_auth_user()
    if err:
        return err, code

    doc = Document.query.get(doc_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404

    if not _must_be_owner(user, doc):
        return jsonify({"error": "Not authorized"}), 403

    grant = SecuredAccess.query.filter_by(
        user_id=target_user_id,
        resource_type="document",
        resource_id=doc.id,
    ).first()

    if not grant:
        return jsonify({"error": "Access not found"}), 404

    db.session.delete(grant)
    db.session.commit()
    return jsonify({"message": "Access revoked"}), 200


@documents_bp.route("/admin/shared-documents", methods=["GET"])
def admin_shared_documents():
    """
    Lists all SecuredAccess entries for documents.
    Requires the caller to have at least one active membership with role in ('owner', 'admin').
    """
    user, err, code = _require_auth_user()
    if err:
        return err, code

    if not _is_admin_like(user):
        return jsonify({"error": "Admin access required"}), 403

    grants = (
        SecuredAccess.query.filter_by(resource_type="document")
        .order_by(SecuredAccess.granted_date.desc())
        .all()
    )

    results = []
    for g in grants:
        doc = Document.query.get(g.resource_id)
        u = User.query.get(g.user_id)
        if not doc or not u:
            continue
        results.append(
            {
                "document": _serialize_document(doc),
                "granted_to": {
                    "id": str(u.id),
                    "email": u.email,
                    "name": f"{u.first_name} {u.last_name}".strip(),
                },
                "access_level": g.access_level,
                "granted_at": g.granted_date.isoformat() if g.granted_date else None,
                "expires_at": g.expires_date.isoformat() if g.expires_date else None,
                "is_active": bool(g.is_active),
            }
        )

    return jsonify({"shared_documents": results}), 200