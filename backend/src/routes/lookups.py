# src/routes/lookups.py
from flask import Blueprint, jsonify, request
from src.extensions import db
from src.models.user import Industry, Stage, GeographicArea

lookups_bp = Blueprint("lookups", __name__)

@lookups_bp.route("/lookups/industries", methods=["GET"])
def list_industries():
    is_active = request.args.get("active", "true").lower() != "false"
    q = Industry.query
    if is_active:
        q = q.filter(Industry.is_active.is_(True))
    rows = q.order_by(Industry.name.asc()).all()
    return jsonify([{
        "id": str(r.id),
        "name": r.name,
        "description": r.description,
        "category": r.category,
        "is_active": r.is_active
    } for r in rows]), 200

@lookups_bp.route("/lookups/stages", methods=["GET"])
def list_stages():
    stage_type = request.args.get("type")  # startup|investor|both (optional)
    is_active = request.args.get("active", "true").lower() != "false"
    q = Stage.query
    if stage_type:
        q = q.filter(Stage.stage_type == stage_type)
    if is_active:
        q = q.filter(Stage.is_active.is_(True))
    rows = q.order_by(Stage.order_sequence.asc()).all()
    return jsonify([{
        "id": str(r.id),
        "name": r.name,
        "description": r.description,
        "stage_type": r.stage_type,
        "order_sequence": r.order_sequence,
        "is_active": r.is_active
    } for r in rows]), 200

# NEW (optional)
@lookups_bp.route("/lookups/geographies", methods=["GET"])
def list_geographies():
    q = db.session.query(GeographicArea)
    search = (request.args.get("q") or "").strip()
    if search:
        q = q.filter(GeographicArea.name.ilike(f"%{search}%"))
    rows = q.order_by(GeographicArea.name.asc()).limit(200).all()
    return jsonify([{"id": str(r.id), "name": r.name} for r in rows]), 200