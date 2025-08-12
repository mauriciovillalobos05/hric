import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MapPin,
  DollarSign,
  TrendingUp,
  Users as UsersIcon,
  Clock,
  Target,
  Award,
  Briefcase,
  MessageSquare,
} from "lucide-react";

const formatMoneyShort = (n) => {
  if (n == null || isNaN(n)) return "-";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
};

const formatMonthly = (n) => (n == null ? "-" : `${formatMoneyShort(n)}/mo`);

const formatCheckSize = (checkSize) =>
  typeof checkSize === "string"
    ? checkSize.replace(/\$(\d+)M/g, "$$$1M").replace(/\$(\d+)K/g, "$$$1K")
    : "-";

const getMatchColor = (score) => {
  if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
  if (score >= 60) return "text-blue-600 bg-blue-100 border-blue-200";
  if (score >= 40) return "text-yellow-600 bg-yellow-50 border-yellow-200";
  return "text-red-600 bg-red-50 border-red-200";
};

const getMatchLabel = (score) => {
  if (score >= 80) return "Excellent Match";
  if (score >= 60) return "Good Match";
  if (score >= 40) return "Fair Match";
  return "Poor Match";
};

// storage helpers
const getRolePlan = () => {
  const role =
    sessionStorage.getItem("registrationRole") ||
    localStorage.getItem("user_role") ||
    "";
  const plan =
    sessionStorage.getItem("registrationPlanKey") ||
    localStorage.getItem("user_plan") ||
    "";
  return { role, plan };
};

// ---- normalization helpers ----
const toArray = (val) => (Array.isArray(val) ? val : val == null ? [] : [val]);
const industriesArray = (entity) => {
  const arr = Array.isArray(entity?.industries)
    ? entity.industries
    : toArray(entity?.industry);
  return arr.filter((x) => typeof x === "string");
};

// Heuristic: if parent didn't pass `startup`, still detect startup-ish objects
const looksLikeStartup = (e) => {
  if (!e) return false;
  const signals = [
    "revenueMonthlyUSD",
    "employees",
    "valuationUSD",
    "currentInvestors",
    "summary",
    "tags",
  ];
  return signals.some((k) => e[k] != null);
};

const StartupCard = ({ investor, startup, matchScore, onSelect, isSelected }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // entity can be a startup or investor depending on list
  const entity = startup || investor;

  // Treat as startup if `startup` prop exists OR it "looks like" one
  const isStartup =
    !!startup || (!startup && !investor ? false : looksLikeStartup(entity));

  const inds = industriesArray(entity);
  const stages = toArray(entity?.stage);

  const handleClick = () => {
    if (onSelect) onSelect(entity);
  };
  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  // Contact button for INVESTORS viewing STARTUP cards
  const { role } = getRolePlan();
  const isInvestor =
    role?.toLowerCase() === "investor" ||
    location.pathname.includes("/dashboard/investor");
  const showContact = isInvestor && isStartup && !!entity?.name;

  const handleContact = (e) => {
    e.stopPropagation();
    if (!entity?.name) return;

    // Tell Messages to open this conversation & switch to the Messages tab
    sessionStorage.setItem("startChatWith", entity.name);
    sessionStorage.setItem("goToTab", "messages");
    navigate("/dashboard/investor?tab=messages");
  };

  const containerClasses = `cursor-pointer transition-all duration-200 border ${
    isSelected
      ? "bg-blue-50 border-blue-500 ring-2 ring-blue-200 shadow-md"
      : "bg-white border-slate-200 hover:bg-slate-50 hover:shadow-md"
  }`;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKey}
      aria-pressed={!!isSelected}
      className={containerClasses}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900">
              {entity?.name || "-"}
            </CardTitle>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {isStartup ? (
                <>
                  {entity?.industry && (
                    <Badge variant="outline" className="text-xs">
                      {entity.industry}
                    </Badge>
                  )}
                  {entity?.stage && (
                    <Badge variant="secondary" className="text-xs">
                      {entity.stage}
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  {entity?.type && (
                    <Badge variant="outline" className="text-xs">
                      {entity.type}
                    </Badge>
                  )}
                  {entity?.founded && (
                    <span className="text-sm text-gray-500">
                      Founded {entity.founded}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {typeof matchScore === "number" && !Number.isNaN(matchScore) && (
            <div className="text-right">
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium border ${getMatchColor(
                  matchScore
                )}`}
              >
                {Math.round(matchScore)}% Match
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {getMatchLabel(matchScore)}
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          {entity?.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">{entity.location}</span>
            </div>
          )}

          {isStartup ? (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                {formatMonthly(entity?.revenueMonthlyUSD)}
              </span>
            </div>
          ) : (
            entity?.checkSize && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {formatCheckSize(entity.checkSize)}
                </span>
              </div>
            )
          )}

          {isStartup ? (
            typeof entity?.employees === "number" && (
              <div className="flex items-center gap-2">
                <UsersIcon className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {entity.employees} employees
                </span>
              </div>
            )
          ) : (
            typeof entity?.portfolioSize === "number" && (
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {entity.portfolioSize} companies
                </span>
              </div>
            )
          )}

          {isStartup ? (
            typeof entity?.valuationUSD === "number" && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  Valuation: {formatMoneyShort(entity.valuationUSD)}
                </span>
              </div>
            )
          ) : (
            entity?.aum && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">{entity.aum} AUM</span>
              </div>
            )
          )}
        </div>

        {/* Focus / Tags */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">
              {isStartup ? "Focus & Tags" : "Investment Focus"}
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            {stages.slice(0, 4).map((stage, i) => (
              <Badge key={`st-${i}`} variant="secondary" className="text-xs">
                {stage}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap gap-1 mt-1">
            {industriesArray(entity)
              .slice(0, 3)
              .map((x, i) => (
                <Badge key={`ind-${i}`} variant="outline" className="text-xs">
                  {x}
                </Badge>
              ))}
            {industriesArray(entity).length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{industriesArray(entity).length - 3} more
              </Badge>
            )}

            {isStartup &&
              Array.isArray(entity?.tags) &&
              entity.tags.map((t, i) => (
                <Badge key={`t-${i}`} variant="outline" className="text-xs">
                  {t}
                </Badge>
              ))}
          </div>
        </div>

        {/* Behavior / KPIs */}
        {!isStartup ? (
          (entity?.avgDealTime || entity?.followOnRate != null) && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {entity?.avgDealTime && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-600">Avg Deal Time</span>
                  </div>
                  <span className="font-medium">{entity.avgDealTime}</span>
                </div>
              )}
              {entity?.followOnRate != null && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-600">Follow-on Rate</span>
                  </div>
                  <span className="font-medium">{entity.followOnRate}%</span>
                </div>
              )}
            </div>
          )
        ) : (
          entity?.keyMetrics && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Technical Founders</div>
                <span className="font-medium">
                  {Math.round((entity.keyMetrics.technicalFounders ?? 0) * 100)}%
                </span>
              </div>
              <div>
                <div className="text-gray-600">Previous Exits</div>
                <span className="font-medium">
                  {Math.round((entity.keyMetrics.previousExits ?? 0) * 100)}%
                </span>
              </div>
            </div>
          )
        )}

        {(entity?.investmentThesis || entity?.summary) && (
          <div>
            <p className="text-sm text-gray-600 italic">
              "{entity.investmentThesis || entity.summary}"
            </p>
          </div>
        )}

        {!isStartup ? (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Recent investments:</span>
            <span className="font-medium text-green-600">
              {entity?.recentInvestments ?? 0} this year
            </span>
          </div>
        ) : (
          Array.isArray(entity?.currentInvestors) &&
          entity.currentInvestors.length > 0 && (
            <div className="text-sm">
              <div className="text-gray-600 mb-1">Current Investors:</div>
              <div className="text-gray-800">
                {entity.currentInvestors.slice(0, 2).join(", ")}
                {entity.currentInvestors.length > 2 &&
                  ` +${entity.currentInvestors.length - 2} more`}
              </div>
            </div>
          )
        )}

        {typeof matchScore === "number" && !Number.isNaN(matchScore) && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">Investment Likelihood</span>
              <span className="text-sm font-medium">
                {Math.round(matchScore)}%
              </span>
            </div>
            <Progress value={matchScore} className="h-2" />
          </div>
        )}

        {/* Contact action — for INVESTORS on STARTUP cards */}
        {showContact && (
          <div className="pt-2 flex justify-end">
            <Button size="sm" onClick={handleContact}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Contact
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StartupCard;