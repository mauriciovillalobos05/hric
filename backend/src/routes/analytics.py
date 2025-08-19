# src/routes/analytics.py

import os
import json
from datetime import datetime, timedelta

import requests
from flask import Blueprint, jsonify, request
from sqlalchemy import func, extract
from src.extensions import db
from src.models.user import (
    # core
    User, Enterprise, EnterpriseUser,
    # profiles / lookups
    EnterpriseProfile, Industry, Stage,
    # matching
    MatchScore, MatchInteraction,
    # events & docs & comms
    Event, Document, Messaging,
    # subs
    Subscription, UserPlan,
    # optional
    MarketRecommendation
)

analytics_bp = Blueprint("analytics", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
LOCAL_API_BASE_URL = os.getenv("LOCAL_API_BASE_URL", "").rstrip("/")


# ----------------------------
# Helpers
# ----------------------------
def require_auth():
    """
    Validate Supabase JWT and return (user, token, error_response, status_code).
    All route handlers should unpack in that order.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, None, jsonify({"error": "Missing or invalid Authorization header"}), 401

    token = auth_header.split(" ", 1)[1].strip()
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
            timeout=8,
        )
        if resp.status_code != 200:
            return None, None, jsonify({"error": "Invalid or expired token"}), 401
        supabase_user = resp.json()
        user_id = supabase_user.get("id")
        if not user_id:
            return None, None, jsonify({"error": "Token missing user id"}), 401
    except Exception as e:
        return None, None, jsonify({"error": f"Token verification failed: {str(e)}"}), 500

    user = User.query.get(user_id)
    if not user:
        return None, None, jsonify({"error": "User not found in database"}), 404

    return user, token, None, None


def call_local_ai(prompt: str, temperature: float = 0.2, max_tokens: int = 600) -> str | None:
    """
    Optional: call your local LLM endpoint to summarize analytics.
    Expect a simple JSON API at POST {LOCAL_API_BASE_URL}/v1/generate with fields: prompt, temperature, max_tokens.
    Return string or None on failure/missing config.
    """
    if not LOCAL_API_BASE_URL:
        return None
    try:
        resp = requests.post(
            f"{LOCAL_API_BASE_URL}/v1/generate",
            json={"prompt": prompt, "temperature": temperature, "max_tokens": max_tokens},
            timeout=20,
        )
        if resp.status_code == 200:
            data = resp.json()
            # Accept common keys: "text" or "content"
            return data.get("text") or data.get("content")
    except Exception:
        pass
    return None


# ----------------------------
# /dashboard
# ----------------------------
@analytics_bp.route("/dashboard", methods=["GET"])
def get_dashboard_analytics():
    """Get comprehensive dashboard analytics aligned to current schema."""
    try:
        user, token, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        now = datetime.utcnow()
        thirty_days_ago = now - timedelta(days=30)

        # Platform overview
        total_users = User.query.filter_by(is_active=True).count()
        total_investor_orgs = Enterprise.query.filter(
            Enterprise.enterprise_type.in_(["investor", "both"])
        ).count()
        total_startup_orgs = Enterprise.query.filter(
            Enterprise.enterprise_type.in_(["startup", "both"])
        ).count()
        total_matches = MatchScore.query.count()
        active_matches = MatchScore.query.filter_by(is_active=True).count()
        interested_interactions = MatchInteraction.query.filter(
            MatchInteraction.interaction_type == "investment_interest"
        ).count()

        # Recent activity
        new_users = User.query.filter(User.created_at >= thirty_days_ago).count()
        new_matches = MatchScore.query.filter(
            MatchScore.calculated_at >= thirty_days_ago
        ).count()
        recent_events = Event.query.filter(Event.created_at >= thirty_days_ago).count()

        # User-specific analytics
        user_analytics = {}
        enterprise_ids = [eu.enterprise_id for eu in user.enterprise_memberships if eu.is_active]

        investor_ids, startup_ids = [], []
        if enterprise_ids:
            investor_ids = [
                e.id for e in Enterprise.query.filter(
                    Enterprise.id.in_(enterprise_ids),
                    Enterprise.enterprise_type.in_(["investor", "both"])
                )
            ]
            startup_ids = [
                e.id for e in Enterprise.query.filter(
                    Enterprise.id.in_(enterprise_ids),
                    Enterprise.enterprise_type.in_(["startup", "both"])
                )
            ]

        if investor_ids:
            inv_total = MatchScore.query.filter(MatchScore.investor_enterprise_id.in_(investor_ids)).count()
            inv_interest = db.session.query(func.count(MatchInteraction.id)).join(
                MatchScore, MatchInteraction.match_id == MatchScore.id
            ).filter(
                MatchScore.investor_enterprise_id.in_(investor_ids),
                MatchInteraction.interaction_type == "investment_interest"
            ).scalar() or 0
            user_analytics["investor_view"] = {
                "total_matches": inv_total,
                "expressed_interest": inv_interest,
            }

        if startup_ids:
            st_total = MatchScore.query.filter(MatchScore.startup_enterprise_id.in_(startup_ids)).count()
            st_interest = db.session.query(func.count(MatchInteraction.id)).join(
                MatchScore, MatchInteraction.match_id == MatchScore.id
            ).filter(
                MatchScore.startup_enterprise_id.in_(startup_ids),
                MatchInteraction.interaction_type == "investment_interest"
            ).scalar() or 0
            user_analytics["startup_view"] = {
                "total_matches": st_total,
                "investor_interest": st_interest,
            }

        # Events
        upcoming_events = Event.query.filter(
            Event.start_time >= now,
            Event.status.in_(["planned", "open_registration", "in_progress"])
        ).count()
        my_created_events = Event.query.filter(Event.created_by == user.id).count()

        data = {
            "platform_overview": {
                "total_users": total_users,
                "investor_organizations": total_investor_orgs,
                "startup_organizations": total_startup_orgs,
                "total_matches": total_matches,
                "active_matches": active_matches,
                "expressed_investment_interest": interested_interactions,
            },
            "recent_activity": {
                "new_users_30d": new_users,
                "new_matches_30d": new_matches,
                "new_events_30d": recent_events,
            },
            "user_analytics": user_analytics,
            "events": {
                "upcoming_events": upcoming_events,
                "events_created_by_me": my_created_events,
            },
        }

        return jsonify({"dashboard": data}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# /platform-stats
# ----------------------------
@analytics_bp.route("/platform-stats", methods=["GET"])
def get_platform_statistics():
    """Get comprehensive platform statistics aligned to current schema."""
    try:
        user, token, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        now = datetime.utcnow()

        # Users
        user_stats = {
            "total": User.query.count(),
            "active": User.query.filter_by(is_active=True).count(),
            "onboarding_completed": User.query.filter_by(onboarding_completed=True).count(),
        }

        # Subscriptions
        subs_by_status = db.session.query(
            Subscription.status,
            func.count(Subscription.id)
        ).group_by(Subscription.status).all()

        subs_by_plan = db.session.query(
            UserPlan.name,
            func.count(Subscription.id)
        ).join(Subscription, Subscription.user_plan_id == UserPlan.id
        ).group_by(UserPlan.name).all()

        subscription_stats = {
            "by_status": [{"status": s, "count": c} for (s, c) in subs_by_status],
            "by_plan": [{"plan": p, "count": c} for (p, c) in subs_by_plan],
        }

        # Matching
        avg_overall = db.session.query(func.avg(MatchScore.overall_score)).scalar() or 0
        matching_stats = {
            "total_matches": MatchScore.query.count(),
            "active_matches": MatchScore.query.filter_by(is_active=True).count(),
            "avg_overall_score": float(round(avg_overall, 4)),
            "interactions_last_30d": MatchInteraction.query.filter(
                MatchInteraction.created_at >= (now - timedelta(days=30))
            ).count(),
        }

        # Industries (via EnterpriseProfile)
        industry_rows = db.session.query(
            Industry.name,
            func.count(EnterpriseProfile.enterprise_id)
        ).join(EnterpriseProfile, EnterpriseProfile.industry_id == Industry.id
        ).group_by(Industry.name).order_by(func.count(EnterpriseProfile.enterprise_id).desc()).limit(10).all()
        industries = [{"industry": i or "Unspecified", "count": c} for (i, c) in industry_rows]

        # Stages
        stage_rows = db.session.query(
            Stage.name,
            func.count(EnterpriseProfile.enterprise_id)
        ).join(EnterpriseProfile, EnterpriseProfile.stage_id == Stage.id
        ).group_by(Stage.name).all()
        stages = [{"stage": s or "Unspecified", "count": c} for (s, c) in stage_rows]

        # Events
        event_stats = {
            "total_events": Event.query.count(),
            "upcoming_events": Event.query.filter(Event.start_time >= now).count(),
            "completed_events": Event.query.filter_by(status="completed").count(),
        }

        # Documents
        document_stats = {
            "total_documents": Document.query.count(),
            "public": Document.query.filter_by(access_level="public").count(),
            "enterprise_only": Document.query.filter_by(access_level="enterprise").count(),
            "private": Document.query.filter_by(access_level="private").count(),
            "confidential": Document.query.filter_by(access_level="confidential").count(),
        }

        # Messaging
        message_stats = {
            "total_messages": Messaging.query.count(),
            "unread_messages": Messaging.query.filter_by(is_read=False).count(),
        }

        platform_stats = {
            "users": user_stats,
            "subscriptions": subscription_stats,
            "matching": matching_stats,
            "industries": industries,
            "stages": stages,
            "events": event_stats,
            "documents": document_stats,
            "messages": message_stats,
        }

        return jsonify({"platform_stats": platform_stats}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# /growth-metrics
# ----------------------------
@analytics_bp.route("/growth-metrics", methods=["GET"])
def get_growth_metrics():
    """Get platform growth metrics over time (monthly by default)."""
    try:
        user, token, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        period = request.args.get("period", "monthly")  # currently supports 'monthly'
        months_back = request.args.get("months_back", 12, type=int)
        start_date = datetime.utcnow() - timedelta(days=months_back * 30)

        users_growth = []
        matches_growth = []

        if period == "monthly":
            users_growth = db.session.query(
                extract("year", User.created_at).label("year"),
                extract("month", User.created_at).label("month"),
                func.count(User.id).label("count"),
            ).filter(User.created_at >= start_date
            ).group_by(extract("year", User.created_at), extract("month", User.created_at)
            ).order_by("year", "month").all()

            matches_growth = db.session.query(
                extract("year", MatchScore.calculated_at).label("year"),
                extract("month", MatchScore.calculated_at).label("month"),
                func.count(MatchScore.id).label("count"),
            ).filter(MatchScore.calculated_at >= start_date
            ).group_by(extract("year", MatchScore.calculated_at), extract("month", MatchScore.calculated_at)
            ).order_by("year", "month").all()

        users_growth_data = [
            {"period": f"{int(y)}-{int(m):02d}", "new_users": c} for (y, m, c) in users_growth
        ]
        matches_growth_data = [
            {"period": f"{int(y)}-{int(m):02d}", "new_matches": c} for (y, m, c) in matches_growth
        ]

        def mom_rate(series, key):
            if len(series) >= 2:
                latest = series[-1][key]
                prev = series[-2][key]
                return round(((latest - prev) / prev * 100), 2) if prev > 0 else 0.0
            return 0.0

        growth_metrics = {
            "users_growth": users_growth_data,
            "matches_growth": matches_growth_data,
            "growth_rates": {
                "users_mom_pct": mom_rate(users_growth_data, "new_users"),
                "matches_mom_pct": mom_rate(matches_growth_data, "new_matches"),
            },
        }

        return jsonify({"growth_metrics": growth_metrics}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# /revenue-analytics
# ----------------------------
@analytics_bp.route("/revenue-analytics", methods=["GET"])
def get_revenue_analytics():
    """Compute subscription MRR/ARR from Subscription + UserPlan; estimate event revenue."""
    try:
        user, token, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        active_statuses = ("active", "trialing")
        subs = Subscription.query.filter(Subscription.status.in_(active_statuses)).all()

        def monthly_amount(sub: Subscription) -> float:
            if not sub.amount:
                return 0.0
            freq = (sub.payment_frequency or "").lower()
            amt = float(sub.amount)
            if freq == "monthly":
                return amt
            if freq == "quarterly":
                return amt / 3.0
            if freq == "annually":
                return amt / 12.0
            return amt  # treat unknown as monthly

        total_mrr = 0.0
        by_plan = {}

        for s in subs:
            m = monthly_amount(s)
            total_mrr += m
            plan_name = "Unknown"
            if s.user_plan_id:
                plan = UserPlan.query.get(s.user_plan_id)
                if plan:
                    plan_name = plan.name
            slot = by_plan.setdefault(plan_name, {"subscribers": 0, "mrr": 0.0})
            slot["subscribers"] += 1
            slot["mrr"] += m

        arr = total_mrr * 12.0

        event_revenue = db.session.query(
            func.coalesce(func.sum(Event.ticket_price * func.coalesce(Event.current_attendees, 0)), 0)
        ).scalar() or 0.0
        event_revenue = float(event_revenue)

        revenue = {
            "mrr": round(total_mrr, 2),
            "arr": round(arr, 2),
            "by_plan": [
                {"plan": name, "subscribers": v["subscribers"], "mrr": round(v["mrr"], 2)}
                for name, v in sorted(by_plan.items())
            ],
            "estimated_event_revenue": round(event_revenue, 2),
        }

        return jsonify({"revenue_analytics": revenue}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# /engagement-metrics
# ----------------------------
@analytics_bp.route("/engagement-metrics", methods=["GET"])
def get_engagement_metrics():
    """Get user engagement metrics using last_active_at, Messaging, MatchInteraction, Document, Event."""
    try:
        user, token, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        now = datetime.utcnow()
        thirty_days_ago = now - timedelta(days=30)
        seven_days_ago = now - timedelta(days=7)

        monthly_active_users = User.query.filter(
            User.last_active_at >= thirty_days_ago,
            User.is_active.is_(True)
        ).count()

        weekly_active_users = User.query.filter(
            User.last_active_at >= seven_days_ago,
            User.is_active.is_(True)
        ).count()

        total_active_users = User.query.filter_by(is_active=True).count()

        messages_last_30d = Messaging.query.filter(Messaging.sent_at >= thirty_days_ago).count()
        active_senders = db.session.query(
            func.count(func.distinct(Messaging.sender_user_id))
        ).filter(Messaging.sent_at >= thirty_days_ago).scalar() or 0

        interactions_last_30d = MatchInteraction.query.filter(
            MatchInteraction.created_at >= thirty_days_ago
        ).count()

        events_next_30d = Event.query.filter(
            Event.start_time >= now,
            Event.start_time < (now + timedelta(days=30))
        ).count()

        documents_uploaded_last_30d = Document.query.filter(
            Document.uploaded_at >= thirty_days_ago
        ).count()

        monthly_engagement_rate = (monthly_active_users / total_active_users * 100.0) if total_active_users > 0 else 0.0
        weekly_engagement_rate = (weekly_active_users / total_active_users * 100.0) if total_active_users > 0 else 0.0

        engagement = {
            "active_users": {
                "monthly_active_users": monthly_active_users,
                "weekly_active_users": weekly_active_users,
                "total_active_users": total_active_users,
                "monthly_engagement_rate_pct": round(monthly_engagement_rate, 2),
                "weekly_engagement_rate_pct": round(weekly_engagement_rate, 2),
            },
            "activity_last_30_days": {
                "messages_sent": messages_last_30d,
                "active_senders": active_senders,
                "match_interactions": interactions_last_30d,
                "events_next_30_days": events_next_30d,
                "documents_uploaded": documents_uploaded_last_30d,
            },
            "average_activity_per_active_user": {
                "messages_per_active_user": round(messages_last_30d / monthly_active_users, 2) if monthly_active_users > 0 else 0.0,
                "interactions_per_active_user": round(interactions_last_30d / monthly_active_users, 2) if monthly_active_users > 0 else 0.0,
            },
        }

        return jsonify({"engagement_metrics": engagement}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# /user-analytics/<uuid>
# ----------------------------
@analytics_bp.route("/user-analytics/<uuid:target_user_id>", methods=["GET"])
def get_user_analytics(target_user_id):
    """Get analytics for a specific user (admin or self-service)."""
    try:
        user, token, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        target = User.query.get(target_user_id)
        if not target:
            return jsonify({"error": "User not found"}), 404

        # Enterprises they belong to
        memberships = EnterpriseUser.query.filter_by(user_id=target.id, is_active=True).all()
        enterprise_ids = [m.enterprise_id for m in memberships]
        enterprises = Enterprise.query.filter(Enterprise.id.in_(enterprise_ids)).all()

        investor_ids = [e.id for e in enterprises if e.enterprise_type in ("investor", "both")]
        startup_ids = [e.id for e in enterprises if e.enterprise_type in ("startup", "both")]

        stats_investor = {}
        if investor_ids:
            stats_investor = {
                "total_matches": MatchScore.query.filter(MatchScore.investor_enterprise_id.in_(investor_ids)).count(),
                "expressed_interest": db.session.query(func.count(MatchInteraction.id)).join(
                    MatchScore, MatchInteraction.match_id == MatchScore.id
                ).filter(
                    MatchScore.investor_enterprise_id.in_(investor_ids),
                    MatchInteraction.interaction_type == "investment_interest"
                ).scalar() or 0
            }

        stats_startup = {}
        if startup_ids:
            stats_startup = {
                "total_matches": MatchScore.query.filter(MatchScore.startup_enterprise_id.in_(startup_ids)).count(),
                "investor_interest_in_us": db.session.query(func.count(MatchInteraction.id)).join(
                    MatchScore, MatchInteraction.match_id == MatchScore.id
                ).filter(
                    MatchScore.startup_enterprise_id.in_(startup_ids),
                    MatchInteraction.interaction_type == "investment_interest"
                ).scalar() or 0
            }

        messages_sent = Messaging.query.filter_by(sender_user_id=target.id).count()
        messages_received = Messaging.query.filter_by(recipient_user_id=target.id).count()
        events_created = Event.query.filter_by(created_by=target.id).count()
        documents_uploaded = Document.query.filter_by(uploaded_by=target.id).count()

        payload = {
            "user": {
                "id": str(target.id),
                "email": target.email,
                "name": f"{target.first_name} {target.last_name}",
                "is_active": target.is_active,
                "onboarding_completed": target.onboarding_completed,
                "last_active_at": target.last_active_at.isoformat() if target.last_active_at else None,
            },
            "enterprises": [{"id": str(e.id), "name": e.name, "type": e.enterprise_type} for e in enterprises],
            "matching": {"as_investor": stats_investor, "as_startup": stats_startup},
            "communication": {
                "messages_sent": messages_sent,
                "messages_received": messages_received,
                "response_rate_pct": round((messages_sent / messages_received * 100.0), 2) if messages_received > 0 else 0.0,
            },
            "content": {
                "events_created": events_created,
                "documents_uploaded": documents_uploaded,
            },
        }

        return jsonify({"user_analytics": payload}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# /segments (extra)
# ----------------------------
@analytics_bp.route("/segments", methods=["GET"])
def get_segments():
    """Basic segmentation: counts by enterprise type, industry, stage."""
    try:
        user, token, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        by_enterprise_type = db.session.query(
            Enterprise.enterprise_type, func.count(Enterprise.id)
        ).group_by(Enterprise.enterprise_type).all()

        by_industry = db.session.query(
            Industry.name, func.count(EnterpriseProfile.enterprise_id)
        ).join(EnterpriseProfile, EnterpriseProfile.industry_id == Industry.id
        ).group_by(Industry.name).order_by(func.count(EnterpriseProfile.enterprise_id).desc()).limit(15).all()

        by_stage = db.session.query(
            Stage.name, func.count(EnterpriseProfile.enterprise_id)
        ).join(EnterpriseProfile, EnterpriseProfile.stage_id == Stage.id
        ).group_by(Stage.name).all()

        data = {
            "by_enterprise_type": [{"type": t, "count": c} for t, c in by_enterprise_type],
            "by_industry": [{"industry": i or "Unspecified", "count": c} for i, c in by_industry],
            "by_stage": [{"stage": s or "Unspecified", "count": c} for s, c in by_stage],
        }
        return jsonify({"segments": data}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# /activity-heatmap (extra)
# ----------------------------
@analytics_bp.route("/activity-heatmap", methods=["GET"])
def get_activity_heatmap():
    """
    Heatmap-style activity: messages and interactions by weekday/hour (UTC).
    Returns two matrices keyed by weekday (0=Sunday..6) and hour (0..23).
    """
    try:
        user, token, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        # Messages by weekday/hour
        msg_rows = db.session.query(
            extract("dow", Messaging.sent_at).label("dow"),
            extract("hour", Messaging.sent_at).label("hour"),
            func.count(Messaging.id)
        ).group_by("dow", "hour").all()

        # Interactions by weekday/hour
        int_rows = db.session.query(
            extract("dow", MatchInteraction.created_at).label("dow"),
            extract("hour", MatchInteraction.created_at).label("hour"),
            func.count(MatchInteraction.id)
        ).group_by("dow", "hour").all()

        def to_matrix(rows):
            # Initialize 7x24 zeros
            mat = [[0 for _ in range(24)] for _ in range(7)]
            for dow, hour, count in rows:
                d = int(dow) if dow is not None else 0
                h = int(hour) if hour is not None else 0
                if 0 <= d <= 6 and 0 <= h <= 23:
                    mat[d][h] = int(count)
            return mat

        data = {
            "messages": to_matrix(msg_rows),
            "interactions": to_matrix(int_rows),
        }
        return jsonify({"activity_heatmap": data}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# /matching/leaders (extra)
# ----------------------------
@analytics_bp.route("/matching/leaders", methods=["GET"])
def get_matching_leaders():
    """
    Top investors/startups by number of interactions (last 90 days).
    """
    try:
        user, token, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        cutoff = datetime.utcnow() - timedelta(days=90)

        # Top investor enterprises by interactions
        inv_rows = db.session.query(
            MatchScore.investor_enterprise_id,
            func.count(MatchInteraction.id).label("cnt")
        ).join(MatchInteraction, MatchInteraction.match_id == MatchScore.id
        ).filter(MatchInteraction.created_at >= cutoff
        ).group_by(MatchScore.investor_enterprise_id
        ).order_by(func.count(MatchInteraction.id).desc()
        ).limit(10).all()

        # Top startup enterprises by interactions
        st_rows = db.session.query(
            MatchScore.startup_enterprise_id,
            func.count(MatchInteraction.id).label("cnt")
        ).join(MatchInteraction, MatchInteraction.match_id == MatchScore.id
        ).filter(MatchInteraction.created_at >= cutoff
        ).group_by(MatchScore.startup_enterprise_id
        ).order_by(func.count(MatchInteraction.id).desc()
        ).limit(10).all()

        def hydrate(rows, role):
            out = []
            ids = [r[0] for r in rows if r[0]]
            if not ids:
                return out
            ents = {e.id: e for e in Enterprise.query.filter(Enterprise.id.in_(ids)).all()}
            for ent_id, cnt in rows:
                ent = ents.get(ent_id)
                if ent:
                    out.append({
                        "enterprise_id": str(ent.id),
                        "name": ent.name,
                        "type": ent.enterprise_type,
                        "role": role,
                        "interactions": int(cnt),
                    })
            return out

        data = {
            "top_investors": hydrate(inv_rows, "investor"),
            "top_startups": hydrate(st_rows, "startup"),
        }
        return jsonify({"leaders": data}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# /ai/insights (extra)
# ----------------------------
@analytics_bp.route("/ai/insights", methods=["GET"])
def ai_insights():
    """
    Generate a short narrative summary of current platform health using a local LLM if available.
    Falls back to a deterministic summary when LOCAL_API_BASE_URL is not configured.
    """
    try:
        user, token, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        now = datetime.utcnow()
        last30 = now - timedelta(days=30)

        totals = {
            "users": User.query.count(),
            "active_users": User.query.filter_by(is_active=True).count(),
            "matches": MatchScore.query.count(),
            "interactions_30d": MatchInteraction.query.filter(MatchInteraction.created_at >= last30).count(),
            "messages_30d": Messaging.query.filter(Messaging.sent_at >= last30).count(),
            "events_upcoming": Event.query.filter(Event.start_time >= now).count(),
            "documents_total": Document.query.count(),
            "subscriptions": Subscription.query.count(),
        }

        # MRR quick calc
        active_statuses = ("active", "trialing")
        subs = Subscription.query.filter(Subscription.status.in_(active_statuses)).all()
        def monthly_amount(sub: Subscription) -> float:
            if not sub.amount:
                return 0.0
            f = (sub.payment_frequency or "").lower()
            a = float(sub.amount)
            return a if f == "monthly" else (a/3.0 if f == "quarterly" else (a/12.0 if f == "annually" else a))
        mrr = round(sum(monthly_amount(s) for s in subs), 2)

        prompt = (
            "You are an analytics assistant. Summarize these platform stats in 5 short bullet points, "
            "including momentum and any notable risks/opportunities.\n\n"
            f"data={json.dumps({'totals': totals, 'mrr': mrr})}"
        )
        text = call_local_ai(prompt)
        if not text:
            # Fallback deterministic summary
            growth_hint = "steady" if totals["interactions_30d"] > 0 and totals["messages_30d"] > 0 else "flat"
            text = (
                f"- {totals['active_users']} active users out of {totals['users']} total; engagement looks {growth_hint} over the last 30 days.\n"
                f"- {totals['matches']} total matches and {totals['interactions_30d']} interactions in the last 30 days indicate healthy discovery.\n"
                f"- Upcoming events: {totals['events_upcoming']}; documents in the system: {totals['documents_total']}.\n"
                f"- Subscriptions: {totals['subscriptions']} active records; MRR (est.): ${mrr:,.2f}.\n"
                f"- Consider nudging inactive cohorts to lift engagement and adding events to sustain momentum."
            )

        return jsonify({
            "insights": {
                "generated_at": now.isoformat(),
                "mrr_estimate": mrr,
                "totals": totals,
                "summary": text,
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ----------------------------
# /export
# ----------------------------
@analytics_bp.route("/export", methods=["GET"])
def export_analytics():
    """Export summary analytics (admin-leaning)."""
    try:
        user, token, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        now = datetime.utcnow()
        data = {
            "export_date": now.isoformat(),
            "platform_summary": {
                "users": User.query.count(),
                "enterprises": Enterprise.query.count(),
                "matches": MatchScore.query.count(),
                "events": Event.query.count(),
                "documents": Document.query.count(),
                "messages": Messaging.query.count(),
                "subscriptions": Subscription.query.count(),
            },
        }
        return jsonify({"export_data": data}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500