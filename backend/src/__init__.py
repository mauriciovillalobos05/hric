# src/models/__init__.py
from src.extensions import db  # keep a single db across the app

# Import ALL models so they register with SQLAlchemy metadata and are re-exported
from .models.user import (  # make sure this file exists!
    User, Enterprise, EnterpriseUser,
    EnterpriseProfile, Industry, Stage,
    InvestorProfile, InvestmentPreferences, InvestorIndustry, InvestorStage,
    StartupProfile, StartupMetrics, FundingRound,
    MatchScore, MatchInteraction,
    VirtualPortfolio, VirtualPortfolioItem,
    InvestorSimulation, StartupSimulation, SimulationParameters,
    UserAchievement, AchievementType, UserActivity,
    Leaderboard, LeaderboardEntry,
    DashboardConfig, Visualization,
    Meeting, Event, VenueType,
    Document, Messaging,
    Subscription, UserPlan, StripeEvent,
    Referral, SecuredAccess,
    MarketRecommendation, MarketInteraction,
    AIFieldVenue,
)

__all__ = [
    "db",
    "User", "Enterprise", "EnterpriseUser",
    "EnterpriseProfile", "Industry", "Stage",
    "InvestorProfile", "InvestmentPreferences", "InvestorIndustry", "InvestorStage",
    "StartupProfile", "StartupMetrics", "FundingRound",
    "MatchScore", "MatchInteraction",
    "VirtualPortfolio", "VirtualPortfolioItem",
    "InvestorSimulation", "StartupSimulation", "SimulationParameters",
    "UserAchievement", "AchievementType", "UserActivity",
    "Leaderboard", "LeaderboardEntry",
    "DashboardConfig", "Visualization",
    "Meeting", "Event", "VenueType",
    "Document", "Messaging",
    "Subscription", "UserPlan", "StripeEvent",
    "Referral", "SecuredAccess",
    "MarketRecommendation", "MarketInteraction",
    "AIFieldVenue",
]