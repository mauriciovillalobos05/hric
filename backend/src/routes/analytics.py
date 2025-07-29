from flask import Blueprint, jsonify, request, session
from src.models.user import Users, InvestorProfile, Enterprise, MatchRecommendation, Event, EventRegistration, Document, Message, db
from datetime import datetime, timedelta
from sqlalchemy import func, extract

analytics_bp = Blueprint('analytics', __name__)

def require_auth():
    Users_id = session.get('Users_id')
    if not Users_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    
    Users = Users.query.get(Users_id)
    if not Users:
        return None, jsonify({'error': 'Users not found'}), 404
    
    return Users, None, None

@analytics_bp.route('/dashboard', methods=['GET'])
def get_dashboard_analytics():
    """Get comprehensive dashboard analytics"""
    try:
        Users, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        # Platform overview
        total_Userss = Users.query.filter_by(is_active=True).count()
        total_investors = Users.query.filter_by(Users_type='investor', is_active=True).count()
        total_entrepreneurs = Users.query.filter_by(Users_type='entrepreneur', is_active=True).count()
        total_MatchRecommendationes = MatchRecommendation.query.count()
        successful_MatchRecommendationes = MatchRecommendation.query.filter_by(status='invested').count()

        # Recent activity (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        new_Userss = Users.query.filter(Users.created_at >= thirty_days_ago).count()
        new_MatchRecommendationes = MatchRecommendation.query.filter(MatchRecommendation.created_at >= thirty_days_ago).count()
        recent_events = Event.query.filter(Event.created_at >= thirty_days_ago).count()

        # Users-specific analytics
        Users_analytics = {}

        if Users.Users_type == 'investor':
            Users_MatchRecommendationes = MatchRecommendation.query.filter_by(investor_id=Users.id).count()
            Users_interested = MatchRecommendation.query.filter_by(investor_id=Users.id, investor_interest='interested').count()
            Users_investments = MatchRecommendation.query.filter_by(investor_id=Users.id, status='invested').count()
            Users_analytics = {
                'total_MatchRecommendationes': Users_MatchRecommendationes,
                'interested_MatchRecommendationes': Users_interested,
                'investments_made': Users_investments,
                'success_rate': (Users_investments / Users_interested * 100) if Users_interested > 0 else 0
            }
        elif Users.Users_type == 'entrepreneur':
            Users_MatchRecommendationes = MatchRecommendation.query.filter_by(enterprise_id=Users.id).count()
            investor_interest = MatchRecommendation.query.filter_by(enterprise_id=Users.id, investor_interest='interested').count()
            funding_received = MatchRecommendation.query.filter_by(enterprise_id=Users.id, status='invested').count()
            Users_analytics = {
                'total_MatchRecommendationes': Users_MatchRecommendationes,
                'investor_interest': investor_interest,
                'funding_received': funding_received,
                'interest_rate': (investor_interest / Users_MatchRecommendationes * 100) if Users_MatchRecommendationes > 0 else 0
            }

        # Event analytics
        upcoming_events = Event.query.filter(
            Event.date >= datetime.utcnow(),
            Event.status == 'upcoming'
        ).count()
        Users_registrations = EventRegistration.query.filter_by(Users_id=Users.id).count()

        dashboard_data = {
            'platform_overview': {
                'total_Userss': total_Userss,
                'total_investors': total_investors,
                'total_entrepreneurs': total_entrepreneurs,
                'total_MatchRecommendationes': total_MatchRecommendationes,
                'successful_MatchRecommendationes': successful_MatchRecommendationes,
                'success_rate': (successful_MatchRecommendationes / total_MatchRecommendationes * 100) if total_MatchRecommendationes > 0 else 0
            },
            'recent_activity': {
                'new_Userss': new_Userss,
                'new_MatchRecommendationes': new_MatchRecommendationes,
                'recent_events': recent_events
            },
            'Users_analytics': Users_analytics,
            'events': {
                'upcoming_events': upcoming_events,
                'Users_registrations': Users_registrations
            }
        }

        return jsonify({'dashboard': dashboard_data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/platform-stats', methods=['GET'])
def get_platform_statistics():
    """Get comprehensive platform statistics"""
    try:
        Users, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # Users statistics
        Users_stats = {
            'total_Userss': Users.query.count(),
            'active_Userss': Users.query.filter_by(is_active=True).count(),
            'verified_Userss': Users.query.filter_by(is_verified=True).count(),
            'investors': Users.query.filter_by(Users_type='investor').count(),
            'entrepreneurs': Users.query.filter_by(Users_type='entrepreneur').count()
        }
        
        # Subscription statistics
        subscription_stats = db.session.query(
            Users.subscription_tier,
            func.count(Users.id).label('count')
        ).group_by(Users.subscription_tier).all()
        
        # MatchRecommendationing statistics
        MatchRecommendation_stats = {
            'total_MatchRecommendationes': MatchRecommendation.query.count(),
            'pending_MatchRecommendationes': MatchRecommendation.query.filter_by(status='pending').count(),
            'accepted_MatchRecommendationes': MatchRecommendation.query.filter_by(status='accepted').count(),
            'declined_MatchRecommendationes': MatchRecommendation.query.filter_by(status='declined').count(),
            'invested_MatchRecommendationes': MatchRecommendation.query.filter_by(status='invested').count()
        }
        
        # Average compatibility score
        avg_compatibility = db.session.query(func.avg(MatchRecommendation.compatibility_score)).scalar() or 0
        MatchRecommendation_stats['average_compatibility'] = round(avg_compatibility, 2)
        
        # Industry distribution
        industry_stats = db.session.query(
            Enterprise.industry,
            func.count(Enterprise.id).label('count')
        ).filter(Enterprise.industry.isnot(None)).group_by(
            Enterprise.industry
        ).order_by(func.count(Enterprise.id).desc()).limit(10).all()
        
        # Investment stage distribution
        stage_stats = db.session.query(
            Enterprise.funding_stage,
            func.count(Enterprise.id).label('count')
        ).filter(Enterprise.funding_stage.isnot(None)).group_by(
            Enterprise.funding_stage
        ).all()
        
        # Event statistics
        event_stats = {
            'total_events': Event.query.count(),
            'upcoming_events': Event.query.filter(Event.date >= datetime.utcnow()).count(),
            'completed_events': Event.query.filter_by(status='completed').count(),
            'total_registrations': EventRegistration.query.count()
        }
        
        # Document statistics
        document_stats = {
            'total_documents': Document.query.count(),
            'public_documents': Document.query.filter_by(access_level='public').count(),
            'member_documents': Document.query.filter_by(access_level='members').count(),
            'private_documents': Document.query.filter_by(access_level='private').count()
        }
        
        # Message statistics
        message_stats = {
            'total_messages': Message.query.count(),
            'unread_messages': Message.query.filter_by(is_read=False).count()
        }
        
        platform_stats = {
            'Userss': Users_stats,
            'subscriptions': [{'tier': tier, 'count': count} for tier, count in subscription_stats],
            'MatchRecommendationes': MatchRecommendation_stats,
            'industries': [{'industry': industry, 'count': count} for industry, count in industry_stats],
            'funding_stages': [{'stage': stage, 'count': count} for stage, count in stage_stats],
            'events': event_stats,
            'documents': document_stats,
            'messages': message_stats
        }
        
        return jsonify({'platform_stats': platform_stats}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/growth-metrics', methods=['GET'])
def get_growth_metrics():
    """Get platform growth metrics over time"""
    try:
        Users, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # Get time period from query params
        period = request.args.get('period', 'monthly')  # daily, weekly, monthly, yearly
        months_back = request.args.get('months_back', 12, type=int)
        
        start_date = datetime.utcnow() - timedelta(days=months_back * 30)
        
        # Users growth
        if period == 'monthly':
            Users_growth = db.session.query(
                extract('year', Users.created_at).label('year'),
                extract('month', Users.created_at).label('month'),
                func.count(Users.id).label('count')
            ).filter(Users.created_at >= start_date).group_by(
                extract('year', Users.created_at),
                extract('month', Users.created_at)
            ).order_by('year', 'month').all()
            
            MatchRecommendation_growth = db.session.query(
                extract('year', MatchRecommendation.created_at).label('year'),
                extract('month', MatchRecommendation.created_at).label('month'),
                func.count(MatchRecommendation.id).label('count')
            ).filter(MatchRecommendation.created_at >= start_date).group_by(
                extract('year', MatchRecommendation.created_at),
                extract('month', MatchRecommendation.created_at)
            ).order_by('year', 'month').all()
        
        # Format growth data
        Users_growth_data = [
            {
                'period': f"{int(year)}-{int(month):02d}",
                'new_Userss': count
            }
            for year, month, count in Users_growth
        ]
        
        MatchRecommendation_growth_data = [
            {
                'period': f"{int(year)}-{int(month):02d}",
                'new_MatchRecommendationes': count
            }
            for year, month, count in MatchRecommendation_growth
        ]
        
        # Calculate growth rates
        if len(Users_growth_data) >= 2:
            latest_Userss = Users_growth_data[-1]['new_Userss']
            previous_Userss = Users_growth_data[-2]['new_Userss']
            Users_growth_rate = ((latest_Userss - previous_Userss) / previous_Userss * 100) if previous_Userss > 0 else 0
        else:
            Users_growth_rate = 0
        
        if len(MatchRecommendation_growth_data) >= 2:
            latest_MatchRecommendationes = MatchRecommendation_growth_data[-1]['new_MatchRecommendationes']
            previous_MatchRecommendationes = MatchRecommendation_growth_data[-2]['new_MatchRecommendationes']
            MatchRecommendation_growth_rate = ((latest_MatchRecommendationes - previous_MatchRecommendationes) / previous_MatchRecommendationes * 100) if previous_MatchRecommendationes > 0 else 0
        else:
            MatchRecommendation_growth_rate = 0
        
        growth_metrics = {
            'Users_growth': Users_growth_data,
            'MatchRecommendation_growth': MatchRecommendation_growth_data,
            'growth_rates': {
                'Users_growth_rate': round(Users_growth_rate, 2),
                'MatchRecommendation_growth_rate': round(MatchRecommendation_growth_rate, 2)
            }
        }
        
        return jsonify({'growth_metrics': growth_metrics}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/revenue-analytics', methods=['GET'])
def get_revenue_analytics():
    """Get revenue analytics (simplified version)"""
    try:
        Users, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # Subscription revenue calculation (simplified)
        subscription_pricing = {
            'free': 0,
            'basic': 50,
            'premium': 150,
            'vip': 300,
            'enterprise': 200
        }
        
        subscription_counts = db.session.query(
            Users.subscription_tier,
            func.count(Users.id).label('count')
        ).filter(Users.is_active == True).group_by(Users.subscription_tier).all()
        
        monthly_recurring_revenue = 0
        subscription_breakdown = []
        
        for tier, count in subscription_counts:
            price = subscription_pricing.get(tier, 0)
            revenue = price * count
            monthly_recurring_revenue += revenue
            
            subscription_breakdown.append({
                'tier': tier,
                'subscribers': count,
                'price_per_month': price,
                'monthly_revenue': revenue
            })
        
        # Event revenue (simplified - assuming average event price)
        total_registrations = EventRegistration.query.filter_by(payment_status='paid').count()
        avg_event_price = 75  # Average between free and premium events
        estimated_event_revenue = total_registrations * avg_event_price
        
        # Annual projections
        annual_subscription_revenue = monthly_recurring_revenue * 12
        
        revenue_analytics = {
            'monthly_recurring_revenue': monthly_recurring_revenue,
            'annual_projected_revenue': annual_subscription_revenue,
            'estimated_event_revenue': estimated_event_revenue,
            'subscription_breakdown': subscription_breakdown,
            'total_paid_subscribers': sum(count for tier, count in subscription_counts if tier != 'free'),
            'average_revenue_per_Users': (monthly_recurring_revenue / max(1, sum(count for tier, count in subscription_counts if tier != 'free')))
        }
        
        return jsonify({'revenue_analytics': revenue_analytics}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/engagement-metrics', methods=['GET'])
def get_engagement_metrics():
    """Get Users engagement metrics"""
    try:
        Users, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # Active Userss (logged in within last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        
        monthly_active_Userss = Users.query.filter(
            Users.last_login >= thirty_days_ago,
            Users.is_active == True
        ).count()
        
        weekly_active_Userss = Users.query.filter(
            Users.last_login >= seven_days_ago,
            Users.is_active == True
        ).count()
        
        total_active_Userss = Users.query.filter_by(is_active=True).count()
        
        # Message engagement
        messages_last_30_days = Message.query.filter(
            Message.created_at >= thirty_days_ago
        ).count()
        
        active_messagers = db.session.query(func.count(func.distinct(Message.sender_id))).filter(
            Message.created_at >= thirty_days_ago
        ).scalar() or 0
        
        # MatchRecommendation engagement
        MatchRecommendationes_last_30_days = MatchRecommendation.query.filter(
            MatchRecommendation.created_at >= thirty_days_ago
        ).count()
        
        # Event engagement
        event_registrations_last_30_days = EventRegistration.query.filter(
            EventRegistration.registration_date >= thirty_days_ago
        ).count()
        
        # Document engagement
        documents_uploaded_last_30_days = Document.query.filter(
            Document.created_at >= thirty_days_ago
        ).count()
        
        # Calculate engagement rates
        monthly_engagement_rate = (monthly_active_Userss / total_active_Userss * 100) if total_active_Userss > 0 else 0
        weekly_engagement_rate = (weekly_active_Userss / total_active_Userss * 100) if total_active_Userss > 0 else 0
        
        engagement_metrics = {
            'active_Userss': {
                'monthly_active_Userss': monthly_active_Userss,
                'weekly_active_Userss': weekly_active_Userss,
                'total_active_Userss': total_active_Userss,
                'monthly_engagement_rate': round(monthly_engagement_rate, 2),
                'weekly_engagement_rate': round(weekly_engagement_rate, 2)
            },
            'activity_last_30_days': {
                'messages_sent': messages_last_30_days,
                'active_messagers': active_messagers,
                'new_MatchRecommendationes': MatchRecommendationes_last_30_days,
                'event_registrations': event_registrations_last_30_days,
                'documents_uploaded': documents_uploaded_last_30_days
            },
            'average_activity_per_Users': {
                'messages_per_active_Users': (messages_last_30_days / monthly_active_Userss) if monthly_active_Userss > 0 else 0,
                'MatchRecommendationes_per_active_Users': (MatchRecommendationes_last_30_days / monthly_active_Userss) if monthly_active_Userss > 0 else 0
            }
        }
        
        return jsonify({'engagement_metrics': engagement_metrics}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/Users-analytics/<uuid:target_Users_id>', methods=['GET'])
def get_Users_analytics(target_Users_id):
    """Get analytics for a specific Users (admin function)"""
    try:
        Users, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        target_Users = Users.query.get(target_Users_id)
        if not target_Users:
            return jsonify({'error': 'Users not found'}), 404

        Users_info = target_Users.to_dict()

        if target_Users.Users_type == 'investor':
            MatchRecommendationes = MatchRecommendation.query.filter_by(investor_id=target_Users_id).count()
            interested = MatchRecommendation.query.filter_by(investor_id=target_Users_id, investor_interest='interested').count()
            investments = MatchRecommendation.query.filter_by(investor_id=target_Users_id, status='invested').count()
            activity_stats = {
                'total_MatchRecommendationes': MatchRecommendationes,
                'interested_MatchRecommendationes': interested,
                'investments_made': investments,
                'success_rate': (investments / interested * 100) if interested > 0 else 0
            }
        else:
            MatchRecommendationes = MatchRecommendation.query.filter_by(enterprise_id=target_Users_id).count()
            investor_interest = MatchRecommendation.query.filter_by(enterprise_id=target_Users_id, investor_interest='interested').count()
            funding = MatchRecommendation.query.filter_by(enterprise_id=target_Users_id, status='invested').count()
            activity_stats = {
                'total_MatchRecommendationes': MatchRecommendationes,
                'investor_interest': investor_interest,
                'funding_received': funding,
                'interest_rate': (investor_interest / MatchRecommendationes * 100) if MatchRecommendationes > 0 else 0
            }

        messages_sent = Message.query.filter_by(sender_id=target_Users_id).count()
        messages_received = Message.query.filter_by(recipient_id=target_Users_id).count()
        event_registrations = EventRegistration.query.filter_by(Users_id=target_Users_id).count()
        events_attended = EventRegistration.query.filter_by(
            Users_id=target_Users_id,
            registration_status='attended'
        ).count()
        documents_uploaded = Document.query.filter_by(owner_id=target_Users_id).count()

        Users_analytics = {
            'Users_info': Users_info,
            'activity_stats': activity_stats,
            'communication': {
                'messages_sent': messages_sent,
                'messages_received': messages_received,
                'response_rate': (messages_sent / messages_received * 100) if messages_received > 0 else 0
            },
            'events': {
                'registrations': event_registrations,
                'attended': events_attended,
                'attendance_rate': (events_attended / event_registrations * 100) if event_registrations > 0 else 0
            },
            'documents': {
                'uploaded': documents_uploaded
            }
        }

        return jsonify({'Users_analytics': Users_analytics}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/export', methods=['GET'])
def export_analytics():
    """Export analytics data (admin function)"""
    try:
        Users, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # In a real implementation, this would be restricted to admin Userss
        export_type = request.args.get('type', 'summary')
        
        if export_type == 'summary':
            # Export summary analytics
            data = {
                'export_date': datetime.utcnow().isoformat(),
                'platform_summary': {
                    'total_Userss': Users.query.count(),
                    'total_MatchRecommendationes': MatchRecommendation.query.count(),
                    'total_events': Event.query.count(),
                    'total_messages': Message.query.count()
                }
            }
        elif export_type == 'Userss':
            # Export Users data (anonymized)
            Userss = Users.query.all()
            data = {
                'export_date': datetime.utcnow().isoformat(),
                'Userss': [
                    {
                        'id': u.id,
                        'Users_type': u.Users_type,
                        'subscription_tier': u.subscription_tier,
                        'created_at': u.created_at.isoformat() if u.created_at else None,
                        'is_verified': u.is_verified,
                        'is_active': u.is_active
                    }
                    for u in Userss
                ]
            }
        else:
            return jsonify({'error': 'Invalid export type'}), 400
        
        return jsonify({'export_data': data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

