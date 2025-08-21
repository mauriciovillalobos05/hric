import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Radar, BarChart3 } from "lucide-react";
import Dashboard from "./components/Dashboard";
import SpiderChart from "./components/SpiderChart";
import MonteCarloResults from "./components/MonteCarloResults";
import StartupCard from "./FilterPanel/StartupCard";

const ACTIVE_KEY = "activeInvestorId";
const COMPARE_KEY = "compareInvestorIds";

const toIdStr = (v) => (v == null ? null : String(v));

const readCompare = () => {
  try {
    const raw = JSON.parse(sessionStorage.getItem(COMPARE_KEY) || "[]");
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
};

const MatchesDashboard = ({
  matchedInvestors = [],
  activeInvestor = null,        // optional controlled (object w/ id)
  simulationResults = null,
  onToggleCompare,              // optional controlled (fn)
  onSimulate,                   // optional controlled (fn)
  compareIds,                   // optional controlled (array of ids)
}) => {
  // ---------- internal state (used if not controlled) ----------
  const [internalActiveId, setInternalActiveId] = useState(() => {
    const fromProp = toIdStr(activeInvestor?.id);
    const fromSS = sessionStorage.getItem(ACTIVE_KEY);
    return fromProp ?? (fromSS ? String(fromSS) : null);
  });

  const [internalCompareIds, setInternalCompareIds] = useState(() => {
    if (Array.isArray(compareIds)) return compareIds.map(String);
    return readCompare();
  });

  // ---------- effective (controlled takes precedence) ----------
  const effectiveActiveId =
    toIdStr(activeInvestor?.id) ?? internalActiveId ?? null;

  const effectiveCompareIds = Array.isArray(compareIds)
    ? compareIds.map(String)
    : internalCompareIds;

  // ---------- persist active id ----------
  useEffect(() => {
    if (effectiveActiveId != null) {
      sessionStorage.setItem(ACTIVE_KEY, effectiveActiveId);
    } else {
      sessionStorage.removeItem(ACTIVE_KEY);
    }
  }, [effectiveActiveId]);

  // ---------- persist compare ids ----------
  useEffect(() => {
    sessionStorage.setItem(COMPARE_KEY, JSON.stringify(effectiveCompareIds));
  }, [effectiveCompareIds]);

  // ---------- prune active if it no longer exists ----------
  useEffect(() => {
    const idsSet = new Set(matchedInvestors.map((i) => String(i.id)));
    if (effectiveActiveId && !idsSet.has(effectiveActiveId)) {
      if (!onSimulate) setInternalActiveId(null);
      // if controlled, parent should clear via props on next render
    }
  }, [matchedInvestors, effectiveActiveId, onSimulate]);

  // ---------- prune compare ids that no longer exist ----------
  useEffect(() => {
    const idsSet = new Set(matchedInvestors.map((i) => String(i.id)));
    const pruned = effectiveCompareIds.filter((id) => idsSet.has(id));
    if (pruned.length !== effectiveCompareIds.length) {
      if (Array.isArray(compareIds)) {
        // notify parent (optional)
        onToggleCompare?.("__prune__", pruned);
      } else {
        setInternalCompareIds(pruned);
      }
    }
  }, [matchedInvestors, effectiveCompareIds, compareIds, onToggleCompare]);

  const currentActiveInvestor = useMemo(
    () => matchedInvestors.find((i) => String(i.id) === effectiveActiveId) || null,
    [matchedInvestors, effectiveActiveId]
  );

  // ---------- handlers ----------
  const handleSimulate = (inv) => {
    onSimulate?.(inv); // parent may compute/run sim and set active
    if (!onSimulate) setInternalActiveId(toIdStr(inv?.id)); // SINGLE-select
  };

  const handleToggleCompare = (id) => {
    const sid = toIdStr(id);
    onToggleCompare?.(sid); // parent may control
    if (onToggleCompare) return; // controlled
    setInternalCompareIds((prev) => {
      const set = new Set(prev);
      set.has(sid) ? set.delete(sid) : set.add(sid);
      return Array.from(set);
    });
  };

  // ---------- scroller fade ----------
  const scrollerRef = useRef(null);
  const [atBottom, setAtBottom] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const reached = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
    setAtBottom(reached);
  }, []);

  useEffect(() => {
    handleScroll();
  }, [handleScroll, matchedInvestors.length]);

  return (
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
        <div className="relative lg:h-[calc(100vh-6rem)]">
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto pr-2"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {matchedInvestors.map((inv, index) => {
                const idStr = String(inv.id);
                return (
                  <StartupCard
                    key={inv.id ?? `${inv.name}-${index}`}
                    investor={inv}
                    matchScore={inv.matchScore}
                    isActive={effectiveActiveId === idStr}                 // SINGLE
                    isCompared={effectiveCompareIds.includes(idStr)}       // MULTI
                    onSimulate={() => handleSimulate(inv)}
                    onToggleCompare={() => handleToggleCompare(inv.id)}
                  />
                );
              })}
            </div>
          </div>

          {!atBottom && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-b from-transparent to-white" />
          )}
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
            effectiveCompareIds.length
              ? matchedInvestors.filter((i) => effectiveCompareIds.includes(String(i.id)))
              : []
          }
        />
      </TabsContent>

      <div className="mt-6">
        <MonteCarloResults
          selectedInvestors={currentActiveInvestor}
          simulationResults={currentActiveInvestor?.simulation ?? simulationResults}
        />
      </div>
    </Tabs>
  );
};

export default MatchesDashboard;