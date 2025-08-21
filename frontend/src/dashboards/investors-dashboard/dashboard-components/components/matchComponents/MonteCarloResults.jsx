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
const nFmt = (x, d = 0) => (Number.isFinite(x) ? Number(x).toFixed(d) : "—");

// ---- math helpers ----
const normalCdf = (x, mean, sd) => {
  if (!Number.isFinite(sd) || sd <= 0) return x >= mean ? 1 : 0;
  const z = (x - mean) / (sd * Math.SQRT2);
  const erf = (t) => {
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
      (((((a5 * u + a4) * u + a3) * u + a2) * u + a1) * u) * Math.exp(-t * t);
    return s * e;
  };
  return 0.5 * (1 + erf(z));
};

const quantile = (arr, q) => {
  if (!Array.isArray(arr) || arr.length === 0) return NaN;
  const a = [...arr].sort((x, y) => x - y);
  const idx = (a.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return a[lo];
  const w = idx - lo;
  return a[lo] * (1 - w) + a[hi] * w;
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
      return { lo, hi, range: `${Math.round(lo)}–${Math.round(hi)}`, count: 0 };
    });

  if (Array.isArray(samples) && samples.length) {
    const w = (max - min) / bins || 1;
    for (const v of samples) {
      const idx = clamp(Math.floor((v - min) / w), 0, bins - 1);
      arr[idx].count += 1;
    }
    return arr;
  }

  // fallback: rough bell shape
  const mean = (min + max) / 2;
  const sd = (max - min) / 6 || 1;
  arr.forEach((b) => {
    const mid = (b.lo + b.hi) / 2;
    const norm = Math.exp(-0.5 * ((mid - mean) / sd) ** 2);
    b.count = Math.round(norm * 100);
  });
  return arr;
};

const probabilityGE = (samples, threshold, mean, sd) => {
  if (Array.isArray(samples) && samples.length) {
    const ok = samples.filter((v) => v >= threshold).length;
    return (ok / samples.length) * 100;
  }
  // normal approx fallback
  return (1 - normalCdf(threshold, mean, sd)) * 100;
};

const probabilityLE = (samples, threshold, mean, sd) => {
  if (Array.isArray(samples) && samples.length) {
    const ok = samples.filter((v) => v <= threshold).length;
    return (ok / samples.length) * 100;
  }
  // normal approx fallback
  return normalCdf(threshold, mean, sd) * 100;
};

const MonteCarloResults = ({
  selectedStartup,
  simulationResults,
  successThreshold = 60, // <-- make "success" explicit & stricter than 50 by default
  topTierThreshold = 80,
  downsideThreshold = 40,
}) => {
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

  const samples = Array.isArray(simulationResults.samples)
    ? simulationResults.samples
    : null;

  const runs = (samples && samples.length) || 1000;

  // True percentiles & median from samples when possible
  const p05 = samples ? quantile(samples, 0.05) : simulationResults.confidence95Lower;
  const p50 = samples ? quantile(samples, 0.5) : (simulationResults.percentile25 + simulationResults.percentile75) / 2;
  const p95 = samples ? quantile(samples, 0.95) : simulationResults.confidence95Upper;

  // Histogram uses real samples if available
  const histogramData = buildHistogram(
    samples,
    simulationResults.min,
    simulationResults.max,
    20
  );

  // Confidence bar (still using 2.5/97.5 from engine)
  const lower = clampPct(simulationResults.confidence95Lower);
  const upper = clampPct(simulationResults.confidence95Upper);
  const p25 = clampPct(simulationResults.percentile25);
  const p75 = clampPct(simulationResults.percentile75);
  const mean = clampPct(simulationResults.mean);
  const ciWidth = Math.max(0, upper - lower);
  const iqrWidth = Math.max(0, p75 - p25);

  // Concrete probabilities
  const pSuccess = clampPct(
    probabilityGE(samples, successThreshold, simulationResults.mean, simulationResults.stdDev)
  );
  const pTopTier = clampPct(
    probabilityGE(samples, topTierThreshold, simulationResults.mean, simulationResults.stdDev)
  );
  const pDownside = clampPct(
    probabilityLE(samples, downsideThreshold, simulationResults.mean, simulationResults.stdDev)
  );

  // Conditional downside severity (expected score given it’s below downsideThreshold)
  let expectedShortfall = "—";
  if (samples && samples.length) {
    const tail = samples.filter((v) => v <= downsideThreshold);
    if (tail.length) {
      expectedShortfall = nFmt(
        tail.reduce((a, b) => a + b, 0) / tail.length,
        1
      );
    }
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
            {runs} simulation runs with market uncertainty. Thresholds shown:{" "}
            <span className="font-medium">{successThreshold}%</span> (success),{" "}
            <span className="font-medium">{topTierThreshold}%</span> (top-tier),{" "}
            <span className="font-medium">{downsideThreshold}%</span> (downside).
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
                <p className="text-2xl font-bold">
                  {nFmt(simulationResults.mean)}%
                </p>
                <p className="text-xs text-gray-500">Median: {nFmt(p50, 1)}%</p>
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
                <p className="text-2xl font-bold">
                  {nFmt(simulationResults.stdDev)}%
                </p>
                <Badge className={getRiskColor(simulationResults.riskLevel)}>
                  {simulationResults.riskLevel} Risk
                </Badge>
                <p className="text-xs text-gray-500 mt-1">CV: {cv}%</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Upper Tail</p>
                <p className="text-2xl font-bold">{nFmt(p95, 1)}%</p>
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
                <p className="text-sm font-medium text-gray-600">Lower Tail</p>
                <p className="text-2xl font-bold">{nFmt(p05, 1)}%</p>
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
              Frequency of simulated match scores
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
              95% CI and interquartile range (IQR)
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
                  {/* 95% Confidence Interval (2.5%–97.5%) */}
                  <div
                    className="absolute h-full bg-blue-200"
                    style={{ left: `${lower}%`, width: `${Math.max(0, upper - lower)}%` }}
                  />
                  {/* Interquartile Range (25%–75%) */}
                  <div
                    className="absolute h-full bg-blue-400"
                    style={{ left: `${p25}%`, width: `${Math.max(0, p75 - p25)}%` }}
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
                    <span className="font-medium">{nFmt(simulationResults.percentile25)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Median (50th):</span>
                    <span className="font-medium">{nFmt(p50, 1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">75th Percentile:</span>
                    <span className="font-medium">{nFmt(simulationResults.percentile75)}%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Standard Deviation:</span>
                    <span className="font-medium">{nFmt(simulationResults.stdDev)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Coefficient of Variation:</span>
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

      {/* Concrete Risk Assessment (no vague labels) */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Success probability at an explicit threshold */}
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">
                {nFmt(pSuccess, 0)}%
              </div>
              <div className="text-sm text-green-600">
                P(Score ≥ {successThreshold}%)
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Share of runs at or above success threshold
              </div>
            </div>

            {/* Top-tier probability */}
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">
                {nFmt(pTopTier, 0)}%
              </div>
              <div className="text-sm text-blue-600">
                P(Score ≥ {topTierThreshold}%)
              </div>
              <div className="text-xs text-gray-500 mt-1">High-confidence band</div>
            </div>

            {/* Downside probability + severity */}
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">
                {nFmt(pDownside, 0)}%
              </div>
              <div className="text-sm text-purple-600">
                P(Score ≤ {downsideThreshold}%)
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Avg when ≤ {downsideThreshold}%:{" "}
                <span className="font-medium">
                  {expectedShortfall !== "—" ? `${expectedShortfall}%` : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Interpretation</h4>
            <p className="text-sm text-gray-700">
              Expected score <strong>{nFmt(simulationResults.mean)}%</strong> (median{" "}
              <strong>{nFmt(p50, 1)}%</strong>). There is a{" "}
              <strong>{nFmt(pSuccess, 0)}%</strong> chance the score meets or exceeds{" "}
              <strong>{successThreshold}%</strong>, a{" "}
              <strong>{nFmt(pTopTier, 0)}%</strong> chance of hitting{" "}
              <strong>{topTierThreshold}%+</strong>, and a{" "}
              <strong>{nFmt(pDownside, 0)}%</strong> chance of falling to{" "}
              <strong>{downsideThreshold}%</strong> or lower
              {expectedShortfall !== "—" ? (
                <>
                  , with average downside outcome around{" "}
                  <strong>{expectedShortfall}%</strong>.
                </>
              ) : (
                "."
              )}{" "}
              The 95% CI spans{" "}
              <strong>
                {nFmt(simulationResults.confidence95Lower)}%–
                {nFmt(simulationResults.confidence95Upper)}%
              </strong>
              , indicating the uncertainty range across market conditions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonteCarloResults;
