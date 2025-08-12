import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, DollarSign, TrendingUp, Clock, Target, Award, Briefcase, MessageSquare,
} from 'lucide-react';

const InvestorCard = ({ investor, matchScore, onSelect, isSelected }) => {
  const navigate = useNavigate();

  const getMatchColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-blue-600 bg-blue-100 border-blue-200';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getMatchLabel = (score) => {
    if (score >= 80) return 'Excellent Match';
    if (score >= 60) return 'Good Match';
    if (score >= 40) return 'Fair Match';
    return 'Poor Match';
  };

  const formatCheckSize = (checkSize) =>
    checkSize.replace(/\$(\d+)M/g, '$$$1M').replace(/\$(\d+)K/g, '$$$1K');

  // plan gate: show "Contact" only if NOT free
  const planKey =
    sessionStorage.getItem('registrationPlanKey') ||
    localStorage.getItem('user_plan') ||
    '';
  const canContact = !/entrepreneur_free/i.test(planKey);

  const handleContact = (e) => {
    e.stopPropagation(); // don’t toggle card selection
    // tell MessagesDashboard which thread to open
    sessionStorage.setItem('startChatWith', investor.name);
    // go to Messages tab on entrepreneur dashboard
    navigate('/dashboard/entrepreneur?tab=messages');
  };

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isSelected
          ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200 shadow-md'
          : 'bg-white border-slate-200 hover:bg-slate-50 hover:shadow-md'
      }`}
      onClick={() => onSelect(investor)}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900">
              {investor.name}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {investor.type}
              </Badge>
              <span className="text-sm text-gray-500">
                Founded {investor.founded}
              </span>
            </div>
          </div>
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
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">{investor.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {formatCheckSize(investor.checkSize)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {investor.portfolioSize} companies
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">{investor.aum} AUM</span>
          </div>
        </div>

        {/* Investment Focus */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">
              Investment Focus
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {investor.stage.map((stage, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {stage}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {investor.industries.slice(0, 3).map((industry, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {industry}
              </Badge>
            ))}
            {investor.industries.length > 3 && (
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
            <span className="font-medium">{investor.avgDealTime}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Award className="h-3 w-3 text-gray-400" />
              <span className="text-gray-600">Follow-on Rate</span>
            </div>
            <span className="font-medium">{investor.followOnRate}%</span>
          </div>
        </div>

        {/* Investment Thesis */}
        <p className="text-sm text-gray-600 italic">
          "{investor.investmentThesis}"
        </p>

        {/* Recent Activity */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Recent investments:</span>
          <span className="font-medium text-green-600">
            {investor.recentInvestments} this year
          </span>
        </div>

        {/* Match Score Progress */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">Investment Likelihood</span>
            <span className="text-sm font-medium">
              {Math.round(matchScore)}%
            </span>
          </div>
          <Progress value={matchScore} className="h-2" />
        </div>

        {/* Notable Portfolio Companies */}
        {!!(investor.portfolioCompanies?.length) && (
          <div>
            <div className="text-sm text-gray-600 mb-1">Notable Portfolio:</div>
            <div className="text-sm text-gray-800">
              {investor.portfolioCompanies.slice(0, 3).join(', ')}
              {investor.portfolioCompanies.length > 3 &&
                ` +${investor.portfolioCompanies.length - 3} more`}
            </div>
          </div>
        )}

        {/* ✅ Contact (only for non-free plans) */}
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