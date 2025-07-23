from flask import Blueprint, jsonify, request, session
from src.models.user import User, InvestorProfile, Enterprise, Match, Event, EventRegistration, Document, Message, db
from datetime import datetime, timedelta
from sqlalchemy import func, extract

analytics_bp = Blueprint('analytics', __name__)

def require_auth():
    user_id = session.get('user_id')
    if not user_id:
        return None, jsonify({'error': 'Not authenticated'}), 401
    
    user = User.query.get(user_id)
    if not user:
        return None, jsonify({'error': 'User not found'}), 404
    
    return user, None, None

@analytics_bp.route('/dashboard', methods=['GET'])
def get_dashboard_analytics():
    """Get comprehensive dashboard analytics"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        # Platform overview
        total_users = User.query.filter_by(is_active=True).count()
        total_investors = User.query.filter_by(user_type='investor', is_active=True).count()
        total_entrepreneurs = User.query.filter_by(user_type='entrepreneur', is_active=True).count()
        total_matches = Match.query.count()
        successful_matches = Match.query.filter_by(status='invested').count()

        # Recent activity (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        new_users = User.query.filter(User.created_at >= thirty_days_ago).count()
        new_matches = Match.query.filter(Match.created_at >= thirty_days_ago).count()
        recent_events = Event.query.filter(Event.created_at >= thirty_days_ago).count()

        # User-specific analytics
        user_analytics = {}

        if user.user_type == 'investor':
            user_matches = Match.query.filter_by(investor_id=user.id).count()
            user_interested = Match.query.filter_by(investor_id=user.id, investor_interest='interested').count()
            user_investments = Match.query.filter_by(investor_id=user.id, status='invested').count()
            user_analytics = {
                'total_matches': user_matches,
                'interested_matches': user_interested,
                'investments_made': user_investments,
                'success_rate': (user_investments / user_interested * 100) if user_interested > 0 else 0
            }
        elif user.user_type == 'entrepreneur':
            user_matches = Match.query.filter_by(enterprise_id=user.id).count()
            investor_interest = Match.query.filter_by(enterprise_id=user.id, investor_interest='interested').count()
            funding_received = Match.query.filter_by(enterprise_id=user.id, status='invested').count()
            user_analytics = {
                'total_matches': user_matches,
                'investor_interest': investor_interest,
                'funding_received': funding_received,
                'interest_rate': (investor_interest / user_matches * 100) if user_matches > 0 else 0
            }

        # Event analytics
        upcoming_events = Event.query.filter(
            Event.date >= datetime.utcnow(),
            Event.status == 'upcoming'
        ).count()
        user_registrations = EventRegistration.query.filter_by(user_id=user.id).count()

        dashboard_data = {
            'platform_overview': {
                'total_users': total_users,
                'total_investors': total_investors,
                'total_entrepreneurs': total_entrepreneurs,
                'total_matches': total_matches,
                'successful_matches': successful_matches,
                'success_rate': (successful_matches / total_matches * 100) if total_matches > 0 else 0
            },
            'recent_activity': {
                'new_users': new_users,
                'new_matches': new_matches,
                'recent_events': recent_events
            },
            'user_analytics': user_analytics,
            'events': {
                'upcoming_events': upcoming_events,
                'user_registrations': user_registrations
            }
        }

        return jsonify({'dashboard': dashboard_data}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/platform-stats', methods=['GET'])
def get_platform_statistics():
    """Get comprehensive platform statistics"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # User statistics
        user_stats = {
            'total_users': User.query.count(),
            'active_users': User.query.filter_by(is_active=True).count(),
            'verified_users': User.query.filter_by(is_verified=True).count(),
            'investors': User.query.filter_by(user_type='investor').count(),
            'entrepreneurs': User.query.filter_by(user_type='entrepreneur').count()
        }
        
        # Subscription statistics
        subscription_stats = db.session.query(
            User.subscription_tier,
            func.count(User.id).label('count')
        ).group_by(User.subscription_tier).all()
        
        # Matching statistics
        match_stats = {
            'total_matches': Match.query.count(),
            'pending_matches': Match.query.filter_by(status='pending').count(),
            'accepted_matches': Match.query.filter_by(status='accepted').count(),
            'declined_matches': Match.query.filter_by(status='declined').count(),
            'invested_matches': Match.query.filter_by(status='invested').count()
        }
        
        # Average compatibility score
        avg_compatibility = db.session.query(func.avg(Match.compatibility_score)).scalar() or 0
        match_stats['average_compatibility'] = round(avg_compatibility, 2)
        
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
            'users': user_stats,
            'subscriptions': [{'tier': tier, 'count': count} for tier, count in subscription_stats],
            'matches': match_stats,
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
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # Get time period from query params
        period = request.args.get('period', 'monthly')  # daily, weekly, monthly, yearly
        months_back = request.args.get('months_back', 12, type=int)
        
        start_date = datetime.utcnow() - timedelta(days=months_back * 30)
        
        # User growth
        if period == 'monthly':
            user_growth = db.session.query(
                extract('year', User.created_at).label('year'),
                extract('month', User.created_at).label('month'),
                func.count(User.id).label('count')
            ).filter(User.created_at >= start_date).group_by(
                extract('year', User.created_at),
                extract('month', User.created_at)
            ).order_by('year', 'month').all()
            
            match_growth = db.session.query(
                extract('year', Match.created_at).label('year'),
                extract('month', Match.created_at).label('month'),
                func.count(Match.id).label('count')
            ).filter(Match.created_at >= start_date).group_by(
                extract('year', Match.created_at),
                extract('month', Match.created_at)
            ).order_by('year', 'month').all()
        
        # Format growth data
        user_growth_data = [
            {
                'period': f"{int(year)}-{int(month):02d}",
                'new_users': count
            }
            for year, month, count in user_growth
        ]
        
        match_growth_data = [
            {
                'period': f"{int(year)}-{int(month):02d}",
                'new_matches': count
            }
            for year, month, count in match_growth
        ]
        
        # Calculate growth rates
        if len(user_growth_data) >= 2:
            latest_users = user_growth_data[-1]['new_users']
            previous_users = user_growth_data[-2]['new_users']
            user_growth_rate = ((latest_users - previous_users) / previous_users * 100) if previous_users > 0 else 0
        else:
            user_growth_rate = 0
        
        if len(match_growth_data) >= 2:
            latest_matches = match_growth_data[-1]['new_matches']
            previous_matches = match_growth_data[-2]['new_matches']
            match_growth_rate = ((latest_matches - previous_matches) / previous_matches * 100) if previous_matches > 0 else 0
        else:
            match_growth_rate = 0
        
        growth_metrics = {
            'user_growth': user_growth_data,
            'match_growth': match_growth_data,
            'growth_rates': {
                'user_growth_rate': round(user_growth_rate, 2),
                'match_growth_rate': round(match_growth_rate, 2)
            }
        }
        
        return jsonify({'growth_metrics': growth_metrics}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/revenue-analytics', methods=['GET'])
def get_revenue_analytics():
    """Get revenue analytics (simplified version)"""
    try:
        user, error_response, status_code = require_auth()
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
            User.subscription_tier,
            func.count(User.id).label('count')
        ).filter(User.is_active == True).group_by(User.subscription_tier).all()
        
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
            'average_revenue_per_user': (monthly_recurring_revenue / max(1, sum(count for tier, count in subscription_counts if tier != 'free')))
        }
        
        return jsonify({'revenue_analytics': revenue_analytics}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/engagement-metrics', methods=['GET'])
def get_engagement_metrics():
    """Get user engagement metrics"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # Active users (logged in within last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        
        monthly_active_users = User.query.filter(
            User.last_login >= thirty_days_ago,
            User.is_active == True
        ).count()
        
        weekly_active_users = User.query.filter(
            User.last_login >= seven_days_ago,
            User.is_active == True
        ).count()
        
        total_active_users = User.query.filter_by(is_active=True).count()
        
        # Message engagement
        messages_last_30_days = Message.query.filter(
            Message.created_at >= thirty_days_ago
        ).count()
        
        active_messagers = db.session.query(func.count(func.distinct(Message.sender_id))).filter(
            Message.created_at >= thirty_days_ago
        ).scalar() or 0
        
        # Match engagement
        matches_last_30_days = Match.query.filter(
            Match.created_at >= thirty_days_ago
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
        monthly_engagement_rate = (monthly_active_users / total_active_users * 100) if total_active_users > 0 else 0
        weekly_engagement_rate = (weekly_active_users / total_active_users * 100) if total_active_users > 0 else 0
        
        engagement_metrics = {
            'active_users': {
                'monthly_active_users': monthly_active_users,
                'weekly_active_users': weekly_active_users,
                'total_active_users': total_active_users,
                'monthly_engagement_rate': round(monthly_engagement_rate, 2),
                'weekly_engagement_rate': round(weekly_engagement_rate, 2)
            },
            'activity_last_30_days': {
                'messages_sent': messages_last_30_days,
                'active_messagers': active_messagers,
                'new_matches': matches_last_30_days,
                'event_registrations': event_registrations_last_30_days,
                'documents_uploaded': documents_uploaded_last_30_days
            },
            'average_activity_per_user': {
                'messages_per_active_user': (messages_last_30_days / monthly_active_users) if monthly_active_users > 0 else 0,
                'matches_per_active_user': (matches_last_30_days / monthly_active_users) if monthly_active_users > 0 else 0
            }
        }
        
        return jsonify({'engagement_metrics': engagement_metrics}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/user-analytics/<uuid:target_user_id>', methods=['GET'])
def get_user_analytics(target_user_id):
    """Get analytics for a specific user (admin function)"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code

        target_user = User.query.get(target_user_id)
        if not target_user:
            return jsonify({'error': 'User not found'}), 404

        user_info = target_user.to_dict()

        if target_user.user_type == 'investor':
            matches = Match.query.filter_by(investor_id=target_user_id).count()
            interested = Match.query.filter_by(investor_id=target_user_id, investor_interest='interested').count()
            investments = Match.query.filter_by(investor_id=target_user_id, status='invested').count()
            activity_stats = {
                'total_matches': matches,
                'interested_matches': interested,
                'investments_made': investments,
                'success_rate': (investments / interested * 100) if interested > 0 else 0
            }
        else:
            matches = Match.query.filter_by(enterprise_id=target_user_id).count()
            investor_interest = Match.query.filter_by(enterprise_id=target_user_id, investor_interest='interested').count()
            funding = Match.query.filter_by(enterprise_id=target_user_id, status='invested').count()
            activity_stats = {
                'total_matches': matches,
                'investor_interest': investor_interest,
                'funding_received': funding,
                'interest_rate': (investor_interest / matches * 100) if matches > 0 else 0
            }

        messages_sent = Message.query.filter_by(sender_id=target_user_id).count()
        messages_received = Message.query.filter_by(recipient_id=target_user_id).count()
        event_registrations = EventRegistration.query.filter_by(user_id=target_user_id).count()
        events_attended = EventRegistration.query.filter_by(
            user_id=target_user_id,
            registration_status='attended'
        ).count()
        documents_uploaded = Document.query.filter_by(owner_id=target_user_id).count()

        user_analytics = {
            'user_info': user_info,
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

        return jsonify({'user_analytics': user_analytics}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/export', methods=['GET'])
def export_analytics():
    """Export analytics data (admin function)"""
    try:
        user, error_response, status_code = require_auth()
        if error_response:
            return error_response, status_code
        
        # In a real implementation, this would be restricted to admin users
        export_type = request.args.get('type', 'summary')
        
        if export_type == 'summary':
            # Export summary analytics
            data = {
                'export_date': datetime.utcnow().isoformat(),
                'platform_summary': {
                    'total_users': User.query.count(),
                    'total_matches': Match.query.count(),
                    'total_events': Event.query.count(),
                    'total_messages': Message.query.count()
                }
            }
        elif export_type == 'users':
            # Export user data (anonymized)
            users = User.query.all()
            data = {
                'export_date': datetime.utcnow().isoformat(),
                'users': [
                    {
                        'id': u.id,
                        'user_type': u.user_type,
                        'subscription_tier': u.subscription_tier,
                        'created_at': u.created_at.isoformat() if u.created_at else None,
                        'is_verified': u.is_verified,
                        'is_active': u.is_active
                    }
                    for u in users
                ]
            }
        else:
            return jsonify({'error': 'Invalid export type'}), 400
        
        return jsonify({'export_data': data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

