import React, {
  useRef, useState, useCallback, useEffect, useMemo,
} from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Radar, BarChart3 } from "lucide-react";
import Dashboard from "./components/Dashboard";
import SpiderChart from "./components/SpiderChart";
import MonteCarloResults from "./components/MonteCarloResults";
import InvestorCard from "../matchComponents/components/FilterPanel/InvestorCard";

// ---- Local scoring (components × weights) ----
function scoreLocal(components = {}, weights = {}) {
  let sumW = 0, acc = 0;
  for (const k of Object.keys(components)) {
    const w = Math.max(0, weights[k] ?? 0);
    sumW += w;
    acc += (components[k] ?? 0) * w;
  }
  return sumW ? (acc / sumW) * 100 : 0;
}
const readWeights = (scopeKey = "startup-view") => {
  try {
    const raw = sessionStorage.getItem(`weights:${scopeKey}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

// ---- API fetch (minimal; expects your backend proxy at /api) ----
async function fetchMatches({ token, mode = "startup", page = 1, perPage = 50, minScore = 0 }) {
  const q = new URLSearchParams({ mode, page: String(page), per_page: String(perPage), min_score: String(minScore) });
  const res = await fetch(`/api/matching/matches?${q.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`matches ${res.status}`);
  return res.json();
}

const MatchesDashboard = ({
  // If you pass matchedInvestors, the component will render them.
  // If you pass a token, the component will fetch from /matching/matches instead.
  token,
  mode = "startup",
  weightsScopeKey = "startup-view",

  matchedInvestors, // optional pre-fetched (already mapped) list
  activeInvestor,
  simulationResults,
  onToggleCompare,
  onSimulate,
  compareIds,
}) => {
  const scrollerRef = useRef(null);
  const [atBottom, setAtBottom] = useState(false);

  const [serverMatches, setServerMatches] = useState([]); // raw from API
  const [page, setPage] = useState(1);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load weights from sessionStorage and refresh rankings when FilterPanel updates them
  const [weights, setWeights] = useState(() => readWeights(weightsScopeKey));
  useEffect(() => {
    const onWeights = () => setWeights(readWeights(weightsScopeKey));
    window.addEventListener("weights:updated", onWeights);
    return () => window.removeEventListener("weights:updated", onWeights);
  }, [weightsScopeKey]);

  // Fetch from API if token is provided and no matchedInvestors prop was passed
  const loadMore = useCallback(async () => {
    if (!token || loading || done || matchedInvestors) return;
    setLoading(true);
    try {
      const data = await fetchMatches({ token, mode, page, perPage: 30, minScore: 0 });
      const next = [...serverMatches, ...(data.matches || [])];
      setServerMatches(next);
      const total = data.pagination?.total ?? next.length;
      const pages = data.pagination?.pages ?? 1;
      setDone(page >= pages || next.length >= total);
      setPage((p) => p + 1);
    } catch (e) {
      // noop (show nothing for now)
    } finally {
      setLoading(false);
    }
  }, [token, mode, page, loading, done, serverMatches, matchedInvestors]);

  useEffect(() => { if (token && !matchedInvestors) { setServerMatches([]); setPage(1); setDone(false); } }, [token, mode, matchedInvestors]);
  useEffect(() => { if (token && !matchedInvestors) { loadMore(); } }, [token, matchedInvestors]); // initial

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const reached = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
    setAtBottom(reached);
    // Infinite load if near bottom
    if (reached) loadMore();
  }, [loadMore]);

  // Map raw matches → InvestorCard shape + local re-ranking
  const items = useMemo(() => {
    const raws = matchedInvestors ?? serverMatches.map((m) => {
      // backend returns 0..1; we'll show local ranking (components × weights)
      const comps = m.score_breakdown?.components ?? {};
      const uiMatchScore = scoreLocal(comps, weights);

      // pull minimal investor info from response (startup mode)
      const ie = m.investor_enterprise || {};
      // (optional) decorate with arrays for charts if you add them to response later
      return {
        id: ie.id || m.match_id,
        name: ie.name || "—",
        location: ie.location || null,
        industries: [], // fill if you add it to API
        stage: [],      // fill if you add it to API
        score_breakdown: m.score_breakdown,
        matchScore: Math.round(uiMatchScore),
      };
    });

    // If matchedInvestors already came with matchScore, still re-rank by our weights
    const withScores = raws.map((r) => {
      const comps = r.score_breakdown?.components ?? {};
      return { ...r, matchScore: Math.round(scoreLocal(comps, weights)) };
    });

    return withScores.sort((a, b) => b.matchScore - a.matchScore);
  }, [matchedInvestors, serverMatches, weights]);

  const selectedForCompare = useMemo(() => {
    const byId = new Map(items.map((i) => [String(i.id), i]));
    return (compareIds || []).map((id) => byId.get(String(id))).filter(Boolean);
  }, [items, compareIds]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    handleScroll();
  }, [handleScroll]);

  return (
    <Tabs defaultValue="matches" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="matches"><Users className="w-4 h-4 mr-2" />Matches</TabsTrigger>
        <TabsTrigger value="compare"><Radar className="w-4 h-4 mr-2" />Compare</TabsTrigger>
        <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 mr-2" />Analytics</TabsTrigger>
      </TabsList>

      <TabsContent value="matches">
        <div className="relative lg:h-[calc(100vh-6rem)]">
          <div ref={scrollerRef} onScroll={handleScroll} className="h-full overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((inv, index) => (
                <InvestorCard
                  key={inv.id ?? `${inv.name}-${index}`}
                  investor={inv}
                  matchScore={inv.matchScore}
                  isActive={activeInvestor?.id === inv.id}
                  isCompared={(compareIds || []).includes(inv.id)}
                  onSimulate={() => onSimulate?.(inv)}
                  onToggleCompare={() => onToggleCompare?.(inv.id)}
                />
              ))}
            </div>
            {/* Lazy load sentinel */}
            {token && !matchedInvestors && !done && (
              <div className="py-6 text-center text-sm text-gray-500">
                {loading ? "Loading…" : "Scroll to load more"}
              </div>
            )}
          </div>

          {!atBottom && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-b from-transparent to-white" />
          )}
        </div>
      </TabsContent>

      <TabsContent value="analytics">
        <Dashboard investors={items} filteredInvestors={items} />
      </TabsContent>

      <TabsContent value="compare">
        <div className="w-full lg:w-full h-full flex flex-col items-center justify-center">
          {selectedForCompare.length === 0 ? (
            <div className="border rounded-lg p-6">
              <h3 className="text-sm font-semibold text-blue-900">No startups selected for comparison</h3>
              <p className="mt-1 text-sm text-blue-900/80">
                Check <span className="font-semibold">Compare</span> on one or more cards in
                <span className="font-semibold"> Matches</span> to visualize them here.
              </p>
            </div>
          ) : (
            <SpiderChart investors={selectedForCompare} />
          )}
        </div>
      </TabsContent>

      <div id="montecarlo" className="mt-6">
        <MonteCarloResults
          selectedInvestors={activeInvestor}
          simulationResults={activeInvestor?.simulation ?? simulationResults}
        />
      </div>
    </Tabs>
  );
};

export default MatchesDashboard;