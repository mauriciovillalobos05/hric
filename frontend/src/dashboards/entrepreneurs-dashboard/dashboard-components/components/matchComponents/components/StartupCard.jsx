import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, DollarSign, TrendingUp } from "lucide-react";

const StartupCard = ({ startup, matchScore }) => {
  const formatCurrency = (amount) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount}`;
  };

  const getRoiColor = (roi) => {
    switch (roi) {
      case "High":
        return "bg-green-100 text-green-800";
      case "Medium":
        return "bg-yellow-100 text-yellow-800";
      case "Low":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStageColor = (stage) => {
    switch (stage) {
      case "Early":
        return "bg-blue-100 text-blue-800";
      case "Growth":
        return "bg-purple-100 text-purple-800";
      case "Late":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="h-full hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold text-gray-900">
            {startup.startup_name}
          </CardTitle>
          {matchScore && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              {matchScore}% Match
            </Badge>
          )}
        </div>
        <div className="flex gap-2 mt-2">
          <Badge className={getRoiColor(startup.roi_category)}>
            {startup.roi_category} ROI
          </Badge>
          <Badge className={getStageColor(startup.stage)}>
            {startup.stage}
          </Badge>
          <Badge variant="outline">{startup.industry}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4" />
          <span>{startup.location}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="w-4 h-4" />
          <span>{startup.number_of_employees} employees</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <DollarSign className="w-4 h-4" />
          <span>{formatCurrency(startup.monthly_revenue)}/month revenue</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <TrendingUp className="w-4 h-4" />
          <span>Valuation: {formatCurrency(startup.valuation)}</span>
        </div>

        <div className="pt-2 border-t">
          <div className="text-xs text-gray-500 mb-1">Key Metrics</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Technical Founders:</span>
              <span className="ml-1 font-medium">
                {startup.percent_technical_founders}%
              </span>
            </div>
            <div>
              <span className="text-gray-500">Previous Exits:</span>
              <span className="ml-1 font-medium">
                {startup.percent_previous_exits}%
              </span>
            </div>
          </div>
        </div>

        {startup.currently_raising && (
          <Badge className="w-full justify-center bg-green-100 text-green-800">
            Currently Raising
          </Badge>
        )}

        <div className="text-xs text-gray-500">
          <div className="font-medium mb-1">Current Investors:</div>
          {Array.isArray(startup.current_investors) &&
          startup.current_investors.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {startup.current_investors.slice(0, 2).map((investor, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {investor}
                </Badge>
              ))}
              {startup.current_investors.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{startup.current_investors.length - 2} more
                </Badge>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-400 italic">
              No investors listed
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StartupCard;
