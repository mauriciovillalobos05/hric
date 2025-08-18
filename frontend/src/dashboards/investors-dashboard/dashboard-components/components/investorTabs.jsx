import React, { useRef, useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Users, Target, BarChart3, Radar, Calendar,
  ChevronLeft, ChevronRight, RefreshCw, MessageSquare,
} from "lucide-react";

import InvestorOverview from "./investorOverview.jsx";
import PortfolioSummary from "./portfolioSummary.jsx";
import InvestorTools from "./investorTools.jsx";
import AnalyticsDashboard from "./analyticComponents/AnalyticsDashboard.jsx";

import EventList from "@/pages/eventShowcaseComponents/eventShowcaseAccess.jsx";
import RegisterModal from "@/pages/eventShowcaseComponents/RegisterModal.jsx";

import MessagesDashboard from "./messagesComponents/MessagesDashboard.jsx";
import { mockMessages } from "./messagesComponents/mockMessages.js";

import { InvestorMatcher } from "./matchComponents/algorithms/matchingAlgorithm.js";
import transformFilters from "./matchComponents/FilterPanel/transformFilters.jsx";
import FilterPanel from "./matchComponents/FilterPanel/filterPanel.jsx";

import mockMatches from "./matchComponents/mockInvestors.js";
import StartupCard from "./matchComponents/FilterPanel/StartupCard.jsx";
import SpiderChart from "./matchComponents/SpiderChart.jsx";
import MonteCarloResults from "./matchComponents/MonteCarloResults.jsx";

import InvestorKycPanel from "./kycComponents/InvestorKycPanel.jsx";
import EventManagementApp from "../eventsComponents/EventManagementApp.jsx";

const TABS = [
  { value: "matches", label: "Matches", icon: Users },
  { value: "analytics", label: "Analytics", icon: BarChart3 },
  {
    value: "events",
    label: "Events",
    icon: Calendar,
    render: () => <EventManagementApp />,
  },
  {
    value: "compare",
    label: "Compare",
    icon: Radar,
    render: ({ matchedInvestors, selectedInvestors }) => (
      <SpiderChart investors={matchedInvestors} selectedInvestors={selectedInvestors} />
    ),
  },
  { value: "montecarlo", label: "Monte Carlo", icon: BarChart3 },
  {
    value: "overview",
    label: "Overview",
    icon: Target,
    render: ({
      onMetricsLoaded, onSearchClick, events, userRole,
      onRegisterClick, registerModalOpen, onCloseRegisterModal,
      selectedEvent, onSubmitRegistration,
    }) => (
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
    ),
  },
  {
    value: "messages",
    label: "Messages",
    icon: MessageSquare,
    render: ({ messages }) => <MessagesDashboard messages={messages} />,
  },
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
  const scrollRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const [matchedInvestors, setMatchedInvestors] = useState([]);
  const [selectedInvestors, setSelectedInvestors] = useState([]);
  const [simulationResults, setSimulationResults] = useState(null);

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

    if (selectedInvestors.length === 1) {
      const sel = filteredAndScored.find((x) => x.id === selectedInvestors[0].id);
      setSimulationResults(sel ? sel.simulation : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleInvestorSelect = (entity) => {
    setSelectedInvestors((prev) => {
      const isSelected = prev.some((i) => i.id === entity.id);
      const updated = isSelected ? prev.filter((i) => i.id !== entity.id) : [...prev, entity];

      if (updated.length === 1) {
        const only = updated[0];
        const withSim = matchedInvestors.find((m) => m.id === only.id) || only;
        setSimulationResults(withSim.simulation || null);
      } else if (updated.length === 0) {
        setSimulationResults(null);
      }
      return updated;
    });
  };

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

  // messages for the Messages tab (fallback to mocks)
  const [messages] = useState(
    incomingMessages && incomingMessages.length ? incomingMessages : mockMessages
  );

  return (
    <Tabs defaultValue={selectedTab} onValueChange={onTabChange} className="w-full px-4 py-2">
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

      {/* Overview / Messages / Compare */}
      {TABS.map(({ value, render, placeholder }) =>
        value === "overview" || value === "messages" || value === "compare" ? (
          <TabsContent key={value} value={value} className="mt-4">
            {value === "compare" ? (
              <div className="flex flex-col lg:flex-row gap-6">
                {/* LEFT: Filters */}
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
                {/* RIGHT: Chart */}
                <div className="w-full lg:w-3/4">
                  {selectedInvestors.length === 0 ? (
                    <div className="border rounded-lg p-6">
                      <p className="text-muted-foreground">
                        Select one or more items in <span className="font-medium">Matches</span> to visualize in the radar chart.
                      </p>
                    </div>
                  ) : (
                    <SpiderChart investors={matchedInvestors} selectedInvestors={selectedInvestors} />
                  )}
                </div>
              </div>
            ) : render ? (
              render({
                matches,
                filteredMatches,
                onSearchClick,
                onMetricsLoaded,
                // overview
                events,
                userRole,
                onRegisterClick,
                registerModalOpen,
                onCloseRegisterModal,
                selectedEvent,
                onSubmitRegistration,
                // messages
                messages,
                // compare
                matchedInvestors,
                selectedInvestors,
              })
            ) : (
              placeholder && <p className="text-muted text-center py-4">{placeholder}</p>
            )}
          </TabsContent>
        ) : null
      )}

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
                      onSelect={handleInvestorSelect}
                      isSelected={selectedInvestors.some((i) => i.id === entity.id)}
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
      {/* Events */}
      <TabsContent value="events" className="mt-4">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full ">
            <EventManagementApp />
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
            {selectedInvestors.length === 0 ? (
              <div className="border rounded-lg p-6">
                <p className="text-muted-foreground">
                  Select one item in <span className="font-medium">Matches</span> to run the Monte Carlo simulation.
                </p>
              </div>
            ) : (
              <div className="w-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-muted-foreground">
                    Showing simulation for: <span className="font-medium">{selectedInvestors[0]?.name}</span>
                  </div>
                </div>
                <MonteCarloResults
                  selectedStartup={selectedInvestors[selectedInvestors.length - 1]}
                  simulationResults={
                    simulationResults || selectedInvestors[selectedInvestors.length - 1]?.simulation
                  }
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
