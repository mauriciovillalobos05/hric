import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { saveSessionContactMeta } from "@/lib/investorMeta";
import {
  MapPin, DollarSign, TrendingUp, Clock, Target, Award, Briefcase, MessageSquare,
} from "lucide-react";

const InvestorCard = ({
  investor,
  matchScore = 0,
  // Nuevos props
  onSimulate,
  onToggleCompare,
  isActive = false,
  isCompared = false,
  // Back-compat
  onSelect,
  isSelected = false,
}) => {
  const navigate = useNavigate();

  const handleSimulate = () => {
    if (onSimulate){
      onSimulate(investor);
      document
        .getElementById("montecarlo")
        ?.scrollIntoView({ behavior: "smooth" });
    }
    else if (onSelect) onSelect(investor);
    
  };

  const handleToggleCompare = (e) => {
    e.stopPropagation();
    onToggleCompare?.(); // parent ya boundea investor.id
  };

  const getMatchColor = (score) => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 60) return "text-blue-600 bg-blue-50 border-blue-200";
    if (score >= 40) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getMatchLabel = (score) => {
    if (score >= 80) return "Excellent Match";
    if (score >= 60) return "Good Match";
    if (score >= 40) return "Fair Match";
    return "Poor Match";
  };

  const formatCheckSize = (checkSize = "") =>
    checkSize.replace(/\$(\d+)M/g, "$$$1M").replace(/\$(\d+)K/g, "$$$1K");

  // ✅ Gate de plan y sessionStorage (conservado del primer archivo)
  const planKey =
    sessionStorage.getItem("registrationPlanKey") ||
    localStorage.getItem("user_plan") ||
    "";
  const canContact = !/entrepreneur_free/i.test(planKey);

  const handleContact = (e) => {
    e.stopPropagation(); // no disparar el onClick del Card
    saveSessionContactMeta(investor);
    sessionStorage.setItem("startChatWith", investor?.name || "");
    navigate("/dashboard/entrepreneur?tab=messages");
  };

  // Soporte a ambos estilos de “selección”
  const isCardActive = Boolean(isActive || isSelected);

  return (
    <Card
      onClick={handleSimulate} // Card completo dispara Simulate / Select
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isCardActive
          ? "bg-blue-50 border-2 border-blue-500 ring-2 ring-blue-200 shadow-lg"
          : "bg-white border border-slate-200 hover:bg-slate-50 hover:shadow-md"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900">
              {investor?.name}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {investor?.type}
              </Badge>
              {investor?.founded && (
                <span className="text-sm text-gray-500">Founded {investor.founded}</span>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getMatchColor(matchScore)}`}>
              {Math.round(matchScore)}% Match
            </div>
            <div className="text-xs text-gray-500 mt-1">{getMatchLabel(matchScore)}</div>
          </div>
        </div>
      </CardHeader>

      {/* stopPropagation para que botones no activen el click del Card */}
      <CardContent className="space-y-4" onClick={(e) => e.stopPropagation()}>
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">{investor?.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">{formatCheckSize(investor?.checkSize)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">{investor?.portfolioSize} companies</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">{investor?.aum} AUM</span>
          </div>
        </div>

        {/* Investment Focus */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Investment Focus</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {(investor?.stage ?? []).map((stage, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{stage}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {(investor?.industries ?? []).slice(0, 3).map((ind, i) => (
              <Badge key={i} variant="outline" className="text-xs">{ind}</Badge>
            ))}
            {Array.isArray(investor?.industries) && investor.industries.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{investor.industries.length - 3} more
              </Badge>
            )}
          </div>
        </div>

        {/* Investment Behavior */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-3 w-3 text-gray-400" />
              <span className="text-gray-600">Avg Deal Time</span>
            </div>
            <span className="font-medium">{investor?.avgDealTime}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Award className="h-3 w-3 text-gray-400" />
              <span className="text-gray-600">Follow-on Rate</span>
            </div>
            <span className="font-medium">{investor?.followOnRate}%</span>
          </div>
        </div>

        {/* Thesis */}
        {investor?.investmentThesis && (
          <p className="text-sm text-gray-600 italic">"{investor.investmentThesis}"</p>
        )}

        {/* Recent Activity */}
        {typeof investor?.recentInvestments !== "undefined" && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Recent investments:</span>
            <span className="font-medium text-green-600">
              {investor.recentInvestments} this year
            </span>
          </div>
        )}

        {/* Match Score Progress */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">Investment Likelihood</span>
            <span className="text-sm font-medium">{Math.round(matchScore)}%</span>
          </div>
          <Progress value={matchScore} className="h-2" />
        </div>

        {/* Notable Portfolio */}
        {!!(investor?.portfolioCompanies?.length) && (
          <div>
            <div className="text-sm text-gray-600 mb-1">Notable Portfolio:</div>
            <div className="text-sm text-gray-800">
              {investor.portfolioCompanies.slice(0, 3).join(", ")}
              {investor.portfolioCompanies.length > 3 &&
                ` +${investor.portfolioCompanies.length - 3} more`}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            className="text-xs px-2 py-1 rounded bg-blue-600 text-white"
            onClick={handleSimulate}
          >
            Simulate
          </button>

          <label className="text-xs inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isCompared}
              onChange={handleToggleCompare}
            />
            Compare
          </label>

          {isCardActive && (
            <span className="ml-auto text-[11px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Active
            </span>
          )}
        </div>

        {/* ✅ Contact (solo planes no free, mantiene sessionStorage + navigate) */}
        {canContact && (
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

export default InvestorCard;