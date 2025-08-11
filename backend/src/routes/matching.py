# src/routes/matching.py

from datetime import datetime, timedelta, timezone
import os
import requests

from flask import Blueprint, request, jsonify
from werkzeug.http import http_date, parse_date
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from sqlalchemy.dialects.postgresql import insert
from rapidfuzz import fuzz

from src.extensions import db
from src.models.user import (
    # users & orgs
    User, Enterprise, EnterpriseUser, EnterpriseProfile,
    # lookups
    Industry, Stage,
    # investor profile + M2M
    InvestorProfile, InvestorIndustry, InvestorStage, InvestmentPreferences,
    GeographicArea, InvestorGeographicFocus,
    # matching
    MatchScore, MatchInteraction,
    # startup profile (for enriched card fields)
    StartupProfile,
)

matching_bp = Blueprint("matching", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

MATCH_REFRESH_INTERVAL_MINUTES = 10
MATCH_SCORE_THRESHOLD = 30  # out of 100


# --------------------- Auth --------------------- #

def require_auth():
    """Validate Supabase JWT and return (user, token, error_response_or_None)."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, None, (jsonify({"error": "Missing or invalid Authorization header"}), 401)

    token = auth_header.split(" ")[1]
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
            timeout=15,
        )
        if resp.status_code != 200:
            return None, None, (jsonify({"error": "Invalid or expired token"}), 401)
        user_id = resp.json()["id"]
    except Exception as e:
        return None, None, (jsonify({"error": f"Token verification failed: {str(e)}"}), 500)

    user = db.session.get(User, user_id)
    if not user:
        return None, None, (jsonify({"error": "User not found in database"}), 404)
    return user, token, None


# --------------------- Helpers --------------------- #

def _utc_now():
    return datetime.now(timezone.utc)

def _as_utc(dt):
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

def _http_floor(dt):
    """HTTP dates are second-precision; normalize tz-aware dt."""
    if not dt:
        return None
    dt = _as_utc(dt)
    return dt.replace(microsecond=0)

def _user_investor_enterprise_ids(user_id):
    rows = (
        db.session.query(Enterprise.id)
        .join(EnterpriseUser, EnterpriseUser.enterprise_id == Enterprise.id)
        .filter(
            EnterpriseUser.user_id == user_id,
            EnterpriseUser.is_active.is_(True),
            Enterprise.enterprise_type.in_(["investor", "both"]),
        )
        .all()
    )
    return [r[0] for r in rows]

def _user_startup_enterprise_ids(user_id):
    rows = (
        db.session.query(Enterprise.id)
        .join(EnterpriseUser, EnterpriseUser.enterprise_id == Enterprise.id)
        .filter(
            EnterpriseUser.user_id == user_id,
            EnterpriseUser.is_active.is_(True),
            Enterprise.enterprise_type.in_(["startup", "both"]),
        )
        .all()
    )
    return [r[0] for r in rows]

def _fuzzy(a: str | None, b: str | None) -> int:
    if not a or not b:
        return 0
    return int(fuzz.token_set_ratio(a.lower(), b.lower()))

def _best_fuzzy(target: str | None, candidates: list[str]) -> int:
    if not target or not candidates:
        return 0
    return max((_fuzzy(target, c) for c in candidates), default=0)

def _enterprise_profile_map(e_ids):
    """Return {enterprise_id: EnterpriseProfile(with industry, stage loaded)}."""
    if not e_ids:
        return {}
    profiles = (
        db.session.query(EnterpriseProfile)
        .options(
            joinedload(EnterpriseProfile.industry),
            joinedload(EnterpriseProfile.stage),
        )
        .filter(EnterpriseProfile.enterprise_id.in_(e_ids)).all()
    )
    return {p.enterprise_id: p for p in profiles}

def _load_investor_pref_names(profile_id):
    """Return (industry_names, stage_names) from normalized M2M + optional criteria JSON."""
    inds = (
        db.session.query(Industry.name)
        .join(InvestorIndustry, InvestorIndustry.industry_id == Industry.id)
        .filter(InvestorIndustry.investor_profile_id == profile_id)
        .all()
    )
    stages = (
        db.session.query(Stage.name)
        .join(InvestorStage, InvestorStage.stage_id == Stage.id)
        .filter(InvestorStage.investor_profile_id == profile_id)
        .all()
    )
    ind_names = {n for (n,) in inds}
    stage_names = {n for (n,) in stages}

    prefs = db.session.query(InvestmentPreferences).filter_by(investor_profile_id=profile_id).first()
    if prefs and isinstance(prefs.investment_criteria, dict):
        for n in (prefs.investment_criteria or {}).get("preferred_industries", []):
            if isinstance(n, str):
                ind_names.add(n)
        for n in (prefs.investment_criteria or {}).get("preferred_stages", []):
            if isinstance(n, str):
                stage_names.add(n)

    return list(ind_names), list(stage_names)

def _load_geo_focus_names(profile_id):
    """Return list of geographic area names from normalized M2M."""
    rows = (
        db.session.query(GeographicArea.name)
        .join(InvestorGeographicFocus, InvestorGeographicFocus.geographic_area_id == GeographicArea.id)
        .filter(InvestorGeographicFocus.investor_profile_id == profile_id)
        .all()
    )
    return [n for (n,) in rows]

def _compute_score(investor_profile: InvestorProfile, e: Enterprise, ep: EnterpriseProfile | None):
    """
    Returns (score_0_100, reasons_list).
    Components:
      Industry (25), Stage (20), Location (10),
      Risk vs Stage (10), Thesis/Name affinity (<=30).
    """
    score = 0
    reasons = []

    industry_name = ep.industry.name if (ep and ep.industry) else None
    stage_name = ep.stage.name if (ep and ep.stage) else None

    pref_industries, pref_stages = _load_investor_pref_names(investor_profile.id)
    geo_focus = _load_geo_focus_names(investor_profile.id)

    # Industry
    if industry_name:
        s = _best_fuzzy(industry_name, pref_industries)
        if s >= 70:
            score += 25
            reasons.append(f"Industry match: {industry_name} ({s}%)")

    # Stage
    if stage_name:
        s = _best_fuzzy(stage_name, pref_stages)
        if s >= 70:
            score += 20
            reasons.append(f"Stage match: {stage_name} ({s}%)")

    # Location
    if e.location:
        s = _best_fuzzy(e.location, geo_focus)
        if s >= 70:
            score += 10
            reasons.append(f"Location match: {e.location} ({s}%)")

    # Risk tolerance vs stage (naive map using investment_approach as proxy)
    risk_map = {
        "high": ["pre_seed", "seed"],
        "medium": ["series_a", "series_b"],
        "low": ["series_c", "series_d", "growth", "ipo"],
    }
    if investor_profile and investor_profile.investment_approach and stage_name:
        tol = (investor_profile.investment_approach or "").lower()
        if tol in risk_map and stage_name.lower() in risk_map[tol]:
            score += 10
            reasons.append(f"Risk alignment with stage {stage_name}")

    # Base fit from fuzzy on enterprise name vs thesis
    if investor_profile.investment_thesis and e.name:
        s = _fuzzy(investor_profile.investment_thesis, e.name)
        if s >= 60:
            add = min(30, int(s / 2))  # cap 30
            score += add
            reasons.append(f"Thesis/name affinity (+{add})")

    return min(score, 100), reasons

def _upsert_match(investor_eid, startup_eid, score, reasons, now):
    """Insert-or-update a MatchScore row (unique investor+startup)."""
    payload = {
        "compatibility_score": round(score / 100.0, 4),
        "fit_score": round(score / 100.0, 4),
        "overall_score": round(score / 100.0, 4),
        "score_breakdown": {"reasons": reasons, "raw_score": score},
        "algorithm_version": "fuzzy_v1",
        "calculated_at": now,
        "is_active": True,
        "notes": "autogen by /matching",
    }
    stmt = insert(MatchScore).values(
        investor_enterprise_id=investor_eid,
        startup_enterprise_id=startup_eid,
        **payload,
    ).on_conflict_do_update(
        constraint="unique_match",  # matches the UniqueConstraint name in the model
        set_=payload,
    )
    db.session.execute(stmt)

def _latest_calc_time_for_investor(investor_eids):
    if not investor_eids:
        return None
    return (
        db.session.query(func.max(MatchScore.calculated_at))
        .filter(MatchScore.investor_enterprise_id.in_(investor_eids))
        .scalar()
    )

def _latest_calc_time_for_startup(startup_eid):
    return (
        db.session.query(func.max(MatchScore.calculated_at))
        .filter(MatchScore.startup_enterprise_id == startup_eid)
        .scalar()
    )


# --------------------- Routes --------------------- #

@matching_bp.route("/matches", methods=["GET"])
def generate_and_return_matches():
    user, _, err = require_auth()
    if err:
        return err

    now = _utc_now()
    mode = request.args.get("mode")
    limit = request.args.get("limit", type=int)

    investor_eids = _user_investor_enterprise_ids(user.id)
    startup_eids  = _user_startup_enterprise_ids(user.id)

    # Parse If-Modified-Since (seconds precision)
    ims_raw = request.headers.get("If-Modified-Since")
    ims_dt  = _http_floor(parse_date(ims_raw)) if ims_raw else None

    results = []
    refreshed_now = False
    last_refreshed = None

    # --------- Investor mode --------- #
    if (mode == "investor") or (mode is None and investor_eids):
        last_calc = _as_utc(_latest_calc_time_for_investor(investor_eids))
        last_calc_s = _http_floor(last_calc)
        last_refreshed = last_calc_s.isoformat() if last_calc_s else None

        is_stale = (last_calc_s is None) or (now - last_calc_s) >= timedelta(minutes=MATCH_REFRESH_INTERVAL_MINUTES)
        if (not is_stale) and ims_dt and ims_dt >= last_calc_s:
            resp = jsonify()
            resp.status_code = 304
            resp.headers["Last-Modified"] = http_date(last_calc_s)
            resp.headers["Cache-Control"] = "private, must-revalidate"
            resp.headers["Vary"] = "Authorization"
            return resp

        # Recompute if stale
        if is_stale:
            startups = (
                db.session.query(Enterprise)
                .filter(Enterprise.enterprise_type.in_(["startup", "both"]),
                        Enterprise.status == "active")
                .all()
            )
            eprof_map = _enterprise_profile_map([e.id for e in startups])
            inv_profiles = (
                db.session.query(InvestorProfile)
                .filter(InvestorProfile.enterprise_id.in_(investor_eids))
                .all()
            )
            for prof in inv_profiles:
                for se in startups:
                    score, reasons = _compute_score(prof, se, eprof_map.get(se.id))
                    if score >= MATCH_SCORE_THRESHOLD:
                        _upsert_match(prof.enterprise_id, se.id, score, reasons, now)

            db.session.commit()
            refreshed_now = True
            last_calc_s = _http_floor(now)
            last_refreshed = last_calc_s.isoformat()

        # Return matches (optionally limited)
        q = (
            db.session.query(MatchScore)
            .filter(MatchScore.investor_enterprise_id.in_(investor_eids))
            .order_by(MatchScore.overall_score.desc().nullslast())
        )
        if limit:
            q = q.limit(limit)
        matches = q.all()

        startup_ids = list({m.startup_enterprise_id for m in matches})
        e_map  = {e.id: e for e in db.session.query(Enterprise).filter(Enterprise.id.in_(startup_ids)).all()}
        ep_map = _enterprise_profile_map(startup_ids)
        sp_map = {
            sp.enterprise_id: sp
            for sp in db.session.query(StartupProfile).filter(StartupProfile.enterprise_id.in_(startup_ids)).all()
        }

        for m in matches:
            se = e_map.get(m.startup_enterprise_id)
            ep = ep_map.get(m.startup_enterprise_id)  # enterprise profile (industry/stage/tags)
            sp = sp_map.get(m.startup_enterprise_id)  # startup profile (mrr/valuation/metrics)

            results.append({
                "match_id": str(m.id),
                "investor_enterprise_id": str(m.investor_enterprise_id),
                "startup": {
                    "id": str(se.id) if se else str(m.startup_enterprise_id),
                    "name": se.name if se else None,
                    "industry": ep.industry.name if (ep and ep.industry) else None,
                    "stage": ep.stage.name if (ep and ep.stage) else None,
                    "location": se.location if se else None,
                    # Enriched fields for the card UI
                    # Prefer StartupProfile.team_size; fall back to Enterprise.employee_count
                    "employees": (sp.team_size if sp and sp.team_size is not None
                                  else (se.employee_count if se else None)),
                    "tags": (ep.headline_tags if ep and ep.headline_tags else []),
                    "mrr_usd": float(sp.display_mrr_usd) if sp and sp.display_mrr_usd is not None else None,
                    "valuation_usd": float(sp.display_valuation_usd) if sp and sp.display_valuation_usd is not None else None,
                    "key_metrics": {
                        "technical_founders_pct": float(sp.technical_founders_pct) if sp and sp.technical_founders_pct is not None else None,
                        "previous_exits_pct": float(sp.previous_exits_pct) if sp and sp.previous_exits_pct is not None else None,
                    },
                    "current_investors": sp.current_investors if sp and sp.current_investors else [],
                    # Also include a nested shape the UI can read
                    "startup_profile": {
                        "team_size": sp.team_size if sp else None,
                        "mrr_usd": float(sp.display_mrr_usd) if sp and sp.display_mrr_usd is not None else None,
                        "arr_usd": float(sp.arr_usd) if sp and sp.arr_usd is not None else None,
                        "current_valuation_usd": float(sp.display_valuation_usd) if sp and sp.display_valuation_usd is not None else None,
                        "current_investors": sp.current_investors if sp and sp.current_investors else [],
                        "technical_founders_pct": float(sp.technical_founders_pct) if sp and sp.technical_founders_pct is not None else None,
                        "previous_exits_pct": float(sp.previous_exits_pct) if sp and sp.previous_exits_pct is not None else None,
                    },
                },
                "overall_score": float(m.overall_score or 0),
                "score_breakdown": m.score_breakdown or {},
                "calculated_at": m.calculated_at.isoformat() if m.calculated_at else None,
            })

        resp = jsonify({
            "mode": "investor",
            "matches": results,
            "last_refreshed": last_refreshed,
            "refreshed_now": refreshed_now,
        })
        resp.headers["Last-Modified"] = http_date(last_calc_s or _http_floor(now))
        resp.headers["Cache-Control"] = "private, must-revalidate"
        resp.headers["Vary"] = "Authorization"
        return resp, 200

    # --------- Startup mode --------- #
    elif (mode == "startup") or (mode is None and startup_eids):
        startup_eid = startup_eids[0]
        last_calc = _as_utc(_latest_calc_time_for_startup(startup_eid))
        last_calc_s = _http_floor(last_calc)
        last_refreshed = last_calc_s.isoformat() if last_calc_s else None

        is_stale = (last_calc_s is None) or (now - last_calc_s) >= timedelta(minutes=MATCH_REFRESH_INTERVAL_MINUTES)
        if (not is_stale) and ims_dt and ims_dt >= last_calc_s:
            resp = jsonify()
            resp.status_code = 304
            resp.headers["Last-Modified"] = http_date(last_calc_s)
            resp.headers["Cache-Control"] = "private, must-revalidate"
            resp.headers["Vary"] = "Authorization"
            return resp

        # For scoring we need the startup enterprise & its enterprise profile
        se = db.session.get(Enterprise, startup_eid)
        ep_map = _enterprise_profile_map([startup_eid])
        ep = ep_map.get(startup_eid)

        if is_stale:
            inv_profiles = (
                db.session.query(InvestorProfile)
                .join(Enterprise, Enterprise.id == InvestorProfile.enterprise_id)
                .filter(Enterprise.enterprise_type.in_(["investor", "both"]),
                        Enterprise.status == "active")
                .all()
            )
            for prof in inv_profiles:
                score, reasons = _compute_score(prof, se, ep)
                if score >= MATCH_SCORE_THRESHOLD:
                    _upsert_match(prof.enterprise_id, se.id, score, reasons, now)

            db.session.commit()
            refreshed_now = True
            last_calc_s = _http_floor(now)
            last_refreshed = last_calc_s.isoformat()

        # Return matches for this startup
        q = (
            db.session.query(MatchScore)
            .filter(MatchScore.startup_enterprise_id == startup_eid)
            .order_by(MatchScore.overall_score.desc().nullslast())
        )
        if limit:
            q = q.limit(limit)
        matches = q.all()

        inv_ids = list({m.investor_enterprise_id for m in matches})
        inv_map = {e.id: e for e in db.session.query(Enterprise).filter(Enterprise.id.in_(inv_ids)).all()}

        for m in matches:
            ie = inv_map.get(m.investor_enterprise_id)
            results.append({
                "match_id": str(m.id),
                "startup_enterprise_id": str(startup_eid),
                "investor_enterprise": {
                    "id": str(ie.id) if ie else str(m.investor_enterprise_id),
                    "name": ie.name if ie else None,
                    "location": ie.location if ie else None,
                },
                "overall_score": float(m.overall_score or 0),
                "score_breakdown": m.score_breakdown or {},
                "calculated_at": m.calculated_at.isoformat() if m.calculated_at else None,
            })

        resp = jsonify({
            "mode": "startup",
            "matches": results,
            "last_refreshed": last_refreshed,
            "refreshed_now": refreshed_now,
        })
        resp.headers["Last-Modified"] = http_date(last_calc_s or _http_floor(now))
        resp.headers["Cache-Control"] = "private, must-revalidate"
        resp.headers["Vary"] = "Authorization"
        return resp, 200

    else:
        return jsonify({"error": "User must belong to an investor or startup enterprise"}), 403