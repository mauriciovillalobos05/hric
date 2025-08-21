// =============================================
// FILE: MatchesDashboard.jsx
// =============================================
import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Radar, BarChart3 } from "lucide-react";
import Dashboard from "./components/Dashboard";
import SpiderChart from "./components/SpiderChart";
import MonteCarloResults from "./components/MonteCarloResults";
import InvestorCard from "../matchComponents/components/FilterPanel/InvestorCard";
import { Button } from "@/components/ui/button";
import FilterPanel from "../matchComponents/components/FilterPanel/FilterPanel";

const rawBase =
  (import.meta?.env?.VITE_API_BASE_URL &&
    import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")) ||
  window.location.origin;
const API_BASE = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

const VIEW_THRESHOLD_MS = 500;
const IO_THRESHOLD = 0.5;
const TOP_K = 60;

// ------- Auth token helper -------
function findBearerToken() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k)) {
        const v = JSON.parse(localStorage.getItem(k) || "null");
        const t =
          v?.currentSession?.access_token ||
          v?.access_token ||
          v?.currentToken?.access_token;
        if (t) return t;
      }
    }
    const fallbacks = ["sb-access-token", "access_token", "jwt", "token"];
    for (const key of fallbacks) {
      const t = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (t) return t;
    }
    const m = document.cookie.match(/(?:^|; )sb-access-token=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
    if (import.meta?.env?.VITE_DEV_BEARER_TOKEN)
      return import.meta.env.VITE_DEV_BEARER_TOKEN;
  } catch {}
  return null;
}

// ------- Telemetry -------
async function postInteraction({ token, matchId, action }) {
  if (!token || !matchId) return;
  try {
    const url = `${API_BASE}/matches/${matchId}/interact`;
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ action }),
      cache: "no-store",
    });
  } catch {}
}

// ------- Optional hydration -------
async function hydrateEnterprises({ token, investorEnterpriseIds = [] }) {
  if (!investorEnterpriseIds.length) return {};
  try {
    const url = `${API_BASE}/enterprises?ids=${encodeURIComponent(
      investorEnterpriseIds.join(",")
    )}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return {};
    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("application/json")) return {};
    const json = await res.json();
    const map = {};
    const items = Array.isArray(json?.items)
      ? json.items
      : Array.isArray(json)
      ? json
      : [];
    for (const it of items) map[String(it.id)] = it;
    return map;
  } catch {
    return {};
  }
}

// ------- Fetcher (tries both possible routes) -------
async function fetchEntrepreneurMatches({
  token,
  minScore = 0,
  order = "desc",
  weightsParam,
  raiseTargetUsd,
  filtersQS = "",
  signal,
} = {}) {
  const base = new URLSearchParams();
  base.set("order", order === "asc" ? "asc" : "desc");
  base.set("min_score", String(minScore));
  base.set("top_k", String(TOP_K));
  if (weightsParam) base.set("weights", weightsParam);
  if (Number.isFinite(raiseTargetUsd) && raiseTargetUsd > 0)
    base.set("raise_target_usd", String(raiseTargetUsd));

  const mergedQS = [base.toString(), filtersQS].filter(Boolean).join("&");

  const paths = ["/matches/entrepreneur", "/matching/matches/entrepreneur"];
  let lastErr;
  for (const path of paths) {
    const url = `${API_BASE}${path}?${mergedQS}`;
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal,
      });
      const ctype = res.headers.get("content-type") || "";
      if (res.ok && ctype.includes("application/json")) {
        const json = await res.json();
        console.groupCollapsed("[Matches] GET", path);
        console.log("url:", url);
        console.log("payload:", json);
        console.groupEnd();
        return json;
      }
      if (res.status === 404) {
        lastErr = new Error(`404 at ${path}`);
        continue;
      }
      const text = await res.text().catch(() => "");
      throw new Error(
        `Matches failed: ${res.status} ${res.statusText} ${
          text ? `– ${text.slice(0, 200)}` : ""
        }`
      );
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No matching endpoint responded.");
}

// ------- Adapt payload for cards (reads m.investor) -------
function adaptEntrepreneurMatches(apiJson) {
  const rows = Array.isArray(apiJson?.matches) ? apiJson.matches : [];
  return rows.map((m, idx) => {
    const e = m?.investor || {};
    const components = m?.score_breakdown?.components || e?._components || {};
    const inv = {
      id: e.id ?? String(m.investor_enterprise_id ?? `inv-${idx}`),
      name: e.name ?? "Investor",
      type:
        (e.type && e.type.charAt(0).toUpperCase() + e.type.slice(1)) ||
        "Investor",
      location: e.location ?? null,
      logoUrl: e.logoUrl ?? null,
      isVerified: !!e.isVerified,
      thesis: e.thesis ?? null,
      portfolioCompanies: Array.isArray(e.portfolioCompanies)
        ? e.portfolioCompanies
        : [],
      industries: Array.isArray(e.industries) ? e.industries : [],
      stages: Array.isArray(e.stages) ? e.stages : [],
      matchScore:
        typeof e.matchScore === "number"
          ? e.matchScore
          : typeof m.view_score === "number"
          ? m.view_score
          : 0,
      _raw: {
        match_id: String(m.match_id ?? ""),
        score_breakdown: m.score_breakdown || {},
        calculated_at: m.calculated_at,
      },
      _components: components,
    };

    // per-item debug
    const missing = [];
    if (!inv.name) missing.push("name");
    if (!inv.location) missing.push("location");
    if (!inv._raw.match_id) missing.push("_raw.match_id");

    console.groupCollapsed(
      `[Matches→Card] #${idx} ${inv.name || inv.id || "(unknown)"}`
    );
    console.log("match raw:", m);
    console.log("investor flattened:", inv);
    console.log("components keys:", Object.keys(inv._components || {}));
    if (missing.length) console.warn("Missing for card:", missing);
    console.groupEnd();

    return inv;
  });
}

// ------- Helpers for FilterPanel ↔ query -------
const DEFAULT_FILTERS = {
  raiseTargetUsd: 0,
  industryFitWeight: 30,
  stageAlignmentWeight: 25,
  geoCoverageWeight: 15,
  checkSizeFitWeight: 20,
  decisionSpeedWeight: 5,
  verificationTrustWeight: 5,
  activityTrackRecordWeight: 0,
};
function serializeWeightsForQuery(f) {
  const w = {
    industryFitWeight: numOrZero(f.industryFitWeight),
    stageAlignmentWeight: numOrZero(f.stageAlignmentWeight),
    geoCoverageWeight: numOrZero(f.geoCoverageWeight),
    checkSizeFitWeight: numOrZero(f.checkSizeFitWeight),
    decisionSpeedWeight: numOrZero(f.decisionSpeedWeight),
    verificationTrustWeight: numOrZero(f.verificationTrustWeight),
    activityTrackRecordWeight: numOrZero(f.activityTrackRecordWeight),
  };
  return JSON.stringify(w);
}
function serializeFiltersToQuery(f = {}, startupCity) {
  const toText = (x) =>
    x && typeof x === "object" ? (x.label ?? x.value ?? x.name ?? "") : String(x ?? "");
  const params = new URLSearchParams();

  // Investor Type
  const types = (f.investorTypes || []).map(toText).filter(Boolean).map((s) => s.toLowerCase());
  if (types.length) params.set("investorType", types.join(","));

  // Stages / Industries
  const stages = (f.stagePreferences || []).map(toText).filter(Boolean);
  if (stages.length) params.set("stagesAny", stages.join(","));
  const inds = (f.industryPreferences || []).map(toText).filter(Boolean);
  if (inds.length) params.set("industriesAny", inds.join(","));

  // Locations (plus "prefer my city")
  let locs = (f.locationPreferences || []).map(toText).filter(Boolean);
  if (f.preferMyCity && startupCity)
    locs = [...new Set([...locs, startupCity])];
  if (locs.length) params.set("locations", locs.join(","));

  // Investment range
  const r = Array.isArray(f.checkSizeRange) ? f.checkSizeRange : [0, 0];
  const minCheck = Number(r[0]);
  const maxCheck = Number(r[1]);
  if (Number.isFinite(minCheck) && minCheck > 0)
    params.set("minCheck", String(minCheck));
  if (Number.isFinite(maxCheck) && maxCheck > 0)
    params.set("maxCheck", String(maxCheck));
  // optional: params.set("rangeMode","overlap");

  // Verified
  if (f.verifiedOnly === true) params.set("verified", "true");

  // Portfolio keyword
  const q = (f.portfolioKeyword || "").trim();
  if (q) params.set("portfolioQ", q);

  return params.toString(); // '' when no filters selected
}

function numOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

const MatchesDashboard = ({
  matchedInvestors: matchedInvestorsProp,
  activeInvestor,
  simulationResults,
  onToggleCompare = () => {},
  onSimulate = () => {},
  compareIds = [],
  weightsParam: weightsParamProp,
  raiseTargetUsd: raiseTargetUsdProp,
  minScore = 0,
  order = "desc",
}) => {
  // ⚠️ All hooks are inside the component (fixes "Invalid hook call")
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [weightsParamLocal, setWeightsParamLocal] = useState(
    serializeWeightsForQuery(DEFAULT_FILTERS)
  );
  const [raiseTargetUsdLocal, setRaiseTargetUsdLocal] = useState(0);
  const [filtersQSLocal, setFiltersQSLocal] = useState("");
  const effectiveWeightsParam =
    typeof weightsParamProp === "string" ? weightsParamProp : weightsParamLocal;
  const effectiveRaiseTargetUsd =
    Number.isFinite(raiseTargetUsdProp) && raiseTargetUsdProp >= 0
      ? raiseTargetUsdProp
      : raiseTargetUsdLocal;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [matchedInvestors, setMatchedInvestors] = useState(
    matchedInvestorsProp || []
  );
  const [startupEid, setStartupEid] = useState(null);

  const viewedRef = useRef(new Set());
  const timersRef = useRef(new Map());
  const observerRef = useRef(null);
  const listRef = useRef(null);
  const abortRef = useRef(null);

  const fetchKey = useMemo(
    () =>
      JSON.stringify({
        weightsParam: effectiveWeightsParam || "",
        raiseTargetUsd: Number.isFinite(effectiveRaiseTargetUsd)
          ? effectiveRaiseTargetUsd
          : 0,
        minScore,
        order,
        filtersQS: filtersQSLocal || "",
      }),
    [
      effectiveWeightsParam,
      effectiveRaiseTargetUsd,
      minScore,
      order,
      filtersQSLocal,
    ]
  );

  const attachObserver = useCallback(() => {
    const containerEl = listRef.current;
    if (!containerEl) return;

    const token = findBearerToken();
    if (!token) return;

    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target;
          const matchId = el.getAttribute("data-match-id");
          if (!matchId || viewedRef.current.has(matchId)) return;

          if (entry.isIntersecting && entry.intersectionRatio >= IO_THRESHOLD) {
            if (!timersRef.current.has(matchId)) {
              const t = setTimeout(() => {
                if (!viewedRef.current.has(matchId)) {
                  viewedRef.current.add(matchId);
                  postInteraction({ token, matchId, action: "view" });
                }
                timersRef.current.delete(matchId);
              }, VIEW_THRESHOLD_MS);
              timersRef.current.set(matchId, t);
            }
          } else {
            const t = timersRef.current.get(matchId);
            if (t) {
              clearTimeout(t);
              timersRef.current.delete(matchId);
            }
          }
        });
      },
      { threshold: IO_THRESHOLD }
    );

    const cards = containerEl.querySelectorAll("[data-match-id]");
    cards.forEach((c) => observerRef.current.observe(c));
  }, []);

  const loadOnce = useCallback(async () => {
    const token = findBearerToken();
    if (!token) {
      setErr(
        "No Bearer token found. Ensure you're logged in (Supabase stores a JWT in localStorage)."
      );
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setErr("");
    try {
      viewedRef.current.clear();

      const data = await fetchEntrepreneurMatches({
        token,
        minScore,
        order,
        weightsParam: effectiveWeightsParam,
        raiseTargetUsd: effectiveRaiseTargetUsd,
        filtersQS: filtersQSLocal,
        signal: ctrl.signal,
      });

      const first = data?.matches?.[0];
      if (first?.startup_enterprise_id)
        setStartupEid(first.startup_enterprise_id);

      // Flatten for card consumption
      const adapted = adaptEntrepreneurMatches(data);

      // Optional identity hydration to fill name/logo/location if missing
      const ids = [
        ...new Set(
          (data.matches || []).map((m) => String(m.investor_enterprise_id))
        ),
      ];
      const hydrationMap = await hydrateEnterprises({
        token,
        investorEnterpriseIds: ids,
      });

      const merged = adapted.map((it) => {
        const h = hydrationMap[it.id];
        return h
          ? {
              ...it,
              name: h.name || it.name,
              location: h.location || it.location,
              is_verified: h.is_verified ?? it.is_verified,
              logo_url: h.logo_url ?? it.logo_url,
            }
          : it;
      });

      console.groupCollapsed("[Matches] Final hydrated list");
      console.log(merged);
      console.groupEnd();

      setMatchedInvestors(merged);
    } catch (e) {
      setErr(e?.message || "Failed to load matches.");
    } finally {
      setLoading(false);
    }
  }, [minScore, order, effectiveWeightsParam, effectiveRaiseTargetUsd, filtersQSLocal]);

  useEffect(() => {
    loadOnce();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchKey, loadOnce]);

  useEffect(() => {
    attachObserver();
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, [matchedInvestors, attachObserver]);

  const onRecompute = useCallback(async () => {
    const token = findBearerToken();
    if (!token || !startupEid) return;
    try {
      const url = `${API_BASE}/recompute`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ enterprise_id: startupEid, force: true }),
        cache: "no-store",
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Recompute failed: ${res.status} ${txt}`);
      }
      await loadOnce();
    } catch (e) {
      setErr(e?.message || "Recompute failed.");
    }
  }, [startupEid, loadOnce]);

  // ---------- FilterPanel wiring ----------
  const handleFiltersChange = (next) => {
    setFilters(next);
  };

  const handleFiltersApply = (next) => {
    setFilters(next);
    setWeightsParamLocal(serializeWeightsForQuery(next));
    const rt = Number(next?.raiseTargetUsd);
    setRaiseTargetUsdLocal(Number.isFinite(rt) && rt > 0 ? rt : 0);

    // NEW: serialize filters -> query string
    const qs = serializeFiltersToQuery(next, /* startupCity */ null); // you can pass startupCity if you have it
    setFiltersQSLocal(qs);
  };

  const handleFiltersReset = (cleared) => {
    setFilters(cleared);
    setWeightsParamLocal(serializeWeightsForQuery(cleared));
    const rt = Number(cleared?.raiseTargetUsd);
    setRaiseTargetUsdLocal(Number.isFinite(rt) && rt > 0 ? rt : 0);

    // NEW: empty filters -> ''
    setFiltersQSLocal("");
  };

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] gap-6">
      <div>
        <aside className="md:sticky md:top-6 self-start max-md:order-1">
          <FilterPanel
            className="w-full lg:w-1/4 space-y-4 lg:sticky lg:top-6"
            filters={filters}
            onFilterChange={handleFiltersChange}
            onApply={handleFiltersApply}
            onReset={handleFiltersReset}
          />
          <div className="mt-3 flex gap-2">
            {loading && <span className="text-xs text-gray-500">Loading…</span>}
            {err && <span className="text-xs text-red-600">{err}</span>}
          </div>
        </aside>
      </div>

      <div className="w-full">
        <Tabs defaultValue="matches" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="matches">
              <Users className="w-4 h-4 mr-2" />
              Matches
            </TabsTrigger>
            <TabsTrigger value="compare">
              <Radar className="w-4 h-4 mr-2" />
              Compare
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="matches">
            {/* Attach ref so the view observer can find cards */}
            <div
              ref={listRef}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {matchedInvestors.map((inv) => (
                <InvestorCard
                  key={inv._raw?.match_id || inv.id}
                  investor={inv}
                  matchScore={inv.matchScore}
                  onSimulate={() => {}}
                  onToggleCompare={() => {}}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <Dashboard
              investors={matchedInvestors}
              filteredInvestors={matchedInvestors}
            />
          </TabsContent>

          <TabsContent value="compare">
            <SpiderChart
              investors={
                compareIds.length
                  ? matchedInvestors.filter((i) => compareIds.includes(i.id))
                  : []
              }
            />
          </TabsContent>

          <div className="mt-6">
            <MonteCarloResults
              selectedInvestors={activeInvestor}
              simulationResults={
                activeInvestor?.simulation ?? simulationResults
              }
            />
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default MatchesDashboard;
