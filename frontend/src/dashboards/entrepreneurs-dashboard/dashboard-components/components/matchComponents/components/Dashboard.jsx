import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, DollarSign, Target } from 'lucide-react';

const Dashboard = ({ startups, filteredStartups }) => {
  // Calculate key metrics
  const totalStartups = startups.length;
  const filteredCount = filteredStartups.length;
  const avgValuation = filteredStartups.reduce((sum, s) => sum + s.valuation, 0) / filteredCount || 0;
  const totalFunding = filteredStartups.reduce((sum, s) => sum + s.funding_amount, 0);
  const currentlyRaisingCount = filteredStartups.filter(s => s.currently_raising).length;

  // Prepare data for charts
  const stageDistribution = filteredStartups.reduce((acc, startup) => {
    acc[startup.stage] = (acc[startup.stage] || 0) + 1;
    return acc;
  }, {});

  const stageData = Object.entries(stageDistribution).map(([stage, count]) => ({
    stage,
    count,
    percentage: Math.round((count / filteredCount) * 100)
  }));

  const industryDistribution = filteredStartups.reduce((acc, startup) => {
    acc[startup.industry] = (acc[startup.industry] || 0) + 1;
    return acc;
  }, {});

  const industryData = Object.entries(industryDistribution).map(([industry, count]) => ({
    industry,
    count
  })).sort((a, b) => b.count - a.count).slice(0, 6);

  const locationDistribution = filteredStartups.reduce((acc, startup) => {
    acc[startup.location] = (acc[startup.location] || 0) + 1;
    return acc;
  }, {});

  const locationData = Object.entries(locationDistribution).map(([location, count]) => ({
    location,
    count
  }));

  // Valuation vs Revenue scatter plot data
  const scatterData = filteredStartups.map(startup => ({
    valuation: startup.valuation / 1000000, // Convert to millions
    revenue: startup.monthly_revenue * 12 / 1000000, // Annual revenue in millions
    name: startup.startup_name,
    stage: startup.stage
  }));

  const formatCurrency = (amount) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount}`;
  };

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Matched Startups</p>
                <p className="text-2xl font-bold">{filteredCount}</p>
                <p className="text-xs text-gray-500">of {totalStartups} total</p>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Valuation</p>
                <p className="text-2xl font-bold">{formatCurrency(avgValuation)}</p>
                <p className="text-xs text-gray-500">across matches</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Funding</p>
                <p className="text-2xl font-bold">{formatCurrency(totalFunding)}</p>
                <p className="text-xs text-gray-500">raised to date</p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Currently Raising</p>
                <p className="text-2xl font-bold">{currentlyRaisingCount}</p>
                <p className="text-xs text-gray-500">active opportunities</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Stage Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [value, 'Count']}
                    labelFormatter={(label) => `Stage: ${label}`}
                  />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Industry Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Top Industries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={industryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ industry, percentage }) => `${industry} (${percentage || Math.round((industryData.find(d => d.industry === industry)?.count / filteredCount) * 100)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
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

        {/* Location Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Geographic Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="location" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Valuation vs Revenue Scatter */}
        <Card>
          <CardHeader>
            <CardTitle>Valuation vs Annual Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart data={scatterData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="revenue" 
                    name="Annual Revenue" 
                    unit="M"
                    label={{ value: 'Annual Revenue ($M)', position: 'insideBottom', offset: -10 }}
                  />
                  <YAxis 
                    dataKey="valuation" 
                    name="Valuation" 
                    unit="M"
                    label={{ value: 'Valuation ($M)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'valuation' ? `$${value}M` : `$${value}M`,
                      name === 'valuation' ? 'Valuation' : 'Annual Revenue'
                    ]}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.name || ''}
                  />
                  <Scatter dataKey="valuation" fill="#8884d8" />
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

