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
import { createClient } from "@supabase/supabase-js";
import { saveInvestorPreferences, fetchMatches } from "@/api/matching";
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
import StartupCard from "./matchComponents/FilterPanel/StartupCard.jsx";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

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
  const [matchedInvestors, setMatchedInvestors] = useState([]); // will now hold *startups* with matchScore
  const [selectedInvestors, setSelectedInvestors] = useState([]); // keep name; still works (ids)

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
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return; // not logged in; nothing to fetch

        // 1) save preferences
        const prefs = transformFilters(filters);
        await saveInvestorPreferences(prefs, token);

        // 2) fetch weighted matches
        const resp = await fetchMatches(
          { weights: prefs, filters: prefs },
          token
        );
        const items = Array.isArray(resp?.matches) ? resp.matches : [];

        // 3) map API -> card-friendly startup object
        const mapped = items.map((m) => {
          const s = m?.startup || m?.enterprise || m?.startup_enterprise || {};
          const sp = s?.startup_profile || m?.startup_profile || {};
          const prof = s?.profile || m?.profile || {};

          const startup = {
            id:
              s.id ||
              m.startup_enterprise_id ||
              m.match_id ||
              Math.random().toString(36).slice(2),
            name: s.name || m.startup_name || "Startup",
            industry: prof?.industry || s.industry || m.industry || "",
            stage: prof?.stage || s.stage || m.stage || "",
            location: s.location || "",
            // fields StartupCard understands for startups:
            employees: sp?.team_size ?? s.employee_count ?? null,
            revenueMonthlyUSD:
              sp?.mrr_usd ?? sp?.display_mrr_usd ?? sp?.current_revenue ?? null,
            valuationUSD:
              sp?.current_valuation_usd ?? sp?.display_valuation_usd ?? null,
            tags: Array.isArray(prof?.headline_tags) ? prof.headline_tags : [],
            currentInvestors: Array.isArray(sp?.current_investors)
              ? sp.current_investors
              : [],
            keyMetrics: {
              technicalFounders:
                (Number(sp?.technical_founders_pct ?? 0) || 0) / 100,
              previousExits: (Number(sp?.previous_exits_pct ?? 0) || 0) / 100,
            },
          };

          const scorePct =
            typeof m?.overall_score === "number"
              ? Math.round(m.overall_score * 100)
              : Number(m?.score) || 0;

          return { ...startup, matchScore: scorePct };
        });

        if (!cancelled) setMatchedInvestors(mapped);
      } catch (e) {
        console.error("Weighted matches fetch failed:", e);
        // (Optional) leave previous results in place or clear:
        if (!cancelled) setMatchedInvestors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
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
            ).map((startup, index) =>
              startup ? (
                <StartupCard
                  key={(startup.id || startup.name || "st") + index}
                  startup={startup}
                  matchScore={startup.matchScore}
                  onSelect={handleInvestorSelect}
                  isSelected={selectedInvestors.some(
                    (i) => i.id === startup.id
                  )}
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
              Analytics coming soon. Use the filters on the left to scope your
              analytics.
            </p>
          </div>
        </SidebarLayout>
      </TabsContent>

      {/* Compare: sidebar layout, placeholder */}
      <TabsContent value="compare" className="mt-4">
        <SidebarLayout>
          <div className="border rounded-lg p-6">
            <p className="text-muted-foreground">
              Comparison tool coming soon. Select investors with the filters to
              compare.
            </p>
          </div>
        </SidebarLayout>
      </TabsContent>

      {/* Monte Carlo: sidebar layout, placeholder */}
      <TabsContent value="montecarlo" className="mt-4">
        <SidebarLayout>
          <div className="border rounded-lg p-6">
            <p className="text-muted-foreground">
              Monte Carlo analysis coming soon. Adjust weights in the filters to
              simulate outcomes.
            </p>
          </div>
        </SidebarLayout>
      </TabsContent>
    </Tabs>
  );
}

export default InvestorTabs;
