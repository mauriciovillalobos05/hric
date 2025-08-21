import React, { useRef, useState, useEffect, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Users, Target, BarChart3, Radar,
  ChevronLeft, ChevronRight, RefreshCw, MessageSquare,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import InvestorOverview from "./investorOverview.jsx";
import PortfolioSummary from "./portfolioSummary.jsx";
import InvestorTools from "./investorTools.jsx";
import AnalyticsDashboard from "./analyticComponents/AnalyticsDashboard.jsx";

import EventList from "@/pages/eventShowcaseComponents/eventShowcaseAccess.jsx";
import RegisterModal from "@/pages/eventShowcaseComponents/RegisterModal.jsx";

import MessagesDashboard from "./messagesComponents/messagesDashboard.jsx";
import { mockMessages } from "./messagesComponents/mockMessages.js";

import { InvestorMatcher } from "./matchComponents/algorithms/matchingAlgorithm.js";
import transformFilters from "./matchComponents/FilterPanel/transformFilters.jsx";
import FilterPanel from "./matchComponents/FilterPanel/filterPanel.jsx";

import mockMatches from "./matchComponents/mockInvestors.js";
import StartupCard from "./matchComponents/FilterPanel/StartupCard.jsx";
import SpiderChart from "./matchComponents/SpiderChart.jsx";
import MonteCarloResults from "./matchComponents/MonteCarloResults.jsx";

import InvestorKycPanel from "./kycComponents/InvestorKycPanel.jsx";

/* ---------- Selection persistence keys ---------- */
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

const TABS = [
  { value: "matches", label: "Matches", icon: Users },
  { value: "analytics", label: "Analytics", icon: BarChart3 },
  { value: "compare", label: "Compare", icon: Radar },
  { value: "montecarlo", label: "Monte Carlo", icon: BarChart3 },
  { value: "overview", label: "Overview", icon: Target },
  { value: "messages", label: "Messages", icon: MessageSquare },
];

function InvestorTabs({
  matches,
  filteredMatches,
  onSearchClick,
  selectedTab = "matches",
  onTabChange = () => {},
  onMetricsLoaded,

  // Overview props
  events,
  userRole,
  onRegisterClick,
  registerModalOpen,
  onCloseRegisterModal,
  selectedEvent,
  onSubmitRegistration,

  // Optional incoming messages
  messages: incomingMessages,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOverflowing, setIsOverflowing] = useState(false);

  /* ---------- Tab control ---------- */
  const [activeTab, setActiveTab] = useState(selectedTab);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryTab = params.get("tab");
    const stored = sessionStorage.getItem("goToTab");
    const desired = queryTab || stored;

    if (desired && desired !== activeTab) {
      setActiveTab(desired);
      onTabChange(desired);
      updateUrlForTab(desired); // ensure URL matches policy (drop ?tab for default)
    }
    if (stored) sessionStorage.removeItem("goToTab");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Keep URL in sync with the selected tab. Remove ?tab for default tab.
  const updateUrlForTab = (tab) => {
    const qs = new URLSearchParams(location.search);
    if (tab === "matches") {
      qs.delete("tab");
    } else {
      qs.set("tab", tab);
    }
    navigate(
      { pathname: location.pathname, search: qs.toString() ? `?${qs}` : "" },
      { replace: true }
    );
  };

  /* ---------- Filtering + scoring ---------- */
  const [matchedInvestors, setMatchedInvestors] = useState([]);
  const [filters, setFilters] = useState({
    userType: "vc",
    stagePreferences: [],
    locationPreferences: [],
    industryPreferences: [],
    checkSizeRange: "All",
    roiWeight: 20,
    technicalFoundersWeight: 15,
    previousExitsWeight: 15,
    revenueWeight: 20,
    teamSizeWeight: 15,
    currentlyRaisingWeight: 15,
  });

  const handleFilterChange = (newFilters) => setFilters(newFilters);
  const resetFilters = () =>
    setFilters({
      userType: "vc",
      stagePreferences: [],
      locationPreferences: [],
      industryPreferences: [],
      checkSizeRange: "All",
      roiWeight: 20,
      technicalFoundersWeight: 15,
      previousExitsWeight: 15,
      revenueWeight: 20,
      teamSizeWeight: 15,
      currentlyRaisingWeight: 15,
    });

  const norm = (s) => (s ?? "").toString().toLowerCase();
  const hasAny = (arr, testFn) => !arr?.length || arr.some(testFn);
  const listOverlap = (candidateList, selectedList) => {
    if (!selectedList?.length) return true;
    const arr = Array.isArray(candidateList) ? candidateList : candidateList ? [candidateList] : [];
    const lower = arr.map(norm);
    return selectedList.some((sel) => {
      const s = norm(sel);
      return lower.some((v) => v === s || v.includes(s));
    });
  };

  useEffect(() => {
    const matcher = new InvestorMatcher();
    const simFilters = typeof transformFilters === "function" ? transformFilters(filters) : filters;

    const filteredAndScored = (mockMatches || [])
      .filter((inv) => {
        const stageOk = hasAny(filters.stagePreferences, (sel) => norm(inv.stage).includes(norm(sel)));
        const industryOk = listOverlap(inv.industries ?? inv.industry, filters.industryPreferences);
        const locationOk = hasAny(filters.locationPreferences, (sel) => norm(inv.location).includes(norm(sel)));
        return stageOk && industryOk && locationOk;
      })
      .map((entity) => {
        const sim = matcher.runMonteCarloSimulation(entity, simFilters);
        return { ...entity, matchScore: sim.mean, simulation: sim };
      });

    setMatchedInvestors(filteredAndScored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  /* ---------- SINGLE select for Simulate ---------- */
  const [activeId, setActiveId] = useState(() => {
    return sessionStorage.getItem(ACTIVE_KEY) || null;
  });

  useEffect(() => {
    if (activeId != null) sessionStorage.setItem(ACTIVE_KEY, String(activeId));
    else sessionStorage.removeItem(ACTIVE_KEY);
  }, [activeId]);

  useEffect(() => {
    const ids = new Set(matchedInvestors.map((i) => String(i.id)));
    if (activeId && !ids.has(String(activeId))) {
      setActiveId(null);
    }
  }, [matchedInvestors, activeId]);

  const currentActiveInvestor = useMemo(
    () => matchedInvestors.find((i) => String(i.id) === String(activeId)) || null,
    [matchedInvestors, activeId]
  );

  const handleSimulate = (entity) => {
    setActiveId(toIdStr(entity?.id)); // SINGLE select
  };

  /* ---------- MULTI select for Compare ---------- */
  const [compareIds, setCompareIds] = useState(readCompare);

  useEffect(() => {
    sessionStorage.setItem(COMPARE_KEY, JSON.stringify(compareIds));
  }, [compareIds]);

  useEffect(() => {
    const ids = new Set(matchedInvestors.map((i) => String(i.id)));
    setCompareIds((prev) => prev.filter((id) => ids.has(String(id))));
  }, [matchedInvestors]);

  const handleToggleCompare = (id) => {
    const sid = toIdStr(id);
    setCompareIds((prev) => {
      const set = new Set(prev);
      set.has(sid) ? set.delete(sid) : set.add(sid);
      return Array.from(set);
    });
  };

  // 🔑 Keep series order = user selection order in compareIds
  const selectedForCompare = useMemo(() => {
    const byId = new Map(matchedInvestors.map((i) => [String(i.id), i]));
    return compareIds.map((id) => byId.get(String(id))).filter(Boolean);
  }, [matchedInvestors, compareIds]);

  /* ---------- Scrollable Tabs helpers ---------- */
  const scrollRef = useRef(null);
  const scrollTabs = (direction) => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollBy({ left: direction === "left" ? -150 : 150, behavior: "smooth" });
  };

  useEffect(() => {
    const checkOverflow = () => {
      const el = scrollRef.current;
      if (el) setIsOverflowing(el.scrollWidth > el.clientWidth);
    };
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, []);

  /* ---------- Messages (fallback to mocks) ---------- */
  const [messages] = useState(
    incomingMessages && incomingMessages.length ? incomingMessages : mockMessages
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => {
        setActiveTab(v);
        onTabChange(v);
        updateUrlForTab(v); 
      }}
      className="w-full px-4 py-2"
    >
      {/* Tab Bar with Arrows */}
      <div className="relative w-full flex items-center justify-center">
        {isOverflowing && (
          <button className="absolute left-0 z-10 bg-white rounded-full shadow-md p-1" onClick={() => scrollTabs("left")}>
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div ref={scrollRef} className="overflow-x-auto no-scrollbar w-full px-6">
          <TabsList className="flex w-max min-w-full gap-2 bg-muted text-muted-foreground h-9 items-center rounded-lg p-[3px]">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="flex items-center justify-center h-full gap-2 flex-shrink-0">
                {Icon ? <Icon className="w-4 h-4" /> : null}
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {isOverflowing && (
          <button className="absolute right-0 z-10 bg-white rounded-full shadow-md p-1" onClick={() => scrollTabs("right")}>
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Overview */}
      <TabsContent value="overview" className="mt-4">
        <>
          <InvestorKycPanel />
          <InvestorOverview onMetricsLoaded={onMetricsLoaded ?? (() => {})} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4"><PortfolioSummary /></div>
            <div className="space-y-4"><InvestorTools onSearchClick={onSearchClick} /></div>
          </div>
          <div id="events">
            <EventList events={events} role={userRole} onRegisterClick={onRegisterClick} />
            <RegisterModal
              open={registerModalOpen}
              onClose={onCloseRegisterModal}
              event={selectedEvent}
              role={userRole}
              onSubmit={onSubmitRegistration}
            />
          </div>
        </>
      </TabsContent>

      {/* Messages */}
      <TabsContent value="messages" className="mt-4">
        <MessagesDashboard messages={messages} />
      </TabsContent>

      {/* Compare */}
      <TabsContent value="compare" className="mt-4">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-1/4 space-y-4 lg:sticky lg:top-6">
            <FilterPanel filters={filters} onFilterChange={handleFilterChange} />
            <Button
              variant="outline"
              className="w-full flex items-center justify-center"
              onClick={resetFilters}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset Filters
            </Button>
          </div>

          <div className="w-full lg:w-3/4">
            {selectedForCompare.length === 0 ? (
              <div className="border rounded-lg p-6">
                <p className="text-muted-foreground">
                  Check <span className="font-medium">Compare</span> on one or more cards in <span className="font-medium">Matches</span> to visualize here.
                </p>
              </div>
            ) : (
              <SpiderChart investors={selectedForCompare} />
            )}
          </div>
        </div>
      </TabsContent>

      {/* Matches */}
      <TabsContent value="matches" className="mt-4">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-1/4 space-y-4 lg:sticky lg:top-6">
            <FilterPanel filters={filters} onFilterChange={handleFilterChange} />
            <Button variant="outline" className="w-full flex items-center justify-center" onClick={resetFilters}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset Filters
            </Button>
          </div>

          <div className="w-full lg:w-3/4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(matchedInvestors && matchedInvestors.length ? matchedInvestors : filteredMatches).map(
                (entity, index) =>
                  entity ? (
                    <StartupCard
                      key={(entity.id || entity.name || "ent") + index}
                      investor={entity}
                      matchScore={entity.matchScore}
                      // SINGLE select: Simulate
                      isActive={String(entity.id) === String(activeId)}
                      onSimulate={() => handleSimulate(entity)}
                      // MULTI select: Compare
                      isCompared={compareIds.includes(String(entity.id))}
                      onToggleCompare={handleToggleCompare}
                    />
                  ) : null
              )}
            </div>
          </div>
        </div>
      </TabsContent>

      {/* Analytics */}
      <TabsContent value="analytics" className="mt-4">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-1/4 space-y-4 lg:sticky lg:top-6">
            <FilterPanel filters={filters} onFilterChange={handleFilterChange} />
            <Button variant="outline" className="w-full flex items-center justify-center" onClick={resetFilters}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset Filters
            </Button>
          </div>
          <div className="w-full lg:w-3/4">
            <AnalyticsDashboard
              matches={matchedInvestors && matchedInvestors.length ? matchedInvestors : filteredMatches}
            />
          </div>
        </div>
      </TabsContent>

      {/* Monte Carlo */}
      <TabsContent value="montecarlo" className="mt-4">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-1/4 space-y-4 lg:sticky lg:top-6">
            <FilterPanel filters={filters} onFilterChange={handleFilterChange} />
            <Button variant="outline" className="w-full flex items-center justify-center" onClick={resetFilters}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset Filters
            </Button>
          </div>

          <div className="w-full lg:w-3/4">
            {!currentActiveInvestor ? (
              <div className="border rounded-lg p-6">
                <p className="text-muted-foreground">
                  Click <span className="font-medium">Simulate</span> on exactly one card in <span className="font-medium">Matches</span> to show results here.
                </p>
              </div>
            ) : (
              <div className="w-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-muted-foreground">
                    Showing simulation for: <span className="font-medium">{currentActiveInvestor?.name}</span>
                  </div>
                </div>
                <MonteCarloResults
                  selectedInvestors={currentActiveInvestor}
                  simulationResults={currentActiveInvestor?.simulation}
                />
              </div>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

export default InvestorTabs;