from datetime import datetime
import os
import requests
from decimal import Decimal, InvalidOperation

from flask import Blueprint, request, jsonify
from sqlalchemy import func

from src.extensions import db
from src.models.user import (
    # users & orgs
    User, Enterprise, EnterpriseUser, EnterpriseProfile,
    # lookups
    Industry, Stage, GeographicArea,
    # investor profile + M2M
    InvestorProfile, InvestorIndustry, InvestorStage, InvestmentPreferences,
    # M2M for geo
    InvestorGeographicFocus,
    # matching
    MatchScore, MatchInteraction,
)

investor_bp = Blueprint("investor", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
LOCAL_API_BASE_URL = os.getenv("LOCAL_API_BASE_URL", None)


# --------------------- Auth helpers ---------------------

def require_auth():
    """Validate Supabase JWT and return (user, token, error_or_None)."""
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


def _user_investor_enterprise_ids(user: User):
    """All investor-type enterprise IDs the user belongs to."""
    rows = (
        db.session.query(Enterprise.id)
        .join(EnterpriseUser, EnterpriseUser.enterprise_id == Enterprise.id)
        .filter(
            EnterpriseUser.user_id == user.id,
            EnterpriseUser.is_active.is_(True),
            Enterprise.enterprise_type.in_(["investor", "both"]),
        )
        .all()
    )
    return [r[0] for r in rows]


def _is_admin_like(user: User) -> bool:
    """Owner/admin membership anywhere = elevated perms."""
    return (
        db.session.query(EnterpriseUser.id)
        .filter(
            EnterpriseUser.user_id == user.id,
            EnterpriseUser.is_active.is_(True),
            EnterpriseUser.role.in_(["owner", "admin"]),
        )
        .first()
        is not None
    )


def _enterprise_brief(e: Enterprise, prof: EnterpriseProfile | None):
    return {
        "id": str(e.id),
        "name": e.name,
        "type": e.enterprise_type,
        "location": e.location,
        "website": e.website,
        "logo_url": e.logo_url,
        "stage": prof.stage.name if (prof and prof.stage) else None,
        "industry": prof.industry.name if (prof and prof.industry) else None,
        "description": (prof.description if prof else e.description),
    }


# --------------------- Utilities ---------------------

def _dedup_names(names):
    seen = set()
    out = []
    for n in (names or []):
        key = (n or "").strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append((n or "").strip())
    return out


def _to_decimal(v):
    if v is None or v == "":
        return None
    try:
        return Decimal(str(v))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _to_str_list(v):
    """Coerce list-like or scalar to list[str]; supports [{label|value}] entries from multiselects."""
    if not v:
        return []
    if isinstance(v, list):
        out = []
        for item in v:
            if isinstance(item, dict):
                s = item.get("value") or item.get("label")
                if s:
                    out.append(str(s))
            else:
                out.append(str(item))
        return [s for s in out if s]
    return [str(v)]


def _paginate(query, page: int, per_page: int):
    """Simple manual paginator for SQLAlchemy queries."""
    total = query.count()
    items = query.limit(per_page).offset((page - 1) * per_page).all()
    pages = (total + per_page - 1) // per_page if per_page else 1
    return total, pages, items


def _ensure_geo_area(name: str):
    if not name:
        return None
    loc = (name or "").strip()
    if not loc:
        return None
    ga = db.session.query(GeographicArea).filter(GeographicArea.name.ilike(loc)).first()
    if not ga:
        ga = GeographicArea(name=loc)
        db.session.add(ga)
        db.session.flush()
    return ga


def _sync_geo_focus(investor_profile_id, names):
    db.session.query(InvestorGeographicFocus)\
        .filter_by(investor_profile_id=investor_profile_id)\
        .delete(synchronize_session=False)
    added = set()
    for n in _dedup_names(_to_str_list(names)):
        ga = _ensure_geo_area(n)
        if ga and ga.id not in added:
            db.session.add(InvestorGeographicFocus(
                investor_profile_id=investor_profile_id,
                geographic_area_id=ga.id
            ))
            added.add(ga.id)


# --------------------- Lookup Ensurers ---------------------

_STAGE_ORDER = {
    "pre-seed": 1,
    "pre seed": 1,
    "preseed": 1,
    "seed": 2,
    "series a": 3,
    "series-a": 3,
    "series b": 4,
    "series-b": 4,
    "series c": 5,
    "series-c": 5,
    "growth": 6,
    "series d": 6,
    "ipo": 7,
}

def _normalize(s: str | None) -> str:
    return (s or "").strip()

def _normalize_key(s: str | None) -> str:
    return (s or "").strip().lower().replace("_", " ").replace("-", " ")

def _ensure_industry(name: str) -> Industry | None:
    n = _normalize(name)
    if not n:
        return None
    ind = (
        db.session.query(Industry)
        .filter(Industry.name.ilike(n))
        .first()
    )
    if not ind:
        ind = Industry(name=n, is_active=True)
        db.session.add(ind)
        db.session.flush()
    return ind

def _ensure_stage(name: str) -> Stage | None:
    n = _normalize(name)
    if not n:
        return None

    st = (
        db.session.query(Stage)
        .filter(Stage.name.ilike(n))
        .first()
    )
    if st:
        return st

    k = _normalize_key(n)
    order = _STAGE_ORDER.get(k)
    if order is None:
        order = max(_STAGE_ORDER.values(), default=0) + 1

    st = Stage(
        name=n,
        description=None,
        order_sequence=order,
        stage_type="both",
        is_active=True,
    )
    db.session.add(st)
    db.session.flush()
    return st


# --------------------- Startup browsing ---------------------

@investor_bp.route("/startups", methods=["GET"])
def browse_startups():
    """
    List startups (Enterprise.type in ['startup', 'both']).
    Filters:
      ?industry=<name>
      ?stage=<name>
      ?q=<substring in enterprise name>
      ?page=1&per_page=20
    """
    try:
        user, _, err = require_auth()
        if err:
            return err

        page = request.args.get("page", 1, type=int)
        per_page = min(request.args.get("per_page", 20, type=int), 100)
        industry_name = request.args.get("industry")
        stage_name = request.args.get("stage")
        q = request.args.get("q")

        query = (
            db.session.query(Enterprise, EnterpriseProfile)
            .outerjoin(EnterpriseProfile, EnterpriseProfile.enterprise_id == Enterprise.id)
            .filter(Enterprise.enterprise_type.in_(["startup", "both"]))
        )

        if q:
            query = query.filter(Enterprise.name.ilike(f"%{q}%"))
        if industry_name:
            query = query.join(Industry, Industry.id == EnterpriseProfile.industry_id).filter(
                Industry.name.ilike(f"%{industry_name}%")
            )
        if stage_name:
            query = query.join(Stage, Stage.id == EnterpriseProfile.stage_id).filter(
                Stage.name == stage_name
            )

        query = query.order_by(Enterprise.created_at.desc())
        total, pages, items = _paginate(query, page, per_page)

        startups = [_enterprise_brief(e, p) for (e, p) in items]
        return jsonify({
            "startups": startups,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": pages,
                "has_next": page < pages,
                "has_prev": page > 1,
            },
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --------------------- Match recommendations (MatchScore) ---------------------

@investor_bp.route("/matches", methods=["GET"])
def get_match_recommendations():
    """
    Return matches for all investor enterprises the user belongs to,
    ordered by overall_score desc.
    """
    try:
        user, _, err = require_auth()
        if err:
            return err

        investor_eids = _user_investor_enterprise_ids(user)
        if not investor_eids:
            return jsonify({"matches": []}), 200

        matches = (
            db.session.query(MatchScore)
            .filter(MatchScore.investor_enterprise_id.in_(investor_eids))
            .order_by(MatchScore.overall_score.desc().nullslast())
            .all()
        )

        results = []
        if matches:
            startup_ids = list({m.startup_enterprise_id for m in matches})
            e_map = {e.id: e for e in db.session.query(Enterprise).filter(Enterprise.id.in_(startup_ids)).all()}
            p_map = {p.enterprise_id: p for p in db.session.query(EnterpriseProfile).filter(
                EnterpriseProfile.enterprise_id.in_(startup_ids)
            ).all()}

            for m in matches:
                se = e_map.get(m.startup_enterprise_id)
                sp = p_map.get(m.startup_enterprise_id)
                results.append({
                    "match_id": str(m.id),
                    "startup": _enterprise_brief(se, sp) if se else {"id": str(m.startup_enterprise_id)},
                    "scores": {
                        "overall": float(m.overall_score or 0),
                        "fit": float(m.fit_score or 0),
                        "compatibility": float(m.compatibility_score or 0),
                    },
                    "score_breakdown": m.score_breakdown or {},
                    "calculated_at": m.calculated_at.isoformat() if m.calculated_at else None,
                })

        return jsonify({"matches": results}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --------------------- Like / Unlike (via MatchInteraction) ---------------------

@investor_bp.route("/startups/<uuid:enterprise_id>/like", methods=["POST"])
def like_startup(enterprise_id):
    """
    Record a 'like' interaction for the match between one of the user's investor
    enterprises and the given startup enterprise. Requires an existing MatchScore.
    """
    try:
        user, _, err = require_auth()
        if err:
            return err

        investor_eids = _user_investor_enterprise_ids(user)
        if not investor_eids:
            return jsonify({"error": "No investor organization membership found"}), 403

        match = db.session.query(MatchScore).filter(
            MatchScore.investor_enterprise_id.in_(investor_eids),
            MatchScore.startup_enterprise_id == enterprise_id,
        ).first()
        if not match:
            return jsonify({"error": "No match found for this startup. Generate matches first."}), 404

        existing = db.session.query(MatchInteraction).filter_by(
            match_id=match.id, user_id=user.id, interaction_type="like"
        ).first()
        if existing:
            return jsonify({"message": "Already liked"}), 200

        mi = MatchInteraction(
            match_id=match.id,
            user_id=user.id,
            interaction_type="like",
            interaction_value={"source": "manual"},
        )
        db.session.add(mi)
        db.session.commit()
        return jsonify({"message": "Startup liked"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@investor_bp.route("/startups/<uuid:enterprise_id>/like", methods=["DELETE"])
def unlike_startup(enterprise_id):
    try:
        user, _, err = require_auth()
        if err:
            return err

        investor_eids = _user_investor_enterprise_ids(user)
        if not investor_eids:
            return jsonify({"error": "No investor organization membership found"}), 403

        match = db.session.query(MatchScore).filter(
            MatchScore.investor_enterprise_id.in_(investor_eids),
            MatchScore.startup_enterprise_id == enterprise_id,
        ).first()
        if not match:
            return jsonify({"error": "No like found (no match)"}), 404

        likes = db.session.query(MatchInteraction).filter_by(
            match_id=match.id, user_id=user.id, interaction_type="like"
        ).all()
        if not likes:
            return jsonify({"message": "Not previously liked"}), 404

        for l in likes:
            db.session.delete(l)
        db.session.commit()
        return jsonify({"message": "Startup unliked"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# --------------------- Express Interest (via MatchInteraction) ---------------------

@investor_bp.route("/matches/<uuid:match_id>/interest", methods=["POST"])
def express_interest_in_startup(match_id):
    """
    Body: { "interest": "interested" | "not_interested" }
    Writes a MatchInteraction with interaction_type="investment_interest".
    """
    try:
        user, _, err = require_auth()
        if err:
            return err

        match = db.session.get(MatchScore, match_id)
        if not match:
            return jsonify({"error": "Match not found"}), 404

        investor_eids = _user_investor_enterprise_ids(user)
        if match.investor_enterprise_id not in set(investor_eids):
            return jsonify({"error": "Unauthorized for this match"}), 403

        decision = (request.get_json() or {}).get("interest")
        if decision not in {"interested", "not_interested"}:
            return jsonify({"error": "Invalid interest value"}), 400

        mi = MatchInteraction(
            match_id=match.id,
            user_id=user.id,
            interaction_type="investment_interest",
            interaction_value={"decision": decision},
        )
        db.session.add(mi)
        db.session.commit()

        return jsonify({"message": "Interest recorded"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# --------------------- Dashboard Stats ---------------------

@investor_bp.route("/dashboard/stats", methods=["GET"])
def investor_dashboard():
    try:
        user, _, err = require_auth()
        if err:
            return err

        investor_eids = _user_investor_enterprise_ids(user)
        if not investor_eids:
            return jsonify({"stats": {
                "total_matches": 0,
                "likes": 0,
                "interested": 0,
                "not_interested": 0,
                "accept_rate": 0.0,
            }}), 200

        total_matches = db.session.query(MatchScore).filter(
            MatchScore.investor_enterprise_id.in_(investor_eids)
        ).count()

        likes = (
            db.session.query(func.count(MatchInteraction.id))
            .join(MatchScore, MatchInteraction.match_id == MatchScore.id)
            .filter(
                MatchScore.investor_enterprise_id.in_(investor_eids),
                MatchInteraction.user_id == user.id,
                MatchInteraction.interaction_type == "like",
            )
            .scalar() or 0
        )

        interested = (
            db.session.query(func.count(MatchInteraction.id))
            .join(MatchScore, MatchInteraction.match_id == MatchScore.id)
            .filter(
                MatchScore.investor_enterprise_id.in_(investor_eids),
                MatchInteraction.user_id == user.id,
                MatchInteraction.interaction_type == "investment_interest",
                MatchInteraction.interaction_value["decision"].astext == "interested",
            )
            .scalar() or 0
        )
        not_interested = (
            db.session.query(func.count(MatchInteraction.id))
            .join(MatchScore, MatchInteraction.match_id == MatchScore.id)
            .filter(
                MatchScore.investor_enterprise_id.in_(investor_eids),
                MatchInteraction.user_id == user.id,
                MatchInteraction.interaction_type == "investment_interest",
                MatchInteraction.interaction_value["decision"].astext == "not_interested",
            )
            .scalar() or 0
        )

        accept_rate = round((interested / total_matches * 100.0), 2) if total_matches else 0.0

        return jsonify({
            "stats": {
                "total_matches": total_matches,
                "likes": likes,
                "interested": interested,
                "not_interested": not_interested,
                "accept_rate": accept_rate,
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --------------------- Investor Profile ---------------------
# InvestorProfile is tied to an Enterprise (owner org). Client does not send enterprise_id.

@investor_bp.route("/profile", methods=["POST"])
def upsert_investor_profile():
    try:
        user, _, err = require_auth()
        if err:
            return err

        data = request.get_json(silent=True) or {}

        # 1) Owner enterprise
        eu = (
            db.session.query(EnterpriseUser)
            .filter_by(user_id=user.id, role="owner", is_active=True)
            .first()
        )
        if not eu:
            return jsonify({"error": "No enterprise ownership found for user"}), 400

        ent = db.session.get(Enterprise, eu.enterprise_id)
        if not ent:
            return jsonify({"error": "Owner enterprise not found"}), 404

        # Ensure correct enterprise type
        if ent.enterprise_type not in ("investor", "both"):
            ent.enterprise_type = "investor"

        # 2) Ensure InvestorProfile
        ip = db.session.query(InvestorProfile).filter_by(enterprise_id=ent.id).first()
        if not ip:
            ip = InvestorProfile(enterprise_id=ent.id)
            db.session.add(ip)
            db.session.flush()  # get ip.id

        # 3) Upsert InvestmentPreferences (min/max + criteria only)
        pref = (
            db.session.query(InvestmentPreferences)
            .filter_by(investor_profile_id=ip.id)
            .first()
        )
        if not pref:
            pref = InvestmentPreferences(investor_profile_id=ip.id)
            db.session.add(pref)

        pref.min_deal_size = _to_decimal(data.get("investment_range_min"))
        pref.max_deal_size = _to_decimal(data.get("investment_range_max"))
        pref.investment_criteria = {
            **(pref.investment_criteria or {}),
            "accredited_status": bool(data.get("accredited_status")),
            "investor_type": data.get("investor_type"),
            "risk_tolerance": data.get("risk_tolerance"),
            "portfolio_size": data.get("portfolio_size"),
            "advisory_availability": bool(data.get("advisory_availability")),
            "communication_frequency": data.get("communication_frequency"),
            "meeting_preference": data.get("meeting_preference"),
        }

        # 4) Sync industries (ensure lookups, then M2M)
        if "industries" in data:
            db.session.query(InvestorIndustry).filter_by(investor_profile_id=ip.id).delete(synchronize_session=False)
            added_inds = set()
            for name in _dedup_names(_to_str_list(data.get("industries"))):
                ind = _ensure_industry(name)
                if ind and ind.id not in added_inds:
                    db.session.add(InvestorIndustry(investor_profile_id=ip.id, industry_id=ind.id))
                    added_inds.add(ind.id)

        # 5) Sync stages (ensure lookups, then M2M)
        stage_names = _dedup_names(_to_str_list(data.get("investment_stages") or data.get("stages")))
        if stage_names:
            db.session.query(InvestorStage).filter_by(investor_profile_id=ip.id).delete(synchronize_session=False)
            added_stages = set()
            for name in stage_names:
                st = _ensure_stage(name)
                if st and st.id not in added_stages:
                    db.session.add(InvestorStage(investor_profile_id=ip.id, stage_id=st.id))
                    added_stages.add(st.id)

        # 6) Sync geographic focus
        if "geographic_focus" in data:
            _sync_geo_focus(ip.id, data.get("geographic_focus"))

        # Optional: mark onboarding complete
        user.onboarding_completed = True

        db.session.commit()
        return jsonify({
            "message": "Investor profile saved",
            "investor_profile_id": str(ip.id),
            "enterprise_id": str(ent.id),
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to save profile: {str(e)}"}), 500


@investor_bp.route("/profile", methods=["GET"])
def get_investor_profile():
    """
    Optional query param: ?enterprise_id=<uuid>
    If omitted, returns the first investor enterprise's profile (if any) for the user.
    """
    try:
        user, _, err = require_auth()
        if err:
            return err

        enterprise_id = request.args.get("enterprise_id")
        prof = None

        if enterprise_id:
            mem = db.session.query(EnterpriseUser).filter_by(
                user_id=user.id, enterprise_id=enterprise_id, is_active=True
            ).first()
            if not mem:
                return jsonify({"error": "Not a member of this enterprise"}), 403
            prof = db.session.query(InvestorProfile).filter_by(enterprise_id=enterprise_id).first()
        else:
            investor_eids = _user_investor_enterprise_ids(user)
            if investor_eids:
                prof = db.session.query(InvestorProfile).filter(
                    InvestorProfile.enterprise_id.in_(investor_eids)
                ).first()

        if not prof:
            return jsonify({"error": "Investor profile not found"}), 404

        prefs = db.session.query(InvestmentPreferences).filter_by(investor_profile_id=prof.id).first()

        # Names & IDs from M2M (normalized)
        ind_rows = (
            db.session.query(Industry.id, Industry.name)
            .join(InvestorIndustry, InvestorIndustry.industry_id == Industry.id)
            .filter(InvestorIndustry.investor_profile_id == prof.id)
            .all()
        )
        stg_rows = (
            db.session.query(Stage.id, Stage.name)
            .join(InvestorStage, InvestorStage.stage_id == Stage.id)
            .filter(InvestorStage.investor_profile_id == prof.id)
            .all()
        )
        geo_rows = (
            db.session.query(GeographicArea.id, GeographicArea.name)
            .join(InvestorGeographicFocus, InvestorGeographicFocus.geographic_area_id == GeographicArea.id)
            .filter(InvestorGeographicFocus.investor_profile_id == prof.id)
            .all()
        )

        industries_ids = [str(i) for (i, _) in ind_rows]
        stages_ids = [str(s) for (s, _) in stg_rows]
        geographic_focus = [g for (_, g) in geo_rows]

        return jsonify({
            "profile": {
                "id": str(prof.id),
                "enterprise_id": str(prof.enterprise_id),
                "investment_thesis": prof.investment_thesis,
                "min_investment": float(prof.min_investment or 0),
                "max_investment": float(prof.max_investment or 0),
                "typical_check_size": float(prof.typical_check_size or 0),
                "years_experience": prof.years_experience,
                "total_investments": prof.total_investments,
                "successful_exits": prof.successful_exits,
                "portfolio_companies": prof.portfolio_companies or [],
                "investment_approach": prof.investment_approach,
                "value_add_services": prof.value_add_services or [],
                # Normalized lists (names)
                "geographic_focus": geographic_focus,
                "industries": [n for (_, n) in ind_rows],
                "investment_stages": [n for (_, n) in stg_rows],
                # Also return IDs for convenience
                "industries_ids": industries_ids,
                "stages_ids": stages_ids,
                "preferences": {
                    "min_deal_size": float(prefs.min_deal_size or 0) if prefs else None,
                    "max_deal_size": float(prefs.max_deal_size or 0) if prefs else None,
                    "investment_criteria": (prefs.investment_criteria if prefs else {}),
                    "exclusion_criteria": (prefs.exclusion_criteria if prefs else {}),
                    "due_diligence_requirements": (prefs.due_diligence_requirements if prefs else {}),
                    "decision_timeline_days": (prefs.decision_timeline_days if prefs else None),
                    "follow_on_strategy": (prefs.follow_on_strategy if prefs else None),
                },
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@investor_bp.route("/profile", methods=["PATCH"])
def update_investor_profile():
    try:
        user, _, err = require_auth()
        if err:
            return err

        data = request.get_json() or {}
        enterprise_id = data.get("enterprise_id")
        if not enterprise_id:
            return jsonify({"error": "enterprise_id is required"}), 400

        mem = db.session.query(EnterpriseUser).filter_by(
            user_id=user.id, enterprise_id=enterprise_id, is_active=True
        ).first()
        if not mem or mem.role not in ("owner", "admin"):
            return jsonify({"error": "Owner/admin membership required"}), 403

        prof = db.session.query(InvestorProfile).filter_by(enterprise_id=enterprise_id).first()
        if not prof:
            return jsonify({"error": "Investor profile not found"}), 404

        # simple fields
        for f in [
            "investment_thesis", "min_investment", "max_investment", "typical_check_size",
            "years_experience", "total_investments", "successful_exits", "portfolio_companies",
            "investment_approach", "value_add_services",
        ]:
            if f in data:
                setattr(prof, f, data.get(f))

        # preferences
        prefs_data = data.get("preferences")
        if prefs_data is not None:
            prefs = db.session.query(InvestmentPreferences).filter_by(investor_profile_id=prof.id).first()
            if not prefs:
                prefs = InvestmentPreferences(investor_profile_id=prof.id)
                db.session.add(prefs)
            for f in [
                "min_deal_size", "max_deal_size", "investment_criteria", "exclusion_criteria",
                "due_diligence_requirements", "decision_timeline_days", "follow_on_strategy",
            ]:
                if f in prefs_data:
                    setattr(prefs, f, prefs_data.get(f))

        # reset & set industries (optional) - ensure lookups
        if "industries" in data:
            db.session.query(InvestorIndustry).filter_by(investor_profile_id=prof.id).delete(synchronize_session=False)
            for ind_name in _dedup_names(_to_str_list(data.get("industries"))):
                ind = _ensure_industry(ind_name)
                if ind:
                    db.session.add(InvestorIndustry(investor_profile_id=prof.id, industry_id=ind.id))

        # reset & set stages (optional) - ensure lookups
        if "stages" in data or "investment_stages" in data:
            names = _dedup_names(_to_str_list(data.get("stages") or data.get("investment_stages")))
            db.session.query(InvestorStage).filter_by(investor_profile_id=prof.id).delete(synchronize_session=False)
            for stage_name in names:
                st = _ensure_stage(stage_name)
                if st:
                    db.session.add(InvestorStage(investor_profile_id=prof.id, stage_id=st.id))

        # reset & set geographic focus (optional)
        if "geographic_focus" in data:
            _sync_geo_focus(prof.id, data.get("geographic_focus"))

        db.session.commit()

        try:
            if LOCAL_API_BASE_URL:
                requests.post(
                    f"{LOCAL_API_BASE_URL}/api/matching/recompute",
                    json={"investor_enterprise_id": str(enterprise_id), "force": True},
                    headers={"Authorization": request.headers.get("Authorization", "")},
                    timeout=5,
                )
        except Exception:
            pass

        return jsonify({"message": "Investor profile updated"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to update profile: {str(e)}"}), 500


@investor_bp.route("/profile", methods=["DELETE"])
def delete_investor_profile():
    try:
        user, _, err = require_auth()
        if err:
            return err

        enterprise_id = (request.get_json() or {}).get("enterprise_id")
        if not enterprise_id:
            return jsonify({"error": "enterprise_id is required"}), 400

        mem = db.session.query(EnterpriseUser).filter_by(
            user_id=user.id, enterprise_id=enterprise_id, is_active=True
        ).first()
        if not mem or mem.role not in ("owner", "admin"):
            return jsonify({"error": "Owner/admin membership required"}), 403

        prof = db.session.query(InvestorProfile).filter_by(enterprise_id=enterprise_id).first()
        if not prof:
            return jsonify({"error": "Investor profile not found"}), 404

        # cascade manually for M2M rows
        db.session.query(InvestorIndustry).filter_by(investor_profile_id=prof.id).delete(synchronize_session=False)
        db.session.query(InvestorStage).filter_by(investor_profile_id=prof.id).delete(synchronize_session=False)
        db.session.query(InvestorGeographicFocus).filter_by(investor_profile_id=prof.id).delete(synchronize_session=False)
        db.session.query(InvestmentPreferences).filter_by(investor_profile_id=prof.id).delete(synchronize_session=False)
        db.session.delete(prof)
        db.session.commit()
        return jsonify({"message": "Investor profile deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete profile: {str(e)}"}), 500


# --------------------- Admin: list all investors ---------------------

@investor_bp.route("/admin/investors", methods=["GET"])
def list_all_investors():
    try:
        user, _, err = require_auth()
        if err:
            return err

        if not _is_admin_like(user):
            return jsonify({"error": "Admin access required"}), 403

        page = request.args.get("page", 1, type=int)
        per_page = min(request.args.get("per_page", 20, type=int), 100)

        base_q = db.session.query(InvestorProfile)
        total = base_q.count()
        items = (
            base_q
            .order_by(InvestorProfile.created_at.desc())
            .limit(per_page)
            .offset((page - 1) * per_page)
            .all()
        )
        pages = (total + per_page - 1) // per_page if per_page else 1

        result_items = []
        if items:
            e_ids = [p.enterprise_id for p in items]
            e_map = {e.id: e for e in db.session.query(Enterprise).filter(Enterprise.id.in_(e_ids)).all()}
            p_map = {p.enterprise_id: p for p in db.session.query(EnterpriseProfile).filter(
                EnterpriseProfile.enterprise_id.in_(e_ids)
            ).all()}

            for p in items:
                ent = e_map.get(p.enterprise_id)
                pro = p_map.get(p.enterprise_id)
                result_items.append({
                    "id": str(p.id),
                    "enterprise": _enterprise_brief(ent, pro) if ent else {"id": str(p.enterprise_id)},
                    "min_investment": float(p.min_investment or 0),
                    "max_investment": float(p.max_investment or 0),
                    "typical_check_size": float(p.typical_check_size or 0),
                    "years_experience": p.years_experience,
                    "total_investments": p.total_investments,
                    "successful_exits": p.successful_exits,
                })

        return jsonify({
            "investors": result_items,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": pages,
                "has_next": page < pages,
                "has_prev": page > 1,
            },
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500