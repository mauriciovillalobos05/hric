# src/routes/matching.py

from datetime import datetime, timedelta
import os
import json
import requests

from flask import Blueprint, request, jsonify
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from rapidfuzz import fuzz

from src.extensions import db
from src.models.user import (
    # users & orgs
    User, Enterprise, EnterpriseUser, EnterpriseProfile,
    # lookups
    Industry, Stage,
    # investor profile
    InvestorProfile, InvestorIndustry, InvestorStage, InvestmentPreferences,
    # matching
    MatchScore, MatchInteraction,
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

    user = User.query.get(user_id)
    if not user:
        return None, None, (jsonify({"error": "User not found in database"}), 404)
    return user, token, None


# --------------------- Helpers --------------------- #

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


def _load_investor_pref_names(profile_id):
    """Return (industry_names, stage_names) from M2M + preferences JSON."""
    # M2M -> names
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

    # Preferences JSON (optional strings)
    prefs = InvestmentPreferences.query.filter_by(investor_profile_id=profile_id).first()
    if prefs:
        for n in (prefs.preferred_industries or []):
            if isinstance(n, str):
                ind_names.add(n)
        for n in (prefs.preferred_stages or []):
            if isinstance(n, str):
                stage_names.add(n)

    return list(ind_names), list(stage_names)


def _enterprise_profile_map(e_ids):
    profiles = (
        EnterpriseProfile.query
        .options(joinedload(EnterpriseProfile.industry), joinedload(EnterpriseProfile.stage))
        .filter(EnterpriseProfile.enterprise_id.in_(e_ids))
        .all()
    )
    return {p.enterprise_id: p for p in profiles}


def _compute_score(investor_profile: InvestorProfile, e: Enterprise, ep: EnterpriseProfile | None):
    """
    Returns (score_0_100, reasons_list).
    We use simple components: industry (25), stage (20), location (10),
    risk tolerance vs stage (10), advisory availability (5), and a base fit (up to 30) from fuzzy name/desc.
    """
    score = 0
    reasons = []

    # Industry / Stage names
    industry_name = ep.industry.name if (ep and ep.industry) else None
    stage_name = ep.stage.name if (ep and ep.stage) else None

    # Investor preferred names
    pref_industries, pref_stages = _load_investor_pref_names(investor_profile.id)
    geo_focus = investor_profile.geographic_focus or []

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

    # Risk tolerance vs stage (naive map)
    risk_map = {
        "high": ["pre_seed", "seed"],
        "medium": ["series_a", "series_b"],
        "low": ["series_c", "series_d", "growth", "ipo"],
    }
    if investor_profile and investor_profile.investment_approach and stage_name:
        tol = (investor_profile.investment_approach or "").lower()  # repurpose if you store risk separately
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
    """Create or update a MatchScore row (unique investor+startup)."""
    m = (
        MatchScore.query
        .filter_by(investor_enterprise_id=investor_eid, startup_enterprise_id=startup_eid)
        .first()
    )
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
    if m:
        for k, v in payload.items():
            setattr(m, k, v)
    else:
        m = MatchScore(
            investor_enterprise_id=investor_eid,
            startup_enterprise_id=startup_eid,
            **payload,
        )
        db.session.add(m)
    return m


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
    """
    Generates (if needed) and returns matches.
    - If the caller belongs to investor org(s): generates matches for those investor enterprises.
    - Else if the caller belongs to a startup org: generates matches for that startup (against all investors).
    Query params:
      - mode: "investor" | "startup" (optional). If omitted, auto-detect.
    """
    user, _, err = require_auth()
    if err:
        return err

    now = datetime.utcnow()
    mode = request.args.get("mode")  # optional override

    investor_eids = _user_investor_enterprise_ids(user.id)
    startup_eids = _user_startup_enterprise_ids(user.id)

    results = []
    refreshed_now = False
    last_refreshed = None

    # --------- Investor mode --------- #
    if (mode == "investor") or (mode is None and investor_eids):
        # rate-limit by last calculated_at for these investor enterprises
        last_calc = _latest_calc_time_for_investor(investor_eids)
        last_refreshed = last_calc.isoformat() if last_calc else None
        should_refresh = not last_calc or (now - last_calc) >= timedelta(minutes=MATCH_REFRESH_INTERVAL_MINUTES)

        if should_refresh:
            # load all active startups
            startups = (
                Enterprise.query
                .filter(Enterprise.enterprise_type.in_(["startup", "both"]), Enterprise.status == "active")
                .all()
            )
            eprof_map = _enterprise_profile_map([e.id for e in startups])

            # each investor enterprise -> its InvestorProfile
            inv_profiles = InvestorProfile.query.filter(InvestorProfile.enterprise_id.in_(investor_eids)).all()

            for prof in inv_profiles:
                for se in startups:
                    score, reasons = _compute_score(prof, se, eprof_map.get(se.id))
                    if score >= MATCH_SCORE_THRESHOLD:
                        _upsert_match(prof.enterprise_id, se.id, score, reasons, now)

            db.session.commit()
            refreshed_now = True
            last_refreshed = now.isoformat()

        # return matches
        matches = (
            MatchScore.query
            .filter(MatchScore.investor_enterprise_id.in_(investor_eids))
            .order_by(MatchScore.overall_score.desc().nullslast())
            .all()
        )
        # hydrate start-ups
        startup_ids = list({m.startup_enterprise_id for m in matches})
        e_map = {e.id: e for e in Enterprise.query.filter(Enterprise.id.in_(startup_ids)).all()}
        ep_map = _enterprise_profile_map(startup_ids)

        for m in matches:
            se = e_map.get(m.startup_enterprise_id)
            sp = ep_map.get(m.startup_enterprise_id)
            results.append({
                "match_id": str(m.id),
                "investor_enterprise_id": str(m.investor_enterprise_id),
                "startup": {
                    "id": str(se.id) if se else str(m.startup_enterprise_id),
                    "name": se.name if se else None,
                    "industry": sp.industry.name if (sp and sp.industry) else None,
                    "stage": sp.stage.name if (sp and sp.stage) else None,
                    "location": se.location if se else None,
                },
                "overall_score": float(m.overall_score or 0),
                "score_breakdown": m.score_breakdown or {},
                "calculated_at": m.calculated_at.isoformat() if m.calculated_at else None,
            })

        return jsonify({
            "mode": "investor",
            "matches": results,
            "last_refreshed": last_refreshed,
            "refreshed_now": refreshed_now,
        }), 200

    # --------- Startup mode --------- #
    elif (mode == "startup") or (mode is None and startup_eids):
        # choose the first startup enterprise (or iterate all if you prefer)
        startup_eid = startup_eids[0]
        last_calc = _latest_calc_time_for_startup(startup_eid)
        last_refreshed = last_calc.isoformat() if last_calc else None
        should_refresh = not last_calc or (now - last_calc) >= timedelta(minutes=MATCH_REFRESH_INTERVAL_MINUTES)

        se = Enterprise.query.get(startup_eid)
        sp_map = _enterprise_profile_map([startup_eid])
        sp = sp_map.get(startup_eid)

        if should_refresh:
            # all investor profiles
            inv_profiles = (
                InvestorProfile.query
                .join(Enterprise, Enterprise.id == InvestorProfile.enterprise_id)
                .filter(Enterprise.enterprise_type.in_(["investor", "both"]), Enterprise.status == "active")
                .all()
            )
            for prof in inv_profiles:
                score, reasons = _compute_score(prof, se, sp)
                if score >= MATCH_SCORE_THRESHOLD:
                    _upsert_match(prof.enterprise_id, se.id, score, reasons, now)

            db.session.commit()
            refreshed_now = True
            last_refreshed = now.isoformat()

        # return matches for this startup
        matches = (
            MatchScore.query
            .filter(MatchScore.startup_enterprise_id == startup_eid)
            .order_by(MatchScore.overall_score.desc().nullslast())
            .all()
        )
        inv_ids = list({m.investor_enterprise_id for m in matches})
        inv_map = {e.id: e for e in Enterprise.query.filter(Enterprise.id.in_(inv_ids)).all()}

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

        return jsonify({
            "mode": "startup",
            "matches": results,
            "last_refreshed": last_refreshed,
            "refreshed_now": refreshed_now,
        }), 200

    else:
        return jsonify({"error": "User must belong to an investor or startup enterprise"}), 403


@matching_bp.route("/matches/<uuid:match_id>/interact", methods=["POST"])
def record_match_interaction(match_id):
    """
    Body: { "action": "view" | "like" | "message" | "reject" | "save" }
    Maps to MatchInteraction.interaction_type:
      - message -> "contact"
      - reject  -> "pass"
      - save    -> "follow_up"
      - like/view passthrough
    Authorization: caller must belong to either side (investor or startup) of the match.
    """
    user, _, err = require_auth()
    if err:
        return err

    match = MatchScore.query.get(match_id)
    if not match:
        return jsonify({"error": "Match not found"}), 404

    # ensure user is member of either enterprise
    mem = EnterpriseUser.query.filter(
        EnterpriseUser.user_id == user.id,
        EnterpriseUser.is_active.is_(True),
        EnterpriseUser.enterprise_id.in_([match.investor_enterprise_id, match.startup_enterprise_id]),
    ).first()
    if not mem:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    action = data.get("action")
    if action not in {"view", "like", "message", "reject", "save"}:
        return jsonify({"error": "Invalid action"}), 400

    mapping = {
        "message": "contact",
        "reject": "pass",
        "save": "follow_up",
    }
    interaction_type = mapping.get(action, action)

    mi = MatchInteraction(
        match_id=match.id,
        user_id=user.id,
        interaction_type=interaction_type,
        interaction_value={"source": "api", "original_action": action},
    )
    db.session.add(mi)
    db.session.commit()

    return jsonify({"message": "Interaction recorded"}), 201