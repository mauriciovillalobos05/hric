from flask import Blueprint, jsonify, request
import os, requests
from datetime import date
from decimal import Decimal
from sqlalchemy import func
from src.extensions import db
from src.models.user import (
    User, Enterprise, EnterpriseUser,
    VirtualPortfolio, VirtualPortfolioItem
)

vp_bp = Blueprint("virtual_portfolios", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# ---------- Auth ----------
def require_auth():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, None, (jsonify({"error":"Missing or invalid Authorization header"}), 401)
    token = auth_header.split(" ")[1]
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
            timeout=15
        )
        if resp.status_code != 200:
            return None, None, (jsonify({"error":"Invalid or expired token"}), 401)
        user_id = resp.json()["id"]
    except Exception as e:
        return None, None, (jsonify({"error": f"Token verification failed: {str(e)}"}), 500)

    user = User.query.get(user_id)
    if not user:
        return None, None, (jsonify({"error":"User not found in database"}), 404)
    return user, token, None

# ---------- Helpers ----------
def _decimal(v):
    if v is None: return None
    try:
        return Decimal(str(v))
    except Exception:
        return None

def _date(v):
    if not v: return None
    try:
        return date.fromisoformat(v[:10])
    except Exception:
        return None

def _recalc_portfolio_totals(portfolio_id):
    """Recalculate total_value and total_investments from items."""
    totals = db.session.query(
        func.coalesce(func.sum(VirtualPortfolioItem.current_valuation), 0),
        func.count(VirtualPortfolioItem.id)
    ).filter(VirtualPortfolioItem.virtual_portfolio_id == portfolio_id).one()
    p = VirtualPortfolio.query.get(portfolio_id)
    if p:
        p.total_value = totals[0]
        p.total_investments = totals[1]
        db.session.commit()

# ---------- Routes ----------
@vp_bp.route("/portfolios", methods=["GET"])
def list_my_portfolios():
    user, _, err = require_auth()
    if err: return err
    rows = VirtualPortfolio.query.filter_by(user_id=user.id).order_by(VirtualPortfolio.created_at.desc()).all()
    return jsonify([{
        "id": str(r.id),
        "name": r.name,
        "description": r.description,
        "portfolio_type": r.portfolio_type,
        "is_public": r.is_public,
        "total_value": float(r.total_value or 0),
        "total_investments": r.total_investments or 0,
        "performance_metrics": r.performance_metrics or {},
        "created_at": r.created_at.isoformat(),
        "updated_at": r.updated_at.isoformat(),
    } for r in rows]), 200

@vp_bp.route("/portfolios", methods=["POST"])
def create_portfolio():
    user, _, err = require_auth()
    if err: return err
    data = request.get_json() or {}
    name = data.get("name")
    if not name:
        return jsonify({"error":"name is required"}), 400
    vp = VirtualPortfolio(
        user_id=user.id,
        name=name,
        description=data.get("description"),
        portfolio_type=data.get("portfolio_type","personal"),
        is_public=bool(data.get("is_public", False)),
        performance_metrics=data.get("performance_metrics") or {}
    )
    db.session.add(vp)
    db.session.commit()
    return jsonify({"id": str(vp.id)}), 201

@vp_bp.route("/portfolios/<uuid:portfolio_id>", methods=["GET"])
def get_portfolio(portfolio_id):
    user, _, err = require_auth()
    if err: return err
    p = VirtualPortfolio.query.get(portfolio_id)
    if not p or p.user_id != user.id:
        return jsonify({"error":"Not found or unauthorized"}), 404
    return jsonify({
        "id": str(p.id),
        "name": p.name,
        "description": p.description,
        "portfolio_type": p.portfolio_type,
        "is_public": p.is_public,
        "total_value": float(p.total_value or 0),
        "total_investments": p.total_investments or 0,
        "performance_metrics": p.performance_metrics or {},
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }), 200

@vp_bp.route("/portfolios/<uuid:portfolio_id>", methods=["PATCH"])
def update_portfolio(portfolio_id):
    user, _, err = require_auth()
    if err: return err
    p = VirtualPortfolio.query.get(portfolio_id)
    if not p or p.user_id != user.id:
        return jsonify({"error":"Not found or unauthorized"}), 404
    data = request.get_json() or {}
    for f in ["name","description","portfolio_type","is_public","performance_metrics"]:
        if f in data:
            setattr(p, f, data[f])
    db.session.commit()
    return jsonify({"message":"updated"}), 200

@vp_bp.route("/portfolios/<uuid:portfolio_id>", methods=["DELETE"])
def delete_portfolio(portfolio_id):
    user, _, err = require_auth()
    if err: return err
    p = VirtualPortfolio.query.get(portfolio_id)
    if not p or p.user_id != user.id:
        return jsonify({"error":"Not found or unauthorized"}), 404
    db.session.delete(p)
    db.session.commit()
    return jsonify({"message":"deleted"}), 200

# ----- Items -----
@vp_bp.route("/portfolios/<uuid:portfolio_id>/items", methods=["GET"])
def list_items(portfolio_id):
    user, _, err = require_auth()
    if err: return err
    p = VirtualPortfolio.query.get(portfolio_id)
    if not p or p.user_id != user.id:
        return jsonify({"error":"Not found or unauthorized"}), 404
    rows = VirtualPortfolioItem.query.filter_by(virtual_portfolio_id=portfolio_id).order_by(VirtualPortfolioItem.added_date.desc()).all()
    return jsonify([{
        "id": str(r.id),
        "startup_enterprise_id": str(r.startup_enterprise_id),
        "investment_amount": float(r.investment_amount or 0),
        "valuation_at_entry": float(r.valuation_at_entry or 0),
        "current_valuation": float(r.current_valuation or 0),
        "shares_owned": r.shares_owned,
        "ownership_percentage": float(r.ownership_percentage or 0),
        "entry_date": r.entry_date.isoformat() if r.entry_date else None,
        "exit_date": r.exit_date.isoformat() if r.exit_date else None,
        "exit_value": float(r.exit_value or 0),
        "return_multiple": float(r.return_multiple or 0),
        "performance_metrics": r.performance_metrics or {},
        "added_date": r.added_date.isoformat() if r.added_date else None,
    } for r in rows]), 200

@vp_bp.route("/portfolios/<uuid:portfolio_id>/items", methods=["POST"])
def add_item(portfolio_id):
    user, _, err = require_auth()
    if err: return err
    p = VirtualPortfolio.query.get(portfolio_id)
    if not p or p.user_id != user.id:
        return jsonify({"error":"Not found or unauthorized"}), 404

    data = request.get_json() or {}
    required = ["startup_enterprise_id","investment_amount","entry_date"]
    missing = [k for k in required if k not in data]
    if missing:
        return jsonify({"error": f"Missing: {', '.join(missing)}"}), 400

    item = VirtualPortfolioItem(
        virtual_portfolio_id=portfolio_id,
        startup_enterprise_id=data["startup_enterprise_id"],
        investment_amount=_decimal(data["investment_amount"]),
        valuation_at_entry=_decimal(data.get("valuation_at_entry")),
        current_valuation=_decimal(data.get("current_valuation")),
        shares_owned=data.get("shares_owned"),
        ownership_percentage=_decimal(data.get("ownership_percentage")),
        entry_date=_date(data["entry_date"]),
        exit_date=_date(data.get("exit_date")),
        exit_value=_decimal(data.get("exit_value")),
        return_multiple=_decimal(data.get("return_multiple")),
        performance_metrics=data.get("performance_metrics") or {},
    )
    db.session.add(item)
    db.session.commit()
    _recalc_portfolio_totals(portfolio_id)
    return jsonify({"id": str(item.id)}), 201

@vp_bp.route("/portfolios/<uuid:portfolio_id>/items/<uuid:item_id>", methods=["PATCH"])
def update_item(portfolio_id, item_id):
    user, _, err = require_auth()
    if err: return err
    p = VirtualPortfolio.query.get(portfolio_id)
    if not p or p.user_id != user.id:
        return jsonify({"error":"Not found or unauthorized"}), 404
    r = VirtualPortfolioItem.query.get(item_id)
    if not r or r.virtual_portfolio_id != p.id:
        return jsonify({"error":"Item not found"}), 404
    data = request.get_json() or {}
    fields = {
        "startup_enterprise_id": "startup_enterprise_id",
        "investment_amount": ("investment_amount", _decimal),
        "valuation_at_entry": ("valuation_at_entry", _decimal),
        "current_valuation": ("current_valuation", _decimal),
        "shares_owned": "shares_owned",
        "ownership_percentage": ("ownership_percentage", _decimal),
        "entry_date": ("entry_date", _date),
        "exit_date": ("exit_date", _date),
        "exit_value": ("exit_value", _decimal),
        "return_multiple": ("return_multiple", _decimal),
        "performance_metrics": "performance_metrics",
    }
    for k, v in fields.items():
        if k in data:
            if isinstance(v, tuple):
                setattr(r, v[0], v[1](data[k]))
            else:
                setattr(r, v, data[k])
    db.session.commit()
    _recalc_portfolio_totals(portfolio_id)
    return jsonify({"message":"updated"}), 200

@vp_bp.route("/portfolios/<uuid:portfolio_id>/items/<uuid:item_id>", methods=["DELETE"])
def delete_item(portfolio_id, item_id):
    user, _, err = require_auth()
    if err: return err
    p = VirtualPortfolio.query.get(portfolio_id)
    if not p or p.user_id != user.id:
        return jsonify({"error":"Not found or unauthorized"}), 404
    r = VirtualPortfolioItem.query.get(item_id)
    if not r or r.virtual_portfolio_id != p.id:
        return jsonify({"error":"Item not found"}), 404
    db.session.delete(r)
    db.session.commit()
    _recalc_portfolio_totals(portfolio_id)
    return jsonify({"message":"deleted"}), 200