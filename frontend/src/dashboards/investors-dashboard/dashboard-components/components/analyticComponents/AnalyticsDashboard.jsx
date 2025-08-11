import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Target, TrendingUp, DollarSign, Users as UsersIcon } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function AnalyticsDashboard({ matches = [] }) {
  const {
    matchedCount,
    avgValuation,           // can be null -> renders "—"
    totalFunding,           // can be null -> renders "—"
    currentlyRaising,
    stageData,
    industryData,
  } = useMemo(() => computeAnalytics(matches), [matches]);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<Target className="h-6 w-6 text-blue-600" />}
          title="Matched Startups"
          primary={formatNumber(matchedCount)}
          subtitle={`of ${formatNumber(matchedCount)} total`}
        />
        <StatCard
          icon={<TrendingUp className="h-6 w-6 text-green-600" />}
          title="Avg Valuation"
          primary={formatMoney(avgValuation)}
          subtitle="across matches"
        />
        <StatCard
          icon={<DollarSign className="h-6 w-6 text-amber-600" />}
          title="Total Funding"
          primary={formatMoney(totalFunding)}
          subtitle="raised to date"
        />
        <StatCard
          icon={<UsersIcon className="h-6 w-6 text-purple-600" />}
          title="Currently Raising"
          primary={formatNumber(currentlyRaising)}
          subtitle="active opportunities"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Stage Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <XAxis dataKey="stage" tickLine={false} axisLine={false} tick={{ fill: "#475569" }} />
                <YAxis allowDecimals={false} width={28} tick={{ fill: "#475569" }} />
                <RTooltip formatter={(v) => [v, "Count"]} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#8B5CF6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Top Industries</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                <RTooltip formatter={(v, n, p) => [`${v} (${p?.payload?.pct}%)`, p?.payload?.name]} />
                <Pie
                  data={industryData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  labelLine={false}
                  label={renderPieLabel}
                >
                  {industryData.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------ helpers ------------------------ */

function StatCard({ icon, title, primary, subtitle }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-6 flex items-center gap-4">
        <div className="p-3 rounded-full bg-slate-50">{icon}</div>
        <div className="space-y-1">
          <div className="text-sm text-slate-500">{title}</div>
          <div className="text-2xl font-semibold text-slate-900">{primary}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
      </CardContent>
    </Card>
  );
}

const PIE_COLORS = ["#F59E0B", "#EF4444", "#10B981", "#8B5CF6", "#3B82F6", "#22C55E", "#A855F7"];

function renderPieLabel({ cx, cy, midAngle, outerRadius, payload }) {
  const RAD = Math.PI / 180;
  const r = outerRadius + 18;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  const anchor = x > cx ? "start" : "end";
  return (
    <text x={x} y={y} fill="#0f172a" fontSize={12} textAnchor={anchor} dominantBaseline="central">
      {`${payload.name} (${payload.pct}%)`}
    </text>
  );
}

function computeAnalytics(matches) {
  const m = Array.isArray(matches) ? matches : [];

  // Prefer camelCase used in your mocks, fall back to snake_case/others
  const getNum = (obj, keys) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (typeof v === "number" && !Number.isNaN(v)) return v;
      if (typeof v === "string") {
        const n = Number(v.replace(/[,$\s]/g, ""));
        if (!Number.isNaN(n)) return n;
      }
    }
    return null;
  };

  const getStage = (obj) => normalizeStage(obj?.stage || obj?.funding_stage || obj?.round_stage);
  const getIndustries = (obj) => {
    const ind = obj?.industries || obj?.industry || [];
    if (Array.isArray(ind)) return ind.filter(Boolean).map((s) => String(s).trim());
    if (typeof ind === "string") return ind.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  };

  // Heuristic: if there's no explicit "raising" flag, assume raising for Seed/Series/Growth.
  const isRaising = (obj) => {
    const status = String(obj?.status || "").toLowerCase();
    if (obj?.currently_raising || obj?.is_raising || obj?.round_open || status === "raising" || status === "open") {
      return true;
    }
    const st = (obj?.stage || "").toLowerCase();
    return /(seed|series|growth)/.test(st) && !/late/.test(st);
  };

  let count = m.length;
  let totalValuation = 0;
  let valuationN = 0;

  let totalFunding = 0;
  let fundingN = 0;

  let raisingCount = 0;

  const stageCounts = {};
  const industryCounts = {};

  for (const item of m) {
    // Valuation: support camelCase and snake_case
    const val = getNum(item, [
      "valuationUSD", "valuationUsd", "valuation", "valuation_usd", "company_valuation",
    ]);
    if (val != null) {
      totalValuation += val;
      valuationN += 1;
    }

    // Funding: look for common keys; if none exist, leave as "unknown" (we won't show $0)
    const fund = getNum(item, [
      "totalFundingUSD", "fundingUSD", "fundingUsd", "fundingToDateUSD",
      "total_funding", "funding_raised", "funding_to_date",
    ]);
    if (fund != null) {
      totalFunding += fund;
      fundingN += 1;
    }

    if (isRaising(item)) raisingCount += 1;

    const st = getStage(item) || "Unknown";
    stageCounts[st] = (stageCounts[st] || 0) + 1;

    for (const ind of getIndustries(item)) {
      industryCounts[ind] = (industryCounts[ind] || 0) + 1;
    }
  }

  const stageData = Object.entries(stageCounts)
    .map(([stage, c]) => ({ stage, count: c }))
    .sort((a, b) => ORDER.indexOf(a.stage) - ORDER.indexOf(b.stage));

  const industryArr = Object.entries(industryCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const industryTotal = industryArr.reduce((s, x) => s + x.value, 0) || 1;
  const industryData = industryArr.map((x) => ({
    ...x,
    pct: Math.round((x.value / industryTotal) * 100),
  }));

  return {
    matchedCount: count,
    avgValuation: valuationN ? totalValuation / valuationN : null,   // <- null shows "—"
    totalFunding: fundingN ? totalFunding : null,                    // <- null shows "—"
    currentlyRaising: raisingCount,
    stageData,
    industryData,
  };
}

const ORDER = ["Pre-Seed", "Seed", "Early", "Series A", "Series B", "Growth", "Late", "Unknown"];

function normalizeStage(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (s.includes("pre")) return "Pre-Seed";
  if (s.includes("seed")) return "Seed";
  if (s.includes("series a") || s === "a") return "Series A";
  if (s.includes("series b") || s === "b") return "Series B";
  if (s.includes("early")) return "Early";
  if (s.includes("growth") || s.includes("scale")) return "Growth";
  if (s.includes("late")) return "Late";
  return raw;
}

function formatNumber(n) {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat().format(n);
}
function formatMoney(n) {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n}`;
}