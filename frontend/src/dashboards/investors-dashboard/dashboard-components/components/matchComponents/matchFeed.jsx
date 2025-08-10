import React, { useEffect, useState } from "react";
import MatchCard from "./MatchCard";
import { createClient } from "@supabase/supabase-js";
import { makeApi } from "@/lib/apiClient";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function badgeFromScore(m) {
  const s = Number(m?.overall_score ?? 0);
  if (s >= 0.9) return "High ROI";
  if (s >= 0.75) return "Strong Fit";
  return "Good Fit";
}

function MatchFeed() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [api, setApi] = useState(null);

  // Convert API match -> UI card
  // Convert API match -> UI card
const toCard = (m) => {
  const s  = m?.startup || {};
  const sp = s?.startup_profile || {}; // may be absent on older responses

  const scorePct =
    typeof m?.overall_score === "number" ? Math.round(m.overall_score * 100) : 0;

  // helpers
  const isNum = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));
  const coalesceNum = (...vals) => {
    for (const v of vals) if (isNum(v)) return Number(v);
    return null;
  };

  // three badges: ROI/fit, stage, industry
  const tags = [
    badgeFromScore(m),
    s?.stage || null,
    s?.industry || null,
  ].filter(Boolean);

  return {
    id:
      m?.match_id ||
      s?.id ||
      `${m?.investor_enterprise_id || "inv"}-${
        m?.startup_enterprise_id || Math.random().toString(36).slice(2)
      }`,
    company_name: s?.name || "Startup",   // keep name
    tags,
    location: s?.location || "",          // keep location

    // ✅ employees come from startup_profile.team_size
    employees: coalesceNum(sp?.team_size, s?.employees, s?.employee_count),

    // ✅ revenue/month (prefer display_mrr_usd if your API sends it)
    mrr_usd: coalesceNum(sp?.mrr_usd, s?.mrr_usd, sp?.display_mrr_usd, sp?.current_revenue),

    // ✅ valuation (prefer display_valuation_usd if present)
    valuation_usd: coalesceNum(sp?.current_valuation_usd, s?.valuation_usd, sp?.display_valuation_usd),


    // ✅ key founder/exits metrics
    technical_founders_pct: coalesceNum(sp?.technical_founders_pct, s?.key_metrics?.technical_founders_pct),
    previous_exits_pct:     coalesceNum(sp?.previous_exits_pct, s?.key_metrics?.previous_exits_pct),

    // ✅ investors chips
    investors: Array.isArray(sp?.current_investors) ? sp.current_investors
              : Array.isArray(s?.current_investors) ? s.current_investors : [],

    match_score: scorePct,
  };
};


  // Build the API client once we have a Supabase JWT
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) console.warn("Supabase session error:", sessionErr.message);
      const token = data?.session?.access_token || null;
      if (mounted) setApi(makeApi(token));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch matches when api is ready
  useEffect(() => {
    if (!api) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const payload = await api.matches({ mode: "investor", limit: 50 });
        if (payload?.notModified) return;

        const matches = Array.isArray(payload?.matches) ? payload.matches : [];
        if (!cancelled) setCards(matches.map(toCard));
      } catch (e) {
        if (!cancelled) {
          setError(e);
          console.error("Error fetching matches:", e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <section className="px-6 py-4">
      <h2 className="text-xl font-semibold mb-4">Startup Matches</h2>

      {loading && <div className="text-sm text-gray-500">Loading matches…</div>}

      {!loading && error && (
        <div className="text-sm text-red-600">
          Couldn’t load matches: {error.message}
        </div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div className="text-sm text-gray-500">No matches yet.</div>
      )}

      {!loading && !error && cards.length > 0 && (
        <div className="grid gap-4">
          {cards.map((c) => (
            <MatchCard key={c.id} {...c} />
          ))}
        </div>
      )}
    </section>
  );
}

export default MatchFeed;