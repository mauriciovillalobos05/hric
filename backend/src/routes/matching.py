# src/routes/matching.py

from datetime import datetime, timedelta, timezone
import os
import math
import json
import requests
from flask import Blueprint, request, jsonify
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from rapidfuzz import fuzz

from src.extensions import db
from src.models.user import (
    # users & orgs
    User, Enterprise, EnterpriseUser, EnterpriseProfile, StartupProfile,
    # lookups
    Industry, Stage,
    # investor profile + M2M
    InvestorProfile, InvestorIndustry, InvestorStage, InvestmentPreferences,
    GeographicArea, InvestorGeographicFocus,
    # matching
    MatchScore, MatchInteraction,
)

matching_bp = Blueprint("matching", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# TTL for recalculation unless forced
MATCH_REFRESH_INTERVAL_MINUTES = int(os.getenv("MATCH_REFRESH_MINUTES", "10"))
# Threshold to upsert a match (0-100)
MATCH_SCORE_THRESHOLD = int(os.getenv("MATCH_SCORE_THRESHOLD", "30"))

# Default weight budget across ALL components (must sum ~1, will be renormalized)
DEFAULT_WEIGHTS = {
    # taxonomy fit
    "industry": 0.15,
    "stage": 0.12,
    "location": 0.08,
    "risk": 0.08,
    "thesis": 0.12,
    # user-tunable (investor sliders)
    "roi": 0.15,
    "technical_founders": 0.08,
    "previous_exits": 0.06,
    "revenue": 0.09,
    "team_size": 0.04,
    "currently_raising": 0.03,
}

SLIDER_KEY_MAP = {
    "roiWeight": "roi",
    "technicalFoundersWeight": "technical_founders",
    "previousExitsWeight": "previous_exits",
    "revenueWeight": "revenue",
    "teamSizeWeight": "team_size",
    "currentlyRaisingWeight": "currently_raising",
}

# Neutral base used for persistence only (role-agnostic, taxonomy-forward)
BASE_WEIGHTS = {
    "industry": 0.30,
    "stage": 0.25,
    "location": 0.20,
    "check_size_fit": 0.10,
    "decision_speed": 0.05,
    "verification_trust": 0.05,
    "activity": 0.05,
}

# Investor dashboard default emphasis (what you had, cleaned & kept)
DEFAULT_WEIGHTS_INVESTOR = {
    "industry": 0.15,
    "stage": 0.12,
    "location": 0.08,
    "risk": 0.08,
    "thesis": 0.12,
    "roi": 0.15,
    "technical_founders": 0.08,
    "previous_exits": 0.06,
    "revenue": 0.09,
    "team_size": 0.04,
    "currently_raising": 0.03,
}

# Entrepreneur dashboard default emphasis (matches your FilterPanel sliders)
DEFAULT_WEIGHTS_ENTREPRENEUR = {
    "industry": 0.30,
    "stage": 0.25,
    "location": 0.15,            # = geo coverage
    "check_size_fit": 0.20,
    "decision_speed": 0.05,
    "verification_trust": 0.05,
    "activity": 0.00,            # hidden by default; user may raise
}

# Map frontend slider keys -> internal component keys (entrepreneur)
ENTREPRENEUR_SLIDER_MAP = {
    "industryFitWeight": "industry",
    "stageAlignmentWeight": "stage",
    "geoCoverageWeight": "location",
    "checkSizeFitWeight": "check_size_fit",
    "decisionSpeedWeight": "decision_speed",
    "verificationTrustWeight": "verification_trust",
    "activityTrackRecordWeight": "activity",
}

# --------------------- Auth --------------------- #
# Helper shorthands for SQLAlchemy 2.0-style session usage
def Q(model):
    return db.session.query(model)

def G(model, pk):
    return db.session.get(model, pk)

def utcnow():
    return datetime.now(timezone.utc)

def to_aware_utc(dt):
    if dt is None:
        return None
    return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

def require_auth():
    """Validate Supabase JWT and return (user, token, error_tuple_or_None)."""
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

    user = G(User, user_id)
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


def _enterprise_profile_map(e_ids):
    """Return {enterprise_id: EnterpriseProfile(with industry, stage loaded)}."""
    if not e_ids:
        return {}
    profiles = (
        Q(EnterpriseProfile)
        .options(joinedload(EnterpriseProfile.industry), joinedload(EnterpriseProfile.stage))
        .filter(EnterpriseProfile.enterprise_id.in_(e_ids))
        .all()
    )
    return {p.enterprise_id: p for p in profiles}


def _startup_profile_map(e_ids):
    """Return {enterprise_id: StartupProfile}."""
    if not e_ids:
        return {}
    rows = Q(StartupProfile).filter(StartupProfile.enterprise_id.in_(e_ids)).all()
    return {r.enterprise_id: r for r in rows}


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

    prefs = Q(InvestmentPreferences).filter_by(investor_profile_id=profile_id).first()
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


def _load_slider_weights(profile_id) -> dict:
    """
    Read investor slider weights (0-100 ints) from InvestmentPreferences.
    Accepts either:
      - prefs.weights JSON with slider keys, or
      - prefs.investment_criteria["weights"] JSON
    Returns dict keyed by INTERNAL component names (SLIDER_KEY_MAP values).
    """
    prefs = Q(InvestmentPreferences).filter_by(investor_profile_id=profile_id).first()
    raw = {}
    payload = None
    if prefs:
        if hasattr(prefs, "weights") and isinstance(prefs.weights, dict):
            payload = prefs.weights
        elif isinstance(prefs.investment_criteria, dict) and isinstance(prefs.investment_criteria.get("weights"), dict):
            payload = prefs.investment_criteria.get("weights")
    payload = payload or {}

    for slider_key, internal in SLIDER_KEY_MAP.items():
        v = payload.get(slider_key)
        if isinstance(v, (int, float)):
            raw[internal] = max(0.0, float(v))
    return raw


def _apply_user_slider_weights(defaults: dict, slider_percents: dict) -> dict:
    """
    Reallocate the DEFAULT share for slider-controlled components proportionally to user percents.
    This keeps taxonomy weights (industry/stage/location/risk/thesis) intact,
    and redistributes ONLY the slider subset while preserving total sum ~1.0.
    """
    # Identify slider subset in defaults
    slider_keys = [v for v in SLIDER_KEY_MAP.values()]
    slider_default_sum = sum(defaults[k] for k in slider_keys if k in defaults)

    if not slider_percents:
        return defaults.copy()

    # Normalize incoming percents to a distribution (sum=1) if any positive
    total_percent = sum(max(0.0, slider_percents.get(k, 0.0)) for k in slider_keys)
    if total_percent <= 0:
        return defaults.copy()

    # Build new weights
    out = defaults.copy()
    for k in slider_keys:
        p = max(0.0, slider_percents.get(k, 0.0))
        share = (p / total_percent) * slider_default_sum
        out[k] = share

    # Final renormalization to 1.0 (floating tolerances)
    s = sum(out.values()) or 1.0
    for k in out:
        out[k] = out[k] / s
    return out


def _component_scores(investor_profile: InvestorProfile,
                      ent: Enterprise,
                      ep: EnterpriseProfile | None,
                      sp: StartupProfile | None,
                      raise_target_usd: float | None = None):
    """
    Compute per-component scores in [0,1] + reasons.
    Components are role-agnostic; different routes apply different weights.
    """
    comps = {  # initialize any key we may set
        "industry": 0.0, "stage": 0.0, "location": 0.0, "risk": 0.0, "thesis": 0.0,
        "roi": 0.0, "technical_founders": 0.0, "previous_exits": 0.0, "revenue": 0.0,
        "team_size": 0.0, "currently_raising": 0.0,
        # NEW:
        "check_size_fit": 0.0, "decision_speed": 0.0,
        "verification_trust": 0.0, "activity": 0.0,
    }
    reasons = []

    # ----- taxonomy fields -----
    industry_name = ep.industry.name if (ep and ep.industry) else None
    stage_name = ep.stage.name if (ep and ep.stage) else None
    pref_industries, pref_stages = _load_investor_pref_names(investor_profile.id)
    geo_focus = _load_geo_focus_names(investor_profile.id)

    # Industry (fuzzy by name list)
    if industry_name:
        s = _best_fuzzy(industry_name, pref_industries) / 100.0
        comps["industry"] = s
        if s >= 0.7:
            reasons.append(f"Industry fit: {industry_name} ({round(s*100)}%)")

    # Stage (fuzzy by name list; you could replace by ordered distance)
    if stage_name:
        s = _best_fuzzy(stage_name, pref_stages) / 100.0
        comps["stage"] = s
        if s >= 0.7:
            reasons.append(f"Stage fit: {stage_name} ({round(s*100)}%)")

    # Location
    if ent.location:
        s = _best_fuzzy(ent.location, geo_focus) / 100.0
        comps["location"] = s
        if s >= 0.7:
            reasons.append(f"Location fit: {ent.location} ({round(s*100)}%)")

    # Risk alignment via investor_profile.investment_approach vs stage
    risk_map = {
        "high": {"pre-seed", "preseed", "pre_seed", "seed"},
        "medium": {"series a", "series_a", "series a/b", "series b"},
        "low": {"series c", "series d", "growth", "ipo"},
    }
    if investor_profile and investor_profile.investment_approach and stage_name:
        tol = (investor_profile.investment_approach or "").lower()
        st = (stage_name or "").lower()
        for bucket, stages in risk_map.items():
            if tol == bucket and st in stages:
                comps["risk"] = 1.0
                reasons.append(f"Risk aligned with stage {stage_name}")
                break

    # Thesis / name semantic (fuzzy text)
    if investor_profile.investment_thesis and ent.name:
        s = _fuzzy(investor_profile.investment_thesis, ent.name) / 100.0
        comps["thesis"] = min(1.0, s)
        if s >= 0.6:
            reasons.append("Thesis/name affinity")

    # ----- slider-driven (optional; use StartupProfile & Enterprise) -----
    growth = float(sp.monthly_growth_rate or 0.0) if sp else 0.0  # %/month
    revenue = float(sp.current_revenue or 0.0) if sp else 0.0     # absolute currency
    team_size = (sp.team_size if (sp and sp.team_size is not None) else ent.employee_count) or 0
    traction = sp.traction_metrics if (sp and isinstance(sp.traction_metrics, dict)) else {}

    # ROI proxy: favor higher growth and non-trivial revenue
    # Simple smooth scaling; tune later with sector benchmarks
    roi = min(1.0, (growth / 20.0) + (math.log10(max(revenue, 1.0)) / 6.0))
    comps["roi"] = roi

    # Technical founders
    tf_flag = traction.get("technical_founders")
    cto_years = traction.get("cto_experience_years", 0) or 0
    comps["technical_founders"] = 1.0 if (tf_flag is True or cto_years >= 3) else 0.0

    # Previous exits (diminishing returns)
    prev_exits = traction.get("previous_exits", 0) or 0
    comps["previous_exits"] = min(1.0, float(prev_exits) / 2.0)

    # Revenue performance (log scale)
    comps["revenue"] = min(1.0, math.log10(max(revenue, 1.0)) / 6.0)

    # Team size (soft range fit 5..50)
    if team_size <= 0:
        comps["team_size"] = 0.0
    elif 5 <= team_size <= 50:
        comps["team_size"] = 1.0
    else:
        # decay as it moves away (rough)
        dist = abs(team_size - (50 if team_size > 50 else 5))
        comps["team_size"] = max(0.0, math.exp(-dist / 30.0))

    # Currently raising: map Enterprise.status
    prefs = Q(InvestmentPreferences).filter_by(investor_profile_id=investor_profile.id).first()
    comps["check_size_fit"] = _check_size_fit(
        raise_target_usd,
        prefs.min_deal_size if prefs else None,
        prefs.max_deal_size if prefs else None,
        investor_profile.typical_check_size,
    )
    if comps["check_size_fit"] >= 0.8:
        reasons.append("Check size aligned")

    # ----- NEW: decision_speed (faster is better) -----
    if prefs and isinstance(prefs.decision_timeline_days, int) and prefs.decision_timeline_days > 0:
        # map days inversely to [0..1], saturate around 180d
        d = min(180.0, float(prefs.decision_timeline_days))
        comps["decision_speed"] = max(0.0, 1.0 - (d / 180.0))
        if comps["decision_speed"] >= 0.7:
            reasons.append(f"Fast decisions (~{prefs.decision_timeline_days}d)")

    # ----- NEW: verification & trust -----
    try:
        inv_enterprise = G(Enterprise, investor_profile.enterprise_id)
        if inv_enterprise and inv_enterprise.is_verified:
            comps["verification_trust"] = 1.0
            reasons.append("Investor verified")
        else:
            comps["verification_trust"] = 0.2
    except Exception:
        comps["verification_trust"] = 0.0

    # ----- NEW: activity/track record -----
    ti = float(investor_profile.total_investments or 0)
    ex = float(investor_profile.successful_exits or 0)
    # smooth scaling with diminishing returns
    comps["activity"] = max(0.0, min(1.0, (ti / 40.0) * 0.7 + (ex / 5.0) * 0.3))
    if comps["activity"] >= 0.7:
        reasons.append(f"Active investor (deals: {int(ti)}, exits: {int(ex)})")

    return comps, reasons

def _check_size_fit(raise_target_usd: float | None,
                    inv_min: float | None,
                    inv_max: float | None,
                    typical: float | None) -> float:
    """
    0..1 score for how well the investor's check window fits the startup's target.
    - If raise_target is unknown, fallback to typical vs window coherence.
    """
    # sanitize
    to_f = lambda x: float(x) if x is not None else None
    rt = to_f(raise_target_usd)
    mn = to_f(inv_min)
    mx = to_f(inv_max)
    ty = to_f(typical)

    if mn is None and mx is None and ty is None:
        return 0.0

    # If target known, score overlap/distance
    if rt is not None:
        # window defaults if missing
        if mn is None and mx is None and ty is not None:
            mn, mx = ty * 0.5, ty * 1.5
        elif mn is None: mn = 0.0
        elif mx is None: mx = max(mn * 1.2, (ty or mn) * 1.2)

        if mn <= rt <= mx:
            return 1.0
        # distance decay (log-ish)
        dist = min(abs(rt - mn), abs(rt - mx))
        return max(0.0, 1.0 - (dist / max(mx, rt, 1.0))**0.5)

    # No target: check typical inside window or coherence between typical/min/max
    if ty is not None and mn is not None and mx is not None:
        if mn <= ty <= mx:
            return 0.8
        dist = min(abs(ty - mn), abs(ty - mx))
        return max(0.0, 0.8 - (dist / max(mx, ty, 1.0))**0.5)

    return 0.4  # neutral when insufficient data


def _compute_weighted_score(components: dict, weights: dict) -> float:
    """Return overall score in 0..100."""
    # Ensure keys align and weights sum to ~1
    keys = set(components.keys()) & set(weights.keys())
    if not keys:
        return 0.0
    total = sum(weights[k] for k in keys) or 1.0
    score01 = sum((components[k] * (weights[k] / total)) for k in keys)
    return max(0.0, min(100.0, score01 * 100.0))


def _normalize_weights(w: dict[str, float]) -> dict[str, float]:
    s = sum(float(v) for v in w.values()) or 1.0
    return {k: float(v) / s for k, v in w.items()}

def _compute_weighted_score01(components: dict, weights: dict) -> float:
    keys = set(components.keys()) & set(weights.keys())
    if not keys:
        return 0.0
    w = _normalize_weights({k: weights[k] for k in keys})
    return max(0.0, min(1.0, sum(components[k] * w[k] for k in keys)))

def _upsert_match(investor_eid, startup_eid, components, reasons, now):
    """Create/update MatchScore with role-agnostic base score only."""
    base01 = _compute_weighted_score01(components, BASE_WEIGHTS)

    m = (Q(MatchScore)
      .filter_by(investor_enterprise_id=investor_eid, startup_enterprise_id=startup_eid)
      .first())
    payload = {
        "compatibility_score": round(base01, 4),
        "fit_score": round(base01, 4),
        "overall_score": round(base01, 4),  # persisted = base
        "score_breakdown": {
            "components": components,           # per-component 0..1
            "base_weights": _normalize_weights(BASE_WEIGHTS),
            "base_score_raw": round(base01 * 100.0, 2),
            "reasons": reasons,
        },
        "algorithm_version": "components_base_v1",
        "calculated_at": now,
        "is_active": True,
        "notes": "persisted base score; view-specific score is computed per request",
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

def _viewer_weights_for_investor(prof: InvestorProfile) -> dict:
    """Load investor's custom slider weights (existing logic), applied over DEFAULT_WEIGHTS_INVESTOR."""
    custom = _load_slider_weights(prof.id)  # maps SLIDER_KEY_MAP -> internal keys already
    base = DEFAULT_WEIGHTS_INVESTOR.copy()
    if custom:
        # reuse your existing proportional reallocation on investor sliders
        return _apply_user_slider_weights(base, custom)
    return _normalize_weights(base)

def _viewer_weights_for_entrepreneur_from_query() -> dict:
    """
    Use raw 0..100 slider values as weights (independent scales).
    The scoring function will normalize these weights when computing view_score.
    """
    raw = request.args.get("weights")
    try:
        data = json.loads(raw) if raw else {}
    except Exception:
        data = {}

    # Fallbacks mirror your UI defaults
    defaults = {
        "industry": 30,
        "stage": 25,
        "location": 15,
        "check_size_fit": 20,
        "decision_speed": 5,
        "verification_trust": 5,
        "activity": 0,
    }

    def clamp01(x):
        try:
            v = float(x)
        except Exception:
            return 0.0
        return max(0.0, min(100.0, v))

    # Map UI keys -> internal keys; keep raw 0..100 values
    out = {}
    for ui_key, internal in ENTREPRENEUR_SLIDER_MAP.items():
        if isinstance(data, dict) and ui_key in data:
            out[internal] = clamp01(data.get(ui_key))
        else:
            out[internal] = clamp01(defaults.get(internal, 0))

    # Return raw weights; _compute_weighted_score01 will normalize later
    return out


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


def _paginate(query, page, per_page):
    total = query.count()
    items = query.limit(per_page).offset((page - 1) * per_page).all()
    return items, {"page": page, "per_page": per_page, "total": total, "pages": (total + per_page - 1) // per_page}


# --------------------- Routes --------------------- #

@matching_bp.route("/matches", methods=["GET"])
def generate_and_return_matches():
    """
    Generates (if needed) and returns matches.
    - If the caller belongs to investor org(s): generates matches for those investor enterprises.
    - Else if the caller belongs to a startup org: generates matches for that startup (against all investors).

    Query params:
      - mode: "investor" | "startup" (optional; autodetect if omitted)
      - force: "true"|"false" (default false) to bypass TTL
      - min_score: 0..100 (default 0)
      - page, per_page (default 1, 50) or top_k
      - order: "desc"|"asc" on overall_score (default desc)
    """
    user, _, err = require_auth()
    if err:
        return err

    now = utcnow()
    mode = request.args.get("mode")
    force = (request.args.get("force", "false").lower() == "true")
    min_score_param = request.args.get("min_score", "0")
    try:
        min_score = max(0.0, min(100.0, float(min_score_param))) / 100.0
    except Exception:
        min_score = 0.0

    top_k = request.args.get("top_k", type=int)
    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=50, type=int)
    order = request.args.get("order", "desc").lower()

    investor_eids = _user_investor_enterprise_ids(user.id)
    startup_eids = _user_startup_enterprise_ids(user.id)

    results = []
    refreshed_now = False
    last_refreshed = None

    # --------- Investor mode --------- #
    if (mode == "investor") or (mode is None and investor_eids):
        last_calc = to_aware_utc(_latest_calc_time_for_investor(investor_eids))
        last_refreshed = last_calc.isoformat() if last_calc else None
        should_refresh = force or (not last_calc) or (now - last_calc) >= timedelta(minutes=MATCH_REFRESH_INTERVAL_MINUTES)

        # load context
        inv_profiles = Q(InvestorProfile).filter(InvestorProfile.enterprise_id.in_(investor_eids)).all()
        # prefetch startups & profiles
        startups = (
            Q(Enterprise)
            .filter(Enterprise.enterprise_type.in_(["startup", "both"]), Enterprise.status == "active")
            .all()
        )
        startup_ids = [e.id for e in startups]
        eprof_map = _enterprise_profile_map(startup_ids)
        sprof_map = _startup_profile_map(startup_ids)

        if should_refresh:
            for prof in inv_profiles:
                # per-investor weights
                user_slider = _load_slider_weights(prof.id)
                weights = _apply_user_slider_weights(DEFAULT_WEIGHTS, user_slider)

                for se in startups:
                    comps, reasons = _component_scores(prof, se, eprof_map.get(se.id), sprof_map.get(se.id))
                    score = _compute_weighted_score(comps, weights)
                    if score >= MATCH_SCORE_THRESHOLD:
                        _upsert_match(prof.enterprise_id, se.id, comps, reasons, now)
            db.session.commit()
            refreshed_now = True
            last_refreshed = now.isoformat()

        # return matches for these investor enterprises
        q = Q(MatchScore).filter(
            MatchScore.investor_enterprise_id.in_(investor_eids),
            MatchScore.overall_score >= min_score,
        )
        if order == "asc":
            q = q.order_by(MatchScore.overall_score.asc().nullslast())
        else:
            q = q.order_by(MatchScore.overall_score.desc().nullslast())

        if top_k:
            matches = q.limit(top_k).all()
            pagination = None
        else:
            matches, pagination = _paginate(q, page, per_page)

        # hydrate startups
        s_ids = list({m.startup_enterprise_id for m in matches})
        e_map = {e.id: e for e in Q(Enterprise).filter(Enterprise.id.in_(s_ids)).all()}
        ep_map = _enterprise_profile_map(s_ids)

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

        out = {
            "mode": "investor",
            "matches": results,
            "last_refreshed": last_refreshed,
            "refreshed_now": refreshed_now,
        }
        if pagination:
            out["pagination"] = pagination
        return jsonify(out), 200

    # --------- Startup mode --------- #
    elif (mode == "startup") or (mode is None and startup_eids):
        startup_eid = startup_eids[0]
        last_calc = to_aware_utc(_latest_calc_time_for_startup(startup_eid))
        last_refreshed = last_calc.isoformat() if last_calc else None
        should_refresh = force or (not last_calc) or (now - last_calc) >= timedelta(minutes=MATCH_REFRESH_INTERVAL_MINUTES)

        se = G(Enterprise, startup_eid)
        ep = _enterprise_profile_map([startup_eid]).get(startup_eid)
        sp = _startup_profile_map([startup_eid]).get(startup_eid)

        if should_refresh:
            inv_profiles = (
                Q(InvestorProfile)
                .join(Enterprise, Enterprise.id == InvestorProfile.enterprise_id)
                .filter(Enterprise.enterprise_type.in_(["investor", "both"]), Enterprise.status == "active")
                .all()
            )
            for prof in inv_profiles:
                # use the investor's weights even in startup mode (score is “fit for that investor”)
                user_slider = _load_slider_weights(prof.id)
                weights = _apply_user_slider_weights(DEFAULT_WEIGHTS, user_slider)

                comps, reasons = _component_scores(prof, se, ep, sp)
                score = _compute_weighted_score(comps, weights)
                if score >= MATCH_SCORE_THRESHOLD:
                    _upsert_match(prof.enterprise_id, se.id, comps, reasons, now)

            db.session.commit()
            refreshed_now = True
            last_refreshed = now.isoformat()

        q = Q(MatchScore).filter(
            MatchScore.startup_enterprise_id == startup_eid,
            MatchScore.overall_score >= min_score,
        )
        if order == "asc":
            q = q.order_by(MatchScore.overall_score.asc().nullslast())
        else:
            q = q.order_by(MatchScore.overall_score.desc().nullslast())

        if top_k:
            matches = q.limit(top_k).all()
            pagination = None
        else:
            matches, pagination = _paginate(q, page, per_page)

        inv_ids = list({m.investor_enterprise_id for m in matches})
        inv_map = {e.id: e for e in Q(Enterprise).filter(Enterprise.id.in_(inv_ids)).all()}

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

        out = {
            "mode": "startup",
            "matches": results,
            "last_refreshed": last_refreshed,
            "refreshed_now": refreshed_now,
        }
        if pagination:
            out["pagination"] = pagination
        return jsonify(out), 200

    else:
        return jsonify({"error": "User must belong to an investor or startup enterprise"}), 403


@matching_bp.route("/recompute", methods=["POST"])
def recompute_for_scope():
    """
    Force or scoped recompute without fetching matches.
    Body:
      {
        "enterprise_id": "<uuid>",                 # startup enterprise to recompute against all investors
        "investor_enterprise_id": "<uuid>",        # investor enterprise to recompute against all startups
        "force": true|false                        # default true here
      }
    """
    user, _, err = require_auth()
    if err:
        return err

    data = request.get_json() or {}
    se_id = data.get("enterprise_id")
    inv_eid = data.get("investor_enterprise_id")
    force = bool(data.get("force", True))
    now = utcnow()

    # Ensure membership
    if se_id:
        ok = Q(EnterpriseUser).filter_by(user_id=user.id, enterprise_id=se_id, is_active=True).first()
        if not ok:
            return jsonify({"error": "Unauthorized for enterprise"}), 403
    if inv_eid:
        ok = Q(EnterpriseUser).filter_by(user_id=user.id, enterprise_id=inv_eid, is_active=True).first()
        if not ok:
            return jsonify({"error": "Unauthorized for investor enterprise"}), 403
    if not se_id and not inv_eid:
        return jsonify({"error": "Provide enterprise_id or investor_enterprise_id"}), 400

    updated = 0

    if inv_eid:
        # investor mode
        prof = Q(InvestorProfile).filter_by(enterprise_id=inv_eid).first()
        if not prof:
            return jsonify({"error": "Investor profile not found"}), 404

        user_slider = _load_slider_weights(prof.id)
        weights = _apply_user_slider_weights(DEFAULT_WEIGHTS, user_slider)

        startups = (
            Q(Enterprise)
            .filter(Enterprise.enterprise_type.in_(["startup", "both"]), Enterprise.status == "active")
            .all()
        )
        s_ids = [e.id for e in startups]
        eprof_map = _enterprise_profile_map(s_ids)
        sprof_map = _startup_profile_map(s_ids)

        for se in startups:
            comps, reasons = _component_scores(prof, se, eprof_map.get(se.id), sprof_map.get(se.id))
            score = _compute_weighted_score(comps, weights)
            if score >= MATCH_SCORE_THRESHOLD:
                _upsert_match(prof.enterprise_id, se.id, comps, reasons, now)
                updated += 1

    if se_id:
        # startup mode
        se = G(Enterprise, se_id)
        if not se:
            return jsonify({"error": "Enterprise not found"}), 404
        ep = _enterprise_profile_map([se_id]).get(se_id)
        sp = _startup_profile_map([se_id]).get(se_id)

        inv_profiles = (
            Q(InvestorProfile)
            .join(Enterprise, Enterprise.id == InvestorProfile.enterprise_id)
            .filter(Enterprise.enterprise_type.in_(["investor", "both"]), Enterprise.status == "active")
            .all()
        )
        for prof in inv_profiles:
            user_slider = _load_slider_weights(prof.id)
            weights = _apply_user_slider_weights(DEFAULT_WEIGHTS, user_slider)

            comps, reasons = _component_scores(prof, se, ep, sp)
            score = _compute_weighted_score(comps, weights)
            if score >= MATCH_SCORE_THRESHOLD:
                _upsert_match(prof.enterprise_id, se.id, comps, reasons, now)
                updated += 1

    db.session.commit()
    return jsonify({"message": "Recompute complete", "updated": updated, "forced": force}), 200


@matching_bp.route("/matches/entrepreneur", methods=["GET"])
def list_matches_for_entrepreneur():
    user, _, err = require_auth()
    if err:
        return err

    startup_eids = _user_startup_enterprise_ids(user.id)
    if not startup_eids:
        return jsonify({"error": "User is not in a startup enterprise"}), 403
    startup_eid = startup_eids[0]

    now = utcnow()
    raise_target_usd = request.args.get("raise_target_usd", type=float)

    last_calc = to_aware_utc(_latest_calc_time_for_startup(startup_eid))
    refreshed_now = False

    # TTL recompute of components + base score (no view weights here)
    if (not last_calc) or (now - last_calc) >= timedelta(minutes=MATCH_REFRESH_INTERVAL_MINUTES):
        se = G(Enterprise, startup_eid)
        ep = _enterprise_profile_map([startup_eid]).get(startup_eid)
        sp = _startup_profile_map([startup_eid]).get(startup_eid)

        inv_profiles = (
            Q(InvestorProfile)
            .join(Enterprise, Enterprise.id == InvestorProfile.enterprise_id)
            .filter(
                Enterprise.enterprise_type.in_(["investor", "both"]),
                Enterprise.status == "active",
            )
            .all()
        )

        for prof in inv_profiles:
            comps, reasons = _component_scores(
                prof, se, ep, sp, raise_target_usd=raise_target_usd
            )
            base01 = _compute_weighted_score01(comps, BASE_WEIGHTS)
            if (base01 * 100.0) >= MATCH_SCORE_THRESHOLD:
                _upsert_match(prof.enterprise_id, se.id, comps, reasons, now)

        db.session.commit()
        refreshed_now = True
        last_calc = now

    # viewer weights come from query (entrepreneur perspective)
    viewer_w = _viewer_weights_for_entrepreneur_from_query()

    # ---------- query params (existing) ----------
    min_score = max(0.0, min(100.0, float(request.args.get("min_score", "0"))))
    top_k = request.args.get("top_k", type=int)
    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=50, type=int)
    order = request.args.get("order", "desc").lower()

    # ---------- query params (NEW filters) ----------
    def _csv(name, alias=None):
        raw = request.args.get(name) or (request.args.get(alias) if alias else "")
        items = [s.strip() for s in (raw or "").split(",") if s.strip()]
        return items

    def _bool(name):
        v = request.args.get(name)
        if v is None:
            return None
        return str(v).lower() in {"1","true","t","yes","y"}

    locations = [s.lower() for s in _csv("locations")] or [s.lower() for s in _csv("location")]  # accept both
    types = [s.lower() for s in _csv("investorType")]  # e.g., ["investor","both"]
    inds_any = _csv("industriesAny", alias="industries")
    stg_any = _csv("stagesAny", alias="stages")
    min_check = request.args.get("minCheck", type=float)
    max_check = request.args.get("maxCheck", type=float)
    range_mode = (request.args.get("rangeMode") or "overlap").lower()
    verified = _bool("verified")
    portfolio_q = (request.args.get("portfolioQ") or "").strip().lower()

    # base query
    q = Q(MatchScore).filter(MatchScore.startup_enterprise_id == startup_eid)
    matches = q.all() if top_k else _paginate(q, page, per_page)[0]

    # --- hydrate related entities for investor side ---
    inv_ids = list({m.investor_enterprise_id for m in matches}) or []

    # enterprises (investors)
    ent_map = {e.id: e for e in Q(Enterprise).filter(Enterprise.id.in_(inv_ids)).all()}

    # investor profiles
    ip_list = Q(InvestorProfile).filter(InvestorProfile.enterprise_id.in_(inv_ids)).all()
    ip_by_ent = {ip.enterprise_id: ip for ip in ip_list}
    ip_ids = [ip.id for ip in ip_list]

    # m2m names (industries, stages)
    from collections import defaultdict
    inds_by_ip = defaultdict(list)
    stgs_by_ip = defaultdict(list)

    for ip_id, name in (
        db.session.query(InvestorIndustry.investor_profile_id, Industry.name)
        .join(Industry, Industry.id == InvestorIndustry.industry_id)
        .filter(InvestorIndustry.investor_profile_id.in_(ip_ids))
        .all()
    ):
        inds_by_ip[ip_id].append(name)

    for ip_id, name in (
        db.session.query(InvestorStage.investor_profile_id, Stage.name)
        .join(Stage, Stage.id == InvestorStage.stage_id)
        .filter(InvestorStage.investor_profile_id.in_(ip_ids))
        .all()
    ):
        stgs_by_ip[ip_id].append(name)

    # owner location fallback (no owner object in payload)
    owner_loc_rows = (
        db.session.query(EnterpriseUser.enterprise_id, User.location)
        .join(User, User.id == EnterpriseUser.user_id)
        .filter(
            EnterpriseUser.enterprise_id.in_(inv_ids),
            EnterpriseUser.role == 'owner',
            EnterpriseUser.is_active.is_(True),
        )
        .all()
    )
    owner_loc_by_ent = {eid: loc for (eid, loc) in owner_loc_rows if loc}

    # helper: filter logic per match
    def _passes_filters(ent, ip, ent_id):
        # no filters → accept everything
        if not (locations or types or inds_any or stg_any or (min_check is not None) or (max_check is not None) or (verified is not None) or portfolio_q):
            return True

        # type
        if types:
            t = (getattr(ent, "enterprise_type", None) or "").lower()
            if t not in types:
                return False

        # verified
        if verified is not None:
            if bool(getattr(ent, "is_verified", False)) != verified:
                return False

        # location (coalesced)
        if locations:
            loc = (getattr(ent, "location", None) or owner_loc_by_ent.get(ent_id) or "").lower()
            if not any(term in loc for term in locations):
                return False

        # industries any
        if inds_any:
            names = inds_by_ip.get(getattr(ip, "id", None), [])
            if not set(inds_any).intersection(names):
                return False

        # stages any
        if stg_any:
            names = stgs_by_ip.get(getattr(ip, "id", None), [])
            if not set(stg_any).intersection(names):
                return False

        # investment range (overlap by default)
        if (min_check is not None) or (max_check is not None):
            min_inv = float(getattr(ip, "min_investment", 0) or 0) if ip else None
            max_inv = float(getattr(ip, "max_investment", 0) or 0) if ip else None

            if (min_inv is None) or (max_inv is None):
                return False  # cannot evaluate

            if range_mode == "contains" and (min_check is not None and max_check is not None):
                if not (min_inv <= min_check and max_inv >= max_check):
                    return False
            elif range_mode == "within" and (min_check is not None and max_check is not None):
                if not (min_inv >= min_check and max_inv <= max_check):
                    return False
            else:
                # overlap (default)
                if (min_check is not None and max_check is not None):
                    if not (min_inv <= max_check and max_inv >= min_check):
                        return False
                elif min_check is not None:
                    if not (max_inv >= min_check):
                        return False
                elif max_check is not None:
                    if not (min_inv <= max_check):
                        return False

        # portfolio keyword
        if portfolio_q:
            import json
            pcs = getattr(ip, "portfolio_companies", None) if ip else None
            hay = (json.dumps(pcs, ensure_ascii=False) if pcs is not None else "").lower()
            if portfolio_q not in hay:
                return False

        return True

    # build results
    results = []
    for m in matches:
        comps = (m.score_breakdown or {}).get("components", {}) or {}
        view01 = _compute_weighted_score01(comps, viewer_w)
        view_score = round(view01 * 100.0, 2)
        if view_score < min_score:
            continue

        e = ent_map.get(m.investor_enterprise_id)
        ip = ip_by_ent.get(m.investor_enterprise_id)

        # apply filters (skip if fails)
        if not _passes_filters(e, ip, m.investor_enterprise_id):
            continue

        # enterprise core + fallback for location from owner's User.location
        name = getattr(e, "name", None) if e else None
        location = (getattr(e, "location", None) if e else None) or owner_loc_by_ent.get(m.investor_enterprise_id)
        logo_url = getattr(e, "logo_url", None) if e else None

        investor_payload = {
            "id": str(e.id) if e else str(m.investor_enterprise_id),
            "name": name,
            "type": getattr(e, "enterprise_type", None) if e else None,  # "investor"
            "location": location,
            "logoUrl": logo_url,
            "isVerified": bool(getattr(e, "is_verified", False)) if e else False,
            # profile-derived
            "industries": inds_by_ip.get(ip.id, []) if ip else [],
            "stages": stgs_by_ip.get(ip.id, []) if ip else [],
            "thesis": getattr(ip, "investment_thesis", None) if ip else None,
            "portfolioCompanies": (ip.portfolio_companies or []) if ip and ip.portfolio_companies else [],
            # convenience
            "matchScore": view_score,
            # debug hooks for UI
            "_raw": {"match_id": str(m.id), "score_breakdown": (m.score_breakdown or {})},
            "_components": comps,
        }

        results.append(
            {
                "match_id": str(m.id),
                "startup_enterprise_id": str(m.startup_enterprise_id),
                "investor_enterprise_id": str(m.investor_enterprise_id),
                "view_score": view_score,
                "score_breakdown": m.score_breakdown or {},
                "calculated_at": m.calculated_at.isoformat() if m.calculated_at else None,
                "investor": investor_payload,
            }
        )

    results.sort(key=lambda r: r["view_score"], reverse=(order != "asc"))
    if top_k:
        results = results[:top_k]

    return jsonify({
        "mode": "startup",
        "matches": results,
        "last_refreshed": last_calc.isoformat() if last_calc else None,
        "refreshed_now": refreshed_now,
        # (optional) echo applied filters for debugging
        "filters": {
            "locations": locations,
            "investorType": types,
            "industriesAny": inds_any,
            "stagesAny": stg_any,
            "minCheck": min_check, "maxCheck": max_check, "rangeMode": range_mode,
            "verified": verified,
            "portfolioQ": portfolio_q or None,
        },
    }), 200