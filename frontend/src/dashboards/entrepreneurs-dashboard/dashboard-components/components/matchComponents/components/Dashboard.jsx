import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, DollarSign, Award } from 'lucide-react';

const Dashboard = ({ investors, filteredInvestors }) => {
  const totalInvestors = investors.length;
  const filteredCount = filteredInvestors.length;

  const avgCheckSize = filteredInvestors.reduce((sum, inv) => {
    const size = parseFloat(inv.checkSize?.split(' - ')[0]?.replace(/[$M]/g, '')) || 0;
    return sum + size;
  }, 0) / (filteredCount || 1);

  const avgPortfolioSize = filteredInvestors.reduce((sum, inv) => sum + (inv.portfolioSize || 0), 0) / (filteredCount || 1);

  const avgFollowOnRate = filteredInvestors.reduce((sum, inv) => sum + (inv.followOnRate || 0), 0) / (filteredCount || 1);

  // Stage preferences across filtered investors
  const stageDistribution = filteredInvestors.reduce((acc, investor) => {
    (investor.stage || []).forEach(stage => {
      acc[stage] = (acc[stage] || 0) + 1;
    });
    return acc;
  }, {});
  const stageData = Object.entries(stageDistribution).map(([stage, count]) => ({ stage, count }));

  // Industry distribution
  const industryDistribution = filteredInvestors.reduce((acc, investor) => {
    (investor.industries || []).forEach(ind => {
      acc[ind] = (acc[ind] || 0) + 1;
    });
    return acc;
  }, {});
  const industryData = Object.entries(industryDistribution).map(([industry, count]) => ({ industry, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Deal Time vs Check Size
  const scatterData = filteredInvestors.map(inv => ({
    dealTime: parseInt(inv.avgDealTime?.split('-')[0]) || 0,
    checkSize: parseFloat(inv.checkSize?.split(' - ')[0]?.replace(/[$M]/g, '')) || 0,
    name: inv.name
  }));

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Matched Investors</p>
                <p className="text-2xl font-bold">{filteredCount}</p>
                <p className="text-xs text-gray-500">of {totalInvestors} total</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Check Size</p>
                <p className="text-2xl font-bold">${avgCheckSize.toFixed(1)}M</p>
                <p className="text-xs text-gray-500">typical ticket</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Portfolio</p>
                <p className="text-2xl font-bold">{Math.round(avgPortfolioSize)}</p>
                <p className="text-xs text-gray-500">companies per fund</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Follow-on Rate</p>
                <p className="text-2xl font-bold">{Math.round(avgFollowOnRate)}%</p>
                <p className="text-xs text-gray-500">average behavior</p>
              </div>
              <Award className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage Distribution */}
        <Card>
          <CardHeader><CardTitle>Stage Preferences</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={stageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Industry Focus */}
        <Card>
          <CardHeader><CardTitle>Top Industries</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={industryData} dataKey="count" cx="50%" cy="50%" outerRadius={80} label>
                    {industryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Deal Time vs Check Size */}
        <Card>
          <CardHeader><CardTitle>Deal Time vs Check Size</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dealTime" name="Deal Time (months)" />
                  <YAxis dataKey="checkSize" name="Check Size ($M)" />
                  <Tooltip />
                  <Scatter dataKey="checkSize" data={scatterData} fill="#82ca9d" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
