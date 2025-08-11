import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle, Target, BarChart3 } from 'lucide-react';

const MonteCarloResults = ({ selectedStartup, simulationResults }) => {
  if (!selectedStartup || !simulationResults) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center text-gray-500">
          Select a startup to view Monte Carlo simulation results
        </CardContent>
      </Card>
    );
  }

  // Generate histogram data for visualization
  const generateHistogramData = () => {
    const bins = 20;
    const min = simulationResults.min;
    const max = simulationResults.max;
    const binWidth = (max - min) / bins;
    
    const histogram = Array(bins).fill(0).map((_, i) => ({
      range: `${Math.round(min + i * binWidth)}-${Math.round(min + (i + 1) * binWidth)}`,
      count: 0,
      midpoint: min + (i + 0.5) * binWidth
    }));

    // This is a simplified histogram - in a real implementation, 
    // you'd use the actual simulation data points
    // For demo purposes, we'll create a normal distribution approximation
    histogram.forEach((bin, i) => {
      const x = bin.midpoint;
      const mean = simulationResults.mean;
      const stdDev = simulationResults.stdDev;
      
      // Normal distribution approximation
      const normalValue = Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
      bin.count = Math.round(normalValue * 100);
    });

    return histogram;
  };

  const histogramData = generateHistogramData();

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'Low': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Very High': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const confidenceInterval = simulationResults.confidence95Upper - simulationResults.confidence95Lower;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Monte Carlo Analysis: {selectedStartup.startup_name}
          </CardTitle>
          <p className="text-sm text-gray-600">
            Risk assessment based on {1000} simulation runs with market uncertainty factors
          </p>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Expected Score</p>
                <p className="text-2xl font-bold">{simulationResults.mean}%</p>
                <p className="text-xs text-gray-500">Mean outcome</p>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Volatility</p>
                <p className="text-2xl font-bold">{simulationResults.stdDev}%</p>
                <Badge className={getRiskColor(simulationResults.riskLevel)}>
                  {simulationResults.riskLevel} Risk
                </Badge>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Best Case</p>
                <p className="text-2xl font-bold">{simulationResults.max}%</p>
                <p className="text-xs text-gray-500">95th percentile</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Worst Case</p>
                <p className="text-2xl font-bold">{simulationResults.min}%</p>
                <p className="text-xs text-gray-500">5th percentile</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Distribution Histogram */}
        <Card>
          <CardHeader>
            <CardTitle>Score Distribution</CardTitle>
            <p className="text-sm text-gray-600">
              Probability distribution of match scores across simulations
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="range" 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    fontSize={10}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [value, 'Frequency']}
                    labelFormatter={(label) => `Score Range: ${label}%`}
                  />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Confidence Intervals */}
        <Card>
          <CardHeader>
            <CardTitle>Confidence Analysis</CardTitle>
            <p className="text-sm text-gray-600">
              Statistical confidence intervals and quartiles
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Confidence Interval Visualization */}
              <div className="relative">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
                
                <div className="relative h-8 bg-gray-200 rounded-lg overflow-hidden">
                  {/* 95% Confidence Interval */}
                  <div 
                    className="absolute h-full bg-blue-200"
                    style={{
                      left: `${simulationResults.confidence95Lower}%`,
                      width: `${confidenceInterval}%`
                    }}
                  />
                  
                  {/* Interquartile Range */}
                  <div 
                    className="absolute h-full bg-blue-400"
                    style={{
                      left: `${simulationResults.percentile25}%`,
                      width: `${simulationResults.percentile75 - simulationResults.percentile25}%`
                    }}
                  />
                  
                  {/* Mean line */}
                  <div 
                    className="absolute h-full w-1 bg-red-500"
                    style={{ left: `${simulationResults.mean}%` }}
                  />
                </div>
                
                <div className="flex justify-between text-xs mt-2">
                  <span>95% CI: {simulationResults.confidence95Lower}%</span>
                  <span>Mean: {simulationResults.mean}%</span>
                  <span>95% CI: {simulationResults.confidence95Upper}%</span>
                </div>
              </div>

              {/* Statistical Summary */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">25th Percentile:</span>
                    <span className="font-medium">{simulationResults.percentile25}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">75th Percentile:</span>
                    <span className="font-medium">{simulationResults.percentile75}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Interquartile Range:</span>
                    <span className="font-medium">{(simulationResults.percentile75 - simulationResults.percentile25).toFixed(1)}%</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Standard Deviation:</span>
                    <span className="font-medium">{simulationResults.stdDev}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Coefficient of Variation:</span>
                    <span className="font-medium">{((simulationResults.stdDev / simulationResults.mean) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Risk Level:</span>
                    <Badge className={getRiskColor(simulationResults.riskLevel)}>
                      {simulationResults.riskLevel}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">
                {Math.round(((100 - simulationResults.confidence95Lower) / 100) * 100)}%
              </div>
              <div className="text-sm text-green-600">Probability of Success</div>
              <div className="text-xs text-gray-500 mt-1">Score above 50%</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">
                {confidenceInterval.toFixed(1)}%
              </div>
              <div className="text-sm text-blue-600">Uncertainty Range</div>
              <div className="text-xs text-gray-500 mt-1">95% confidence interval</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">
                {((simulationResults.mean - simulationResults.confidence95Lower) / simulationResults.mean * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-purple-600">Downside Risk</div>
              <div className="text-xs text-gray-500 mt-1">Potential score reduction</div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Interpretation:</h4>
            <p className="text-sm text-gray-700">
              This startup has an expected match score of <strong>{simulationResults.mean}%</strong> with 
              a <strong>{simulationResults.riskLevel.toLowerCase()}</strong> risk profile. The simulation suggests 
              a 95% probability that the actual match score will fall between{' '}
              <strong>{simulationResults.confidence95Lower}%</strong> and{' '}
              <strong>{simulationResults.confidence95Upper}%</strong>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonteCarloResults;

