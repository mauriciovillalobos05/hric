import React from "react";
import { MapPin, Users, DollarSign, TrendingUp } from "lucide-react";

function formatMoneyShort(n) {
  if (n == null || isNaN(n)) return null;
  const abs = Math.abs(Number(n));
  if (abs >= 1_000_000_000) return `$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}K`;
  return `$${abs.toFixed(0)}`;
}

const Badge = ({ children, tone = "neutral" }) => {
  const tones = {
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    info: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    neutral: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
};

export default function MatchCard({
  id,
  company_name,
  tags = [],                  // ["High ROI","Growth","CyberSecurity"]
  match_score = 0,            // 0-100
  location,
  employees,
  mrr_usd,                    // monthly revenue
  valuation_usd,
  technical_founders_pct,
  previous_exits_pct,
  investors = [],             // ["Sequoia Capital","Lightspeed Venture Partners"]
}) {
  const revenueText = mrr_usd != null ? `${formatMoneyShort(mrr_usd)}/month revenue` : null;
  const valuationText = valuation_usd != null ? `Valuation: ${formatMoneyShort(valuation_usd)}` : null;

  return (
    <article
      key={id}
      className="rounded-3xl border border-slate-200 shadow-sm bg-white p-5 relative"
    >
      {/* Match pill */}
      <div className="absolute right-4 top-4">
        <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold">
          {Math.max(0, Math.min(100, Math.round(match_score)))}% Match
        </span>
      </div>

      {/* Title & tags */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-slate-900">{company_name}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags[0] && <Badge tone="success">{tags[0]}</Badge>}
          {tags[1] && <Badge tone="info">{tags[1]}</Badge>}
          {tags[2] && <Badge tone="neutral">{tags[2]}</Badge>}
        </div>
      </div>

      {/* Top facts */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
        {location && (
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-500" />
            <span>{location}</span>
          </li>
        )}
        {Number.isFinite(Number(employees)) && (
          <li className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            <span>{Number(employees)} employees</span>
          </li>
        )}
        {revenueText && (
          <li className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-slate-500" />
            <span>{revenueText}</span>
          </li>
        )}
        {valuationText && (
          <li className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-500" />
            <span>{valuationText}</span>
          </li>
        )}
      </ul>

      <hr className="my-4 border-slate-200" />

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500">Key Metrics</div>
          <div className="mt-1 text-sm">
            Technical Founders:{" "}
            <span className="font-semibold">
              {technical_founders_pct != null ? `${Number(technical_founders_pct).toFixed(0)}%` : "—"}
            </span>
          </div>
        </div>
        <div className="self-end sm:self-auto">
          <div className="invisible text-sm font-medium text-slate-500">.</div>
          <div className="mt-1 text-sm">
            Previous Exits:{" "}
            <span className="font-semibold">
              {previous_exits_pct != null ? `${Number(previous_exits_pct).toFixed(0)}%` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Investors chips */}
      {investors?.length ? (
        <>
          <div className="mt-4 text-sm font-medium text-slate-700">Current Investors:</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {investors.slice(0, 6).map((inv) => (
              <span
                key={inv}
                className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-medium ring-1 ring-slate-200"
              >
                {inv}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </article>
  );
}