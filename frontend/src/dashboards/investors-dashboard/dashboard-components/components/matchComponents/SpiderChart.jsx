import React from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SpiderChart = ({ investors = [], selectedInvestors = [] }) => {
  // treat incoming "investors" as startups; pick what to show
  const startupsToShow = (selectedInvestors && selectedInvestors.length > 0)
    ? selectedInvestors
    : (investors || []).slice(0, 3);

  // ---- helpers ----
  const clamp01 = (x) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
  const safeMinMax = (arr, defMin, defMax) => {
    const vals = arr.filter((v) => Number.isFinite(v) && v > 0);
    let min = vals.length ? Math.min(...vals) : defMin;
    let max = vals.length ? Math.max(...vals) : defMax;
    if (min === max) max = min + (min || 1); // avoid /0
    return [min, max];
  };
  const norm01 = (v, min, max) => {
    const n = (Number(v) || 0);
    return clamp01((n - min) / (max - min));
  };

  // global ranges (based on ALL items for a consistent axis)
  const revenueAll = (investors || []).map(s => s?.revenueMonthlyUSD ?? 0);
  const employeesAll = (investors || []).map(s => s?.employees ?? 0);
  const valuationAll = (investors || []).map(s => s?.valuationUSD ?? 0);

  const [revMin, revMax] = safeMinMax(revenueAll, 10_000, 600_000);
  const [empMin, empMax] = safeMinMax(employeesAll, 5, 150);
  const [valMin, valMax] = safeMinMax(valuationAll, 10_000_000, 150_000_000);

  // metric calculators -> 0..100
  const roiPotentialPct = (s) => {
    const km = s?.keyMetrics || {};
    const growth = clamp01(km.revenueGrowthYoY ?? 0);
    const margin = clamp01(km.grossMargin ?? 0);
    return Math.round((0.6 * growth + 0.4 * margin) * 100);
  };
  const technicalFoundersPct = (s) =>
    Math.round(clamp01(s?.keyMetrics?.technicalFounders ?? 0) * 100);
  const previousExitsPct = (s) =>
    Math.round(clamp01(s?.keyMetrics?.previousExits ?? 0) * 100);
  const revenuePerformancePct = (s) =>
    Math.round(norm01(s?.revenueMonthlyUSD ?? 0, revMin, revMax) * 100);
  const teamExperiencePct = (s) =>
    Math.round(norm01(s?.employees ?? 0, empMin, empMax) * 100);
  const marketPositionPct = (s) =>
    Math.round(norm01(s?.valuationUSD ?? 0, valMin, valMax) * 100);

  // Build radar rows for Recharts
  const METRICS = [
    { key: 'roi', label: 'ROI Potential', fn: roiPotentialPct },
    { key: 'techFounders', label: 'Technical Founders', fn: technicalFoundersPct },
    { key: 'prevExits', label: 'Previous Exits', fn: previousExitsPct },
    { key: 'revenuePerf', label: 'Revenue Performance', fn: revenuePerformancePct },
    { key: 'teamExp', label: 'Team Experience', fn: teamExperiencePct },
    { key: 'marketPos', label: 'Market Position', fn: marketPositionPct },
  ];

  const radarData = METRICS.map(({ label, fn }) => {
    const row = { metric: label };
    startupsToShow.forEach((s, idx) => {
      row[`series_${idx}`] = fn(s);
    });
    return row;
  });

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#a4de6c'];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Startup Metrics Radar</CardTitle>
        <p className="text-sm text-gray-600">
          Comparing {startupsToShow.length} selected startup{startupsToShow.length > 1 ? 's' : ''}
        </p>
      </CardHeader>

      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: '#666' }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: '#999' }} tickCount={5} />
              {startupsToShow.map((s, idx) => (
                <Radar
                  key={`series_${idx}`}
                  name={s.name}
                  dataKey={`series_${idx}`}
                  stroke={colors[idx % colors.length]}
                  fill={colors[idx % colors.length]}
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              ))}
              <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          {startupsToShow.map((s, idx) => (
            <div key={s.id || idx} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors[idx % colors.length] }}
              />
              <span className="truncate">{s.name}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Metrics Explanation</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
            <div><strong>ROI Potential:</strong> Expected return proxy (growth + margin)</div>
            <div><strong>Technical Founders:</strong> % of technical co-founders</div>
            <div><strong>Previous Exits:</strong> % of successful exits</div>
            <div><strong>Revenue Performance:</strong> Current revenue strength (normalized)</div>
            <div><strong>Team Experience:</strong> Team expertise via size (normalized)</div>
            <div><strong>Market Position:</strong> Valuation-based standing (normalized)</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SpiderChart;