import React, { useRef, useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Users,
  Target,
  BarChart3,
  Radar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

// Core dashboard pieces
import InvestorOverview from "./investorOverview.jsx";
import MatchFeed from "./matchComponents/matchFeed.jsx";
import PortfolioSummary from "./portfolioSummary.jsx";
import InvestorTools from "./investorTools.jsx";

// Events + Registration
import EventList from "@/pages/eventShowcaseComponents/eventShowcaseAccess.jsx";
import RegisterModal from "@/pages/eventShowcaseComponents/RegisterModal.jsx";

// Messaging
import MessagesPreview from "./messagesComponents/messagesPreview.jsx";
import MessagesDock from "./messagesComponents/messagesDock.jsx";

// Matching & Filters
import { InvestorMatcher } from "./matchComponents/algorithms/matchingAlgorithm.js";
import transformFilters from "./matchComponents/FilterPanel/transformFilters.jsx";
import FilterPanel from "./matchComponents/FilterPanel/filterPanel.jsx";
import mockMatches from "./matchComponents/mockInvestors.js";
import StartupCard from "./matchComponents/FilterPanel/StartupCard.jsx";

// Tabs to keep: matches, analytics, compare, mont carlo, overview, messages
const TABS = [
  { value: "matches", label: "Matches", icon: Users },
  { value: "analytics", label: "Analytics", icon: BarChart3 },
  { value: "compare", label: "Compare", icon: Radar },
  { value: "montecarlo", label: "Monte Carlo", icon: BarChart3 },
  {
    value: "overview",
    label: "Overview",
    icon: Target,
    render: ({
      onMetricsLoaded,
      onSearchClick,
      events,
      userRole,
      onRegisterClick,
      registerModalOpen,
      onCloseRegisterModal,
      selectedEvent,
      onSubmitRegistration,
    }) => (
      <>
      
      <InvestorOverview onMetricsLoaded={onMetricsLoaded ?? (() => {})} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          <PortfolioSummary />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <InvestorTools onSearchClick={onSearchClick} />
          
        </div>
      </div>
      {/* Events */}
      <div id="events">
            <EventList
              events={events}
              role={userRole}
              onRegisterClick={onRegisterClick}
            />
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
    icon: Users,
    render: ({ messages, onOpenChat, openChats, onCloseChat }) => (
      <>
        <MessagesPreview messages={messages} onOpenChat={onOpenChat} />
        <MessagesDock openChats={openChats} onCloseChat={onCloseChat} />
      </>
    ),
  },
];

function InvestorTabs({
  // matches are available if you want them later
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

  // Messages props
  messages,
  onOpenChat,
  openChats,
  onCloseChat,
}) {
  const scrollRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // --- Matching & Filters state/logic (shared sidebar for 4 tabs) ---
  const [matchedInvestors, setMatchedInvestors] = useState([]);
  const [selectedInvestors, setSelectedInvestors] = useState([]);

  const [filters, setFilters] = useState({
    userType: "vc",
    stagePreference: "All",
    locationPreference: "All",
    industryPreference: "All",
    checkSizeRange: "All",

    // sliders
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
      stagePreference: "All",
      locationPreference: "All",
      industryPreference: "All",
      checkSizeRange: "All",
      roiWeight: 20,
      technicalFoundersWeight: 15,
      previousExitsWeight: 15,
      revenueWeight: 20,
      teamSizeWeight: 15,
      currentlyRaisingWeight: 15,
    });

  // Compute matched investors whenever filters change
  useEffect(() => {
    const matcher = new InvestorMatcher();
    const simFilters = transformFilters(filters);

    const filteredAndScored = (mockMatches || [])
      .filter((inv) => {
        const matchesStage =
          filters.stagePreference === "All" ||
          inv.stage?.includes?.(filters.stagePreference);
        const matchesIndustry =
          filters.industryPreference === "All" ||
          inv.industries?.includes?.(filters.industryPreference);
        const matchesLocation =
          filters.locationPreference === "All" ||
          inv.location?.includes?.(filters.locationPreference);
        return matchesStage && matchesIndustry && matchesLocation;
      })
      .map((investor) => {
        const sim = matcher.runMonteCarloSimulation(investor, simFilters);
        return { ...investor, matchScore: sim.mean, simulation: sim };
      });

    setMatchedInvestors(filteredAndScored);
  }, [filters]);

  const handleInvestorSelect = (investor) => {
    setSelectedInvestors((prev) => {
      const isSelected = prev.some((i) => i.id === investor.id);
      return isSelected
        ? prev.filter((i) => i.id !== investor.id)
        : [...prev, investor];
    });
  };

  // --- Tabs horizontal scroll logic ---
  const scrollTabs = (direction) => {
    const container = scrollRef.current;
    if (!container) return;
    const scrollAmount = 150;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
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

  // Reusable layout with sidebar
  const SidebarLayout = ({ children }) => (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* LEFT: Filter Panel */}
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

      {/* RIGHT: Content */}
      <div className="w-full lg:w-3/4">{children}</div>
    </div>
  );

  return (
    <Tabs
      defaultValue={selectedTab}
      onValueChange={onTabChange}
      className="w-full px-4 py-2"
    >
      {/* Tab Bar with Arrows */}
      <div className="relative w-full flex items-center justify-center">
        {isOverflowing && (
          <button
            className="absolute left-0 z-10 bg-white rounded-full shadow-md p-1"
            onClick={() => scrollTabs("left")}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="overflow-x-auto no-scrollbar w-full px-6"
        >
          <TabsList className="flex w-max min-w-full gap-2 bg-muted text-muted-foreground h-9 items-center rounded-lg p-[3px]">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center justify-center h-full gap-2 flex-shrink-0"
              >
                {Icon ? <Icon className="w-4 h-4" /> : null}
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {isOverflowing && (
          <button
            className="absolute right-0 z-10 bg-white rounded-full shadow-md p-1"
            onClick={() => scrollTabs("right")}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Config-driven panels (Overview + Messages) */}
      {TABS.map(({ value, render, placeholder }) =>
        value === "overview" || value === "messages" ? (
          <TabsContent key={value} value={value} className="mt-4">
            {render
              ? render({
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
                  onOpenChat,
                  openChats,
                  onCloseChat,
                })
              : placeholder && (
                  <p className="text-muted text-center py-4">{placeholder}</p>
                )}
          </TabsContent>
        ) : null
      )}

      {/* Matches: sidebar layout */}
      <TabsContent value="matches" className="mt-4">
        <SidebarLayout>
          {/* Use cards grid; fallback to filteredMatches if no simulation yet */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(matchedInvestors && matchedInvestors.length
              ? matchedInvestors
              : filteredMatches
            ).map((investor, index) =>
              investor ? (
                <StartupCard
                  key={(investor.id || investor.name || "inv") + index}
                  investor={investor}
                  matchScore={investor.matchScore}
                  onSelect={handleInvestorSelect}
                  isSelected={selectedInvestors.some((i) => i.id === investor.id)}
                />
              ) : null
            )}
          </div>

          {/* If you still want the old list view somewhere */}
          {/* <div className="mt-6">
            <MatchFeed matches={matchedInvestors.length ? matchedInvestors : filteredMatches} />
          </div> */}
        </SidebarLayout>
      </TabsContent>

      {/* Analytics: sidebar layout, right now placeholder content */}
      <TabsContent value="analytics" className="mt-4">
        <SidebarLayout>
          <div className="border rounded-lg p-6">
            <p className="text-muted-foreground">
              Analytics coming soon. Use the filters on the left to scope your analytics.
            </p>
          </div>
        </SidebarLayout>
      </TabsContent>

      {/* Compare: sidebar layout, placeholder */}
      <TabsContent value="compare" className="mt-4">
        <SidebarLayout>
          <div className="border rounded-lg p-6">
            <p className="text-muted-foreground">
              Comparison tool coming soon. Select investors with the filters to compare.
            </p>
          </div>
        </SidebarLayout>
      </TabsContent>

      {/* Monte Carlo: sidebar layout, placeholder */}
      <TabsContent value="montecarlo" className="mt-4">
        <SidebarLayout>
          <div className="border rounded-lg p-6">
            <p className="text-muted-foreground">
              Monte Carlo analysis coming soon. Adjust weights in the filters to simulate outcomes.
            </p>
          </div>
        </SidebarLayout>
      </TabsContent>
    </Tabs>
  );
}

export default InvestorTabs;
