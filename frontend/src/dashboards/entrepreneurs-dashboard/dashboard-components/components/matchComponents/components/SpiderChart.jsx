import React from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SpiderChart = ({ investors = [] }) => {
  const investorsToShow =  investors;

  const prepareRadarData = () => {
    const metrics = [
      { key: 'revenueGrowth', label: 'Revenue Growth' },
      { key: 'teamExperience', label: 'Team Experience' },
      { key: 'marketSize', label: 'Market Size' },
      { key: 'traction', label: 'Traction' },
      { key: 'geography', label: 'Geographic Scope' },
      { key: 'techFounders', label: 'Tech Founder Bias' }
    ];

    return metrics.map(metric => {
      const dataPoint = { metric: metric.label };

      investorsToShow.forEach((inv, index) => {
        const val = inv.preferences?.[metric.key] ?? 0;
        dataPoint[`investor_${index}`] = Math.round(val);
      });

      return dataPoint;
    });
  };

  const radarData = prepareRadarData();
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Investor Preference Radar</CardTitle>
        <p className="text-sm text-gray-600">
          Multi-dimensional comparison of {investorsToShow.length} selected investor{investorsToShow.length > 1 ? 's' : ''}
        </p>
      </CardHeader>

      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <PolarGrid />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fontSize: 12, fill: '#666' }}
                className="text-xs"
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#999' }}
                tickCount={5}
              />

              {investorsToShow.map((inv, index) => (
                <Radar
                  key={`investor_${index}`}
                  name={inv.name}
                  dataKey={`investor_${index}`}
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              ))}

              <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          {investorsToShow.map((inv, index) => (
            <div key={inv.id || index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="truncate">{inv.name}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Metrics Explanation:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
            <div><strong>Revenue Growth:</strong> Expected growth preference</div>
            <div><strong>Team Experience:</strong> Weight on experienced teams</div>
            <div><strong>Market Size:</strong> Focus on large opportunity markets</div>
            <div><strong>Traction:</strong> Early traction signals importance</div>
            <div><strong>Geographic Scope:</strong> Local vs global preference</div>
            <div><strong>Tech Founder Bias:</strong> Preference for technical founding teams</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SpiderChart;
