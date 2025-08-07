import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SpiderChart = ({ startups, selectedStartups = [] }) => {
  // If no specific startups selected, show top 3
  const startupsToShow = selectedStartups.length > 0 ? selectedStartups : startups.slice(0, 3);
  
  // Prepare data for radar chart
  const prepareRadarData = () => {
    const metrics = [
      { key: 'roi_category', label: 'ROI Potential', max: 100 },
      { key: 'percent_technical_founders', label: 'Technical Founders', max: 100 },
      { key: 'percent_previous_exits', label: 'Previous Exits', max: 100 },
      { key: 'revenue_scalar', label: 'Revenue Performance', max: 100 },
      { key: 'team_experience_level', label: 'Team Experience', max: 100 },
      { key: 'market_position', label: 'Market Position', max: 100 }
    ];

    return metrics.map(metric => {
      const dataPoint = { metric: metric.label };
      
      startupsToShow.forEach((startup, index) => {
        let value = 0;
        
        switch (metric.key) {
          case 'roi_category':
            value = startup.roi_category === 'High' ? 90 : startup.roi_category === 'Medium' ? 60 : 30;
            break;
          case 'percent_technical_founders':
            value = startup.percent_technical_founders;
            break;
          case 'percent_previous_exits':
            value = startup.percent_previous_exits;
            break;
          case 'revenue_scalar':
            value = startup.revenue_scalar * 100;
            break;
          case 'team_experience_level':
            value = startup.team_experience_level === 'High' ? 85 : startup.team_experience_level === 'Medium' ? 60 : 35;
            break;
          case 'market_position':
            // Calculate based on valuation and stage
            const stageMultiplier = startup.stage === 'Late' ? 1.2 : startup.stage === 'Growth' ? 1.0 : 0.8;
            value = Math.min(100, (startup.valuation / 1000000) * stageMultiplier * 2);
            break;
          default:
            value = 50;
        }
        
        dataPoint[`startup_${index}`] = Math.round(value);
      });
      
      return dataPoint;
    });
  };

  const radarData = prepareRadarData();
  
  // Colors for different startups
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Startup Comparison Radar</CardTitle>
        <p className="text-sm text-gray-600">
          Multi-dimensional comparison of {startupsToShow.length} selected startups
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
              
              {startupsToShow.map((startup, index) => (
                <Radar
                  key={`startup_${index}`}
                  name={startup.startup_name}
                  dataKey={`startup_${index}`}
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              ))}
              
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          {startupsToShow.map((startup, index) => (
            <div key={startup.id} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="truncate">{startup.startup_name}</span>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Metrics Explanation:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
            <div><strong>ROI Potential:</strong> Expected return category</div>
            <div><strong>Technical Founders:</strong> % of technical co-founders</div>
            <div><strong>Previous Exits:</strong> % of successful exits</div>
            <div><strong>Revenue Performance:</strong> Current revenue strength</div>
            <div><strong>Team Experience:</strong> Overall team expertise level</div>
            <div><strong>Market Position:</strong> Valuation-based market standing</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SpiderChart;

