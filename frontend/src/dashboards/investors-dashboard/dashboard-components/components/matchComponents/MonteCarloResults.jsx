// src/components/matchComponents/MonteCarloResults.jsx
import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, Target, BarChart3 } from "lucide-react";

const clampPct = (x) => Math.max(0, Math.min(100, Number.isFinite(x) ? x : 0));
const nFmt = (x, d = 0) =>
  Number.isFinite(x) ? Number(x).toFixed(d) : "—";

// Normal CDF for fallback probability (score ≥ 50) when no samples
const normalCdf = (x, mean, sd) => {
  if (!Number.isFinite(sd) || sd <= 0) return x >= mean ? 1 : 0;
  const z = (x - mean) / (sd * Math.SQRT2);
  // erf approximation
  const erf =
    (t) => {
      // Abramowitz & Stegun 7.1.26
      const s = Math.sign(t);
      t = Math.abs(t);
      const a1 = 0.254829592,
        a2 = -0.284496736,
        a3 = 1.421413741,
        a4 = -1.453152027,
        a5 = 1.061405429,
        p = 0.3275911;
      const u = 1 / (1 + p * t);
      const e =
        1 -
        (((((a5 * u + a4) * u + a3) * u + a2) * u + a1) * u) *
          Math.exp(-t * t);
      return s * e;
    };
  return 0.5 * (1 + erf(z));
};

const getRiskColor = (riskLevel) => {
  switch (riskLevel) {
    case "Low":
      return "bg-green-100 text-green-800";
    case "Medium":
      return "bg-yellow-100 text-yellow-800";
    case "High":
      return "bg-orange-100 text-orange-800";
    case "Very High":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const buildHistogram = (samples, min, max, bins = 20) => {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const arr = Array(bins)
    .fill(0)
    .map((_, i) => {
      const lo = min + (i * (max - min)) / bins;
      const hi = min + ((i + 1) * (max - min)) / bins;
      return {
        lo,
        hi,
        range: `${Math.round(lo)}–${Math.round(hi)}`,
        count: 0,
      };
    });

  if (Array.isArray(samples) && samples.length) {
    const w = (max - min) / bins || 1;
    for (const v of samples) {
      const idx = clamp(Math.floor((v - min) / w), 0, bins - 1);
      arr[idx].count += 1;
    }
    return arr;
  }

  // Fallback: approximate with normal curve if we don't have raw samples
  const mean = (min + max) / 2;
  const sd = (max - min) / 6 || 1; // rough spread
  arr.forEach((b) => {
    const mid = (b.lo + b.hi) / 2;
    const norm = Math.exp(-0.5 * ((mid - mean) / sd) ** 2);
    b.count = Math.round(norm * 100);
  });
  return arr;
};

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

  const displayName =
    selectedStartup?.name ||
    selectedStartup?.startup_name ||
    selectedStartup?.company_name ||
    "Selected Startup";

  const runs =
    (Array.isArray(simulationResults.samples) &&
      simulationResults.samples.length) ||
    1000;

  // Prepare histogram (uses real samples if available)
  const histogramData = buildHistogram(
    simulationResults.samples,
    simulationResults.min,
    simulationResults.max,
    20
  );

  // Confidence bar positioning (clamped)
  const lower = clampPct(simulationResults.confidence95Lower);
  const upper = clampPct(simulationResults.confidence95Upper);
  const p25 = clampPct(simulationResults.percentile25);
  const p75 = clampPct(simulationResults.percentile75);
  const mean = clampPct(simulationResults.mean);
  const ciWidth = Math.max(0, upper - lower);
  const iqrWidth = Math.max(0, p75 - p25);

  // Probability of “success” (score ≥ 50)
  let probAbove50 = 0;
  if (Array.isArray(simulationResults.samples) && simulationResults.samples.length) {
    const ok = simulationResults.samples.filter((v) => v >= 50).length;
    probAbove50 = Math.round((ok / simulationResults.samples.length) * 100);
  } else {
    // normal approximation
    const p = 1 - normalCdf(50, simulationResults.mean, simulationResults.stdDev);
    probAbove50 = Math.round(p * 100);
  }

  const cv =
    simulationResults.mean > 0
      ? ((simulationResults.stdDev / simulationResults.mean) * 100).toFixed(1)
      : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Monte Carlo Analysis: {displayName}
          </CardTitle>
          <p className="text-sm text-gray-600">
            Risk assessment based on {runs} simulation runs with market
            uncertainty factors
          </p>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Expected Score
                </p>
                <p className="text-2xl font-bold">{nFmt(simulationResults.mean)}%</p>
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
                <p className="text-2xl font-bold">{nFmt(simulationResults.stdDev)}%</p>
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
                <p className="text-2xl font-bold">{nFmt(simulationResults.max)}%</p>
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
                <p className="text-2xl font-bold">{nFmt(simulationResults.min)}%</p>
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
                    formatter={(value) => [value, "Frequency"]}
                    labelFormatter={(label) => `Score Range: ${label}%`}
                  />
                  <Bar dataKey="count" fill="#8884d8"/>
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
                      left: `${lower}%`,
                      width: `${ciWidth}%`,
                    }}
                  />
                  {/* Interquartile Range */}
                  <div
                    className="absolute h-full bg-blue-400"
                    style={{
                      left: `${p25}%`,
                      width: `${iqrWidth}%`,
                    }}
                  />
                  {/* Mean line */}
                  <div
                    className="absolute h-full w-1 bg-red-500"
                    style={{ left: `${mean}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs mt-2">
                  <span>95% CI: {nFmt(simulationResults.confidence95Lower)}%</span>
                  <span>Mean: {nFmt(simulationResults.mean)}%</span>
                  <span>95% CI: {nFmt(simulationResults.confidence95Upper)}%</span>
                </div>
              </div>

              {/* Statistical Summary */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">25th Percentile:</span>
                    <span className="font-medium">
                      {nFmt(simulationResults.percentile25)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">75th Percentile:</span>
                    <span className="font-medium">
                      {nFmt(simulationResults.percentile75)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Interquartile Range:</span>
                    <span className="font-medium">
                      {nFmt(
                        simulationResults.percentile75 -
                          simulationResults.percentile25,
                        1
                      )}
                      %
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Standard Deviation:</span>
                    <span className="font-medium">
                      {nFmt(simulationResults.stdDev)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Coefficient of Variation:
                    </span>
                    <span className="font-medium">{cv}%</span>
                  </div>
                  <div className="flex justify-between items-center">
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
                {nFmt(probAbove50)}
                %
              </div>
              <div className="text-sm text-green-600">
                Probability of Success
              </div>
              <div className="text-xs text-gray-500 mt-1">Score ≥ 50%</div>
            </div>

            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">
                {nFmt(simulationResults.confidence95Upper - simulationResults.confidence95Lower, 1)}%
              </div>
              <div className="text-sm text-blue-600">Uncertainty Range</div>
              <div className="text-xs text-gray-500 mt-1">
                95% confidence interval width
              </div>
            </div>

            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">
                {simulationResults.mean > 0
                  ? nFmt(
                      ((simulationResults.mean -
                        simulationResults.confidence95Lower) /
                        simulationResults.mean) *
                        100,
                      0
                    )
                  : "—"}
                %
              </div>
              <div className="text-sm text-purple-600">Downside Risk</div>
              <div className="text-xs text-gray-500 mt-1">
                Potential score reduction
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Interpretation</h4>
            <p className="text-sm text-gray-700">
              This startup has an expected match score of{" "}
              <strong>{nFmt(simulationResults.mean)}%</strong> with a{" "}
              <strong>{String(simulationResults.riskLevel).toLowerCase()}</strong>{" "}
              risk profile. The simulation suggests a 95% probability that the
              actual match score will fall between{" "}
              <strong>{nFmt(simulationResults.confidence95Lower)}%</strong> and{" "}
              <strong>{nFmt(simulationResults.confidence95Upper)}%</strong>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonteCarloResults;
