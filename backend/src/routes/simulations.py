from flask import Blueprint, jsonify, request
import os, requests, random
from datetime import datetime
from src.extensions import db
from src.models.user import (
    User, Enterprise, EnterpriseUser,
    InvestorProfile, StartupProfile, SimulationParameters,
    InvestorSimulation, StartupSimulation
)

sims_bp = Blueprint("simulations", __name__)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# ---------- Auth & membership ----------
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

def _my_investor_profile_ids(user_id):
    # investor profile attached to investor enterprises the user belongs to
    eids = [eu.enterprise_id for eu in EnterpriseUser.query.filter_by(user_id=user_id, is_active=True).all()]
    profs = InvestorProfile.query.filter(InvestorProfile.enterprise_id.in_(eids)).all()
    return [p.id for p in profs]

def _my_startup_profile_ids(user_id):
    eids = [eu.enterprise_id for eu in EnterpriseUser.query.filter_by(user_id=user_id, is_active=True).all()]
    profs = StartupProfile.query.filter(StartupProfile.enterprise_id.in_(eids)).all()
    return [p.id for p in profs]

# ---------- Parameters ----------
@sims_bp.route("/simulations/parameters", methods=["GET"])
def list_sim_parameters():
    _, _, err = require_auth()
    if err: return err
    rows = SimulationParameters.query.filter_by(is_active=True).order_by(SimulationParameters.name.asc()).all()
    return jsonify([{
        "id": str(r.id),
        "name": r.name,
        "parameter_type": r.parameter_type,
        "default_values": r.default_values or {},
        "constraints": r.constraints or {},
        "description": r.description
    } for r in rows]), 200

# ---------- Investor simulations ----------
@sims_bp.route("/simulations/investor", methods=["GET"])
def my_investor_sims():
    user, _, err = require_auth()
    if err: return err
    pids = _my_investor_profile_ids(user.id)
    rows = InvestorSimulation.query.filter(InvestorSimulation.investor_profile_id.in_(pids)).order_by(InvestorSimulation.run_date.desc()).all()
    return jsonify([_sim_inv_to_dict(r) for r in rows]), 200

@sims_bp.route("/simulations/investor", methods=["POST"])
def create_investor_sim():
    user, _, err = require_auth()
    if err: return err
    data = request.get_json() or {}
    investor_profile_id = data.get("investor_profile_id")
    parameter_id = data.get("parameter_id")
    if not investor_profile_id or not parameter_id:
        return jsonify({"error":"investor_profile_id and parameter_id are required"}), 400
    if investor_profile_id not in _my_investor_profile_ids(user.id):
        return jsonify({"error":"Not authorized for this investor profile"}), 403

    row = InvestorSimulation(
        investor_profile_id=investor_profile_id,
        startup_enterprise_id=data.get("startup_enterprise_id"),
        parameter_id=parameter_id,
        simulation_name=data.get("simulation_name"),
        input_parameters=data.get("input_parameters") or {},
        simulation_config=data.get("simulation_config") or {},
        iterations=int(data.get("iterations", 10000)),
        status="running",
        created_by=user.id,
        run_date=datetime.utcnow(),
    )
    db.session.add(row)
    db.session.commit()

    # --- demo compute (stub) ---
    # Replace with your background worker; here we “complete” immediately with fake results.
    row.results = {"percentile_returns": {"p50": 1.6, "p10": 0.7, "p90": 3.8}}
    row.expected_return = 0.18
    row.risk_score = 0.32
    row.confidence_interval = {"lo": 0.12, "hi": 0.24}
    row.status = "completed"
    row.completion_date = datetime.utcnow()
    db.session.commit()

    return jsonify(_sim_inv_to_dict(row)), 201

@sims_bp.route("/simulations/investor/<uuid:sim_id>", methods=["GET"])
def get_investor_sim(sim_id):
    user, _, err = require_auth()
    if err: return err
    row = InvestorSimulation.query.get(sim_id)
    if not row or row.investor_profile_id not in _my_investor_profile_ids(user.id):
        return jsonify({"error":"Not found or unauthorized"}), 404
    return jsonify(_sim_inv_to_dict(row)), 200

def _sim_inv_to_dict(r: InvestorSimulation):
    return {
        "id": str(r.id),
        "investor_profile_id": str(r.investor_profile_id),
        "startup_enterprise_id": str(r.startup_enterprise_id) if r.startup_enterprise_id else None,
        "parameter_id": str(r.parameter_id),
        "simulation_name": r.simulation_name,
        "input_parameters": r.input_parameters or {},
        "simulation_config": r.simulation_config or {},
        "results": r.results or {},
        "expected_return": float(r.expected_return or 0),
        "risk_score": float(r.risk_score or 0),
        "confidence_interval": r.confidence_interval or {},
        "iterations": r.iterations,
        "status": r.status,
        "run_date": r.run_date.isoformat() if r.run_date else None,
        "completion_date": r.completion_date.isoformat() if r.completion_date else None,
        "created_by": str(r.created_by) if r.created_by else None,
    }

# ---------- Startup simulations ----------
@sims_bp.route("/simulations/startup", methods=["GET"])
def my_startup_sims():
    user, _, err = require_auth()
    if err: return err
    pids = _my_startup_profile_ids(user.id)
    rows = StartupSimulation.query.filter(StartupSimulation.startup_profile_id.in_(pids)).order_by(StartupSimulation.run_date.desc()).all()
    return jsonify([_sim_st_to_dict(r) for r in rows]), 200

@sims_bp.route("/simulations/startup", methods=["POST"])
def create_startup_sim():
    user, _, err = require_auth()
    if err: return err
    data = request.get_json() or {}
    startup_profile_id = data.get("startup_profile_id")
    parameter_id = data.get("parameter_id")
    if not startup_profile_id or not parameter_id:
        return jsonify({"error":"startup_profile_id and parameter_id are required"}), 400
    if startup_profile_id not in _my_startup_profile_ids(user.id):
        return jsonify({"error":"Not authorized for this startup profile"}), 403

    row = StartupSimulation(
        startup_profile_id=startup_profile_id,
        parameter_id=parameter_id,
        simulation_name=data.get("simulation_name"),
        input_parameters=data.get("input_parameters") or {},
        simulation_config=data.get("simulation_config") or {},
        iterations=int(data.get("iterations", 10000)),
        status="running",
        created_by=user.id,
        run_date=datetime.utcnow(),
    )
    db.session.add(row)
    db.session.commit()

    # --- demo compute (stub) ---
    row.growth_projections = {"12m_revenue": 1200000}
    row.market_scenarios = {"bear": 0.2, "base": 0.5, "bull": 0.3}
    row.financial_projections = {"runway_months": 18}
    row.success_probability = 0.37
    row.valuation_range = {"lo": 8000000, "hi": 15000000}
    row.status = "completed"
    row.completion_date = datetime.utcnow()
    db.session.commit()

    return jsonify(_sim_st_to_dict(row)), 201

@sims_bp.route("/simulations/startup/<uuid:sim_id>", methods=["GET"])
def get_startup_sim(sim_id):
    user, _, err = require_auth()
    if err: return err
    row = StartupSimulation.query.get(sim_id)
    if not row or row.startup_profile_id not in _my_startup_profile_ids(user.id):
        return jsonify({"error":"Not found or unauthorized"}), 404
    return jsonify(_sim_st_to_dict(row)), 200

def _sim_st_to_dict(r: StartupSimulation):
    return {
        "id": str(r.id),
        "startup_profile_id": str(r.startup_profile_id),
        "parameter_id": str(r.parameter_id),
        "simulation_name": r.simulation_name,
        "input_parameters": r.input_parameters or {},
        "simulation_config": r.simulation_config or {},
        "growth_projections": r.growth_projections or {},
        "market_scenarios": r.market_scenarios or {},
        "financial_projections": r.financial_projections or {},
        "success_probability": float(r.success_probability or 0),
        "valuation_range": r.valuation_range or {},
        "iterations": r.iterations,
        "status": r.status,
        "run_date": r.run_date.isoformat() if r.run_date else None,
        "completion_date": r.completion_date.isoformat() if r.completion_date else None,
        "created_by": str(r.created_by) if r.created_by else None,
    }