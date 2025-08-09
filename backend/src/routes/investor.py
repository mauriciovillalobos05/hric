# src/routes/investor.py

from datetime import datetime
import os
import requests

from flask import Blueprint, request, jsonify
from sqlalchemy import func

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

investor_bp = Blueprint("investor", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")


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

    user = User.query.get(user_id)
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

        pagination = query.order_by(Enterprise.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        items = [_enterprise_brief(e, p) for (e, p) in pagination.items]
        return jsonify({
            "startups": items,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": pagination.total,
                "pages": pagination.pages,
                "has_next": pagination.has_next,
                "has_prev": pagination.has_prev,
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
            MatchScore.query
            .filter(MatchScore.investor_enterprise_id.in_(investor_eids))
            .order_by(MatchScore.overall_score.desc().nullslast())
            .all()
        )

        results = []
        # hydrate startup enterprise + profile
        if matches:
            startup_ids = list({m.startup_enterprise_id for m in matches})
            e_map = {e.id: e for e in Enterprise.query.filter(Enterprise.id.in_(startup_ids)).all()}
            p_map = {p.enterprise_id: p for p in EnterpriseProfile.query.filter(
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

        match = (
            MatchScore.query
            .filter(
                MatchScore.investor_enterprise_id.in_(investor_eids),
                MatchScore.startup_enterprise_id == enterprise_id,
            )
            .first()
        )
        if not match:
            return jsonify({"error": "No match found for this startup. Generate matches first."}), 404

        existing = MatchInteraction.query.filter_by(
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

        match = (
            MatchScore.query
            .filter(
                MatchScore.investor_enterprise_id.in_(investor_eids),
                MatchScore.startup_enterprise_id == enterprise_id,
            )
            .first()
        )
        if not match:
            return jsonify({"error": "No like found (no match)"}), 404

        likes = MatchInteraction.query.filter_by(
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

        match = MatchScore.query.get(match_id)
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

        total_matches = MatchScore.query.filter(
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

        # count interest decisions
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
# In this schema, InvestorProfile is tied to an Enterprise, not directly to a User.
# The caller should provide enterprise_id where the user has owner/admin membership.

@investor_bp.route("/profile", methods=["POST"])
def create_investor_profile():
    try:
        user, _, err = require_auth()
        if err:
            return err

        data = request.get_json() or {}
        enterprise_id = data.get("enterprise_id")
        if not enterprise_id:
            return jsonify({"error": "enterprise_id is required"}), 400

        # require owner/admin membership
        mem = EnterpriseUser.query.filter_by(user_id=user.id, enterprise_id=enterprise_id, is_active=True).first()
        if not mem or mem.role not in ("owner", "admin"):
            return jsonify({"error": "Owner/admin membership required for this enterprise"}), 403

        ent = Enterprise.query.get(enterprise_id)
        if not ent or ent.enterprise_type not in ("investor", "both"):
            return jsonify({"error": "Enterprise must be of type investor/both"}), 400

        if InvestorProfile.query.filter_by(enterprise_id=enterprise_id).first():
            return jsonify({"error": "Investor profile already exists for this enterprise"}), 400

        prof = InvestorProfile(
            enterprise_id=enterprise_id,
            investment_thesis=data.get("investment_thesis"),
            min_investment=data.get("min_investment"),
            max_investment=data.get("max_investment"),
            typical_check_size=data.get("typical_check_size"),
            years_experience=data.get("years_experience"),
            total_investments=data.get("total_investments", 0),
            successful_exits=data.get("successful_exits", 0),
            portfolio_companies=data.get("portfolio_companies", []),
            investment_approach=data.get("investment_approach"),
            value_add_services=data.get("value_add_services", []),
            geographic_focus=data.get("geographic_focus", []),
        )
        db.session.add(prof)
        db.session.flush()  # get prof.id

        # Optional InvestmentPreferences
        prefs = data.get("preferences", {})
        if prefs:
            ip = InvestmentPreferences(
                investor_profile_id=prof.id,
                preferred_industries=prefs.get("preferred_industries", []),
                preferred_stages=prefs.get("preferred_stages", []),
                geographic_preferences=prefs.get("geographic_preferences", []),
                min_deal_size=prefs.get("min_deal_size"),
                max_deal_size=prefs.get("max_deal_size"),
                investment_criteria=prefs.get("investment_criteria", {}),
                exclusion_criteria=prefs.get("exclusion_criteria", {}),
                due_diligence_requirements=prefs.get("due_diligence_requirements", {}),
                decision_timeline_days=prefs.get("decision_timeline_days"),
                follow_on_strategy=prefs.get("follow_on_strategy"),
            )
            db.session.add(ip)

        # Normalize industries by name list (optional)
        for ind_name in data.get("industries", []):
            ind = Industry.query.filter(Industry.name.ilike(ind_name)).first()
            if ind:
                db.session.add(InvestorIndustry(investor_profile_id=prof.id, industry_id=ind.id))

        # Normalize stages by name list (optional)
        for stage_name in data.get("stages", []):
            st = Stage.query.filter(Stage.name == stage_name).first()
            if st:
                db.session.add(InvestorStage(investor_profile_id=prof.id, stage_id=st.id))

        db.session.commit()
        return jsonify({"message": "Investor profile created", "investor_profile_id": str(prof.id)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create profile: {str(e)}"}), 500


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
            mem = EnterpriseUser.query.filter_by(user_id=user.id, enterprise_id=enterprise_id, is_active=True).first()
            if not mem:
                return jsonify({"error": "Not a member of this enterprise"}), 403
            prof = InvestorProfile.query.filter_by(enterprise_id=enterprise_id).first()
        else:
            # fallback: first investor enterprise membership
            investor_eids = _user_investor_enterprise_ids(user)
            if investor_eids:
                prof = InvestorProfile.query.filter(InvestorProfile.enterprise_id.in_(investor_eids)).first()

        if not prof:
            return jsonify({"error": "Investor profile not found"}), 404

        prefs = InvestmentPreferences.query.filter_by(investor_profile_id=prof.id).first()
        inds = [ii.industry_id for ii in InvestorIndustry.query.filter_by(investor_profile_id=prof.id)]
        stgs = [is_.stage_id for is_ in InvestorStage.query.filter_by(investor_profile_id=prof.id)]

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
                "geographic_focus": prof.geographic_focus or [],
                "industries_ids": [str(i) for i in inds],
                "stages_ids": [str(s) for s in stgs],
                "preferences": {
                    "min_deal_size": float(prefs.min_deal_size or 0) if prefs else None,
                    "max_deal_size": float(prefs.max_deal_size or 0) if prefs else None,
                    "preferred_industries": (prefs.preferred_industries if prefs else []),
                    "preferred_stages": (prefs.preferred_stages if prefs else []),
                    "geographic_preferences": (prefs.geographic_preferences if prefs else []),
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

        mem = EnterpriseUser.query.filter_by(user_id=user.id, enterprise_id=enterprise_id, is_active=True).first()
        if not mem or mem.role not in ("owner", "admin"):
            return jsonify({"error": "Owner/admin membership required"}), 403

        prof = InvestorProfile.query.filter_by(enterprise_id=enterprise_id).first()
        if not prof:
            return jsonify({"error": "Investor profile not found"}), 404

        # simple fields
        for f in [
            "investment_thesis", "min_investment", "max_investment", "typical_check_size",
            "years_experience", "total_investments", "successful_exits", "portfolio_companies",
            "investment_approach", "value_add_services", "geographic_focus",
        ]:
            if f in data:
                setattr(prof, f, data.get(f))

        # preferences
        prefs_data = data.get("preferences")
        if prefs_data is not None:
            prefs = InvestmentPreferences.query.filter_by(investor_profile_id=prof.id).first()
            if not prefs:
                prefs = InvestmentPreferences(investor_profile_id=prof.id)
                db.session.add(prefs)
            for f in [
                "preferred_industries", "preferred_stages", "geographic_preferences", "min_deal_size",
                "max_deal_size", "investment_criteria", "exclusion_criteria",
                "due_diligence_requirements", "decision_timeline_days", "follow_on_strategy",
            ]:
                if f in prefs_data:
                    setattr(prefs, f, prefs_data.get(f))

        # reset & set industries (optional)
        if "industries" in data:
            InvestorIndustry.query.filter_by(investor_profile_id=prof.id).delete(synchronize_session=False)
            for ind_name in (data.get("industries") or []):
                ind = Industry.query.filter(Industry.name.ilike(ind_name)).first()
                if ind:
                    db.session.add(InvestorIndustry(investor_profile_id=prof.id, industry_id=ind.id))

        # reset & set stages (optional)
        if "stages" in data:
            InvestorStage.query.filter_by(investor_profile_id=prof.id).delete(synchronize_session=False)
            for stage_name in (data.get("stages") or []):
                st = Stage.query.filter(Stage.name == stage_name).first()
                if st:
                    db.session.add(InvestorStage(investor_profile_id=prof.id, stage_id=st.id))

        db.session.commit()
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

        mem = EnterpriseUser.query.filter_by(user_id=user.id, enterprise_id=enterprise_id, is_active=True).first()
        if not mem or mem.role not in ("owner", "admin"):
            return jsonify({"error": "Owner/admin membership required"}), 403

        prof = InvestorProfile.query.filter_by(enterprise_id=enterprise_id).first()
        if not prof:
            return jsonify({"error": "Investor profile not found"}), 404

        # cascade manually for M2M rows
        InvestorIndustry.query.filter_by(investor_profile_id=prof.id).delete(synchronize_session=False)
        InvestorStage.query.filter_by(investor_profile_id=prof.id).delete(synchronize_session=False)
        InvestmentPreferences.query.filter_by(investor_profile_id=prof.id).delete(synchronize_session=False)
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

        pagination = InvestorProfile.query.paginate(page=page, per_page=per_page, error_out=False)
        items = []
        if pagination.items:
            # fetch related enterprise & prefs quickly
            e_ids = [p.enterprise_id for p in pagination.items]
            e_map = {e.id: e for e in Enterprise.query.filter(Enterprise.id.in_(e_ids)).all()}
            p_map = {p.enterprise_id: p for p in EnterpriseProfile.query.filter(
                EnterpriseProfile.enterprise_id.in_(e_ids)
            ).all()}

            for p in pagination.items:
                ent = e_map.get(p.enterprise_id)
                pro = p_map.get(p.enterprise_id)
                items.append({
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
            "investors": items,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": pagination.total,
                "pages": pagination.pages,
                "has_next": pagination.has_next,
                "has_prev": pagination.has_prev,
            },
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500