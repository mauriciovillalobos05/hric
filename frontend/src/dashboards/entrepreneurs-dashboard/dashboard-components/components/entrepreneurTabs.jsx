// EntrepreneurTabs.jsx
import React, { useRef, useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Users,
  Target,
  FileText,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button.jsx";

// KYC (same panel used in investor tabs)
import EntrepreneurKycPanel from "./kycComponents/EntrepreneurKycPanel.jsx";

// Entrepreneur components
import MatchesDashboard from "./matchComponents/matchesDashboard.jsx";
import DocumentStatus from "./documentStatus.jsx";
import EventList from "@/pages/eventShowcaseComponents/eventShowcaseAccess.jsx";
import FilterPanel from "./matchComponents/components/FilterPanel/FilterPanel.jsx";
import InsightsPanel from "./insights/insightsPanel.jsx";

// Messaging
import MessagesPreview from "./messagesComponents/messagesPreview.jsx";
import MessagesDock from "./messagesComponents/messagesDock.jsx";

// Insights mock data
import {
  demoStats,
  demoTimeseries,
  demoViewers,
} from "./insights/mockInsights.js";

// Tabs to keep: matches, analytics, compare, mont carlo, overview, messages
const ENTREPRENEUR_TABS = [
  {
    value: "matches",
    label: "Investor Matches",
    icon: Users,
    render: ({
      // filters-related
      filters,
      onFilterChange,
      onResetFilters,
      // matches-related
      matchedInvestors,
      selectedInvestors,
      onInvestorSelect,
      simulationResults,
    }) => (
      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT: Filter Panel */}
        <div className="w-full lg:w-1/4 space-y-4 lg:sticky lg:top-6">
          <FilterPanel filters={filters} onFilterChange={onFilterChange} />
          <Button
            variant="outline"
            className="w-full flex items-center justify-center"
            onClick={onResetFilters}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset Filters
          </Button>
        </div>

        {/* RIGHT: Results */}
        <div className="w-full lg:w-3/4">
          <MatchesDashboard
            matchedInvestors={matchedInvestors}
            selectedInvestors={selectedInvestors}
            onInvestorSelect={onInvestorSelect}
            simulationResults={simulationResults}
          />
        </div>
      </div>
    ),
  },
  {
    value: "overview",
    label: "Overview",
    icon: Target,
    render: ({
      enterprise, // include if you want the card
      events,
      onRegisterClick,
      // If rendering modal here, also take:
      // registerModalOpen, onCloseRegisterModal, selectedEvent, onSubmitRegistration, userRole
    }) => (
      <>
        {/* ✅ KYC panel added just like investorTabs.jsx */}
        <EntrepreneurKycPanel />

        {/* Optional summary on top */}
        <EventList
          events={events}
          role="entrepreneur"
          onRegisterClick={onRegisterClick}
        />
      </>
    ),
  },
  {
    value: "documents",
    label: "Documents",
    icon: FileText,
    render: () => <DocumentStatus />,
  },
  {
    value: "messages",
    label: "Messages",
    icon: MessageSquare,
    render: ({ messages, onOpenChat, openChats, onCloseChat }) => (
      <>
        <MessagesPreview messages={messages} onOpenChat={onOpenChat} />
        <MessagesDock openChats={openChats} onCloseChat={onCloseChat} />
      </>
    ),
  },
  {
    value: "insights",
    label: "Insights",
    icon: BarChart3,
    render: () => (
      <div className="mx-auto max-w-6xl">
        <InsightsPanel
          isPremium={true}
          stats={demoStats}
          timeseries={demoTimeseries}
          viewers={demoViewers}
          onUpgrade={() => {
            /* navigate('/billing') */
          }}
        />
      </div>
    ),
  },
];

function EntrepreneurTabs({
  selectedTab = "matches",
  onTabChange = () => {},

  // filters
  filters,
  onFilterChange,
  onResetFilters,

  // matches
  matchedInvestors,
  selectedInvestors,
  onInvestorSelect,
  simulationResults,

  // overview
  enterprise,
  events,
  onRegisterClick,
  registerModalOpen,
  onCloseRegisterModal,
  selectedEvent,
  onSubmitRegistration,
  userRole,

  // messages
  messages,
  onOpenChat,
  openChats,
  onCloseChat,
}) {
  const scrollRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

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
            {ENTREPRENEUR_TABS.map(({ value, label, icon: Icon }) => (
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

      {/* Tab Content */}
      {ENTREPRENEUR_TABS.map(({ value, render, placeholder }) => (
        <TabsContent key={value} value={value} className="mt-4">
          {render ? (
            render({
              // filters
              filters,
              onFilterChange,
              onResetFilters,
              // matches
              matchedInvestors,
              selectedInvestors,
              onInvestorSelect,
              simulationResults,
              // overview
              enterprise,
              events,
              onRegisterClick,
              registerModalOpen,
              onCloseRegisterModal,
              selectedEvent,
              onSubmitRegistration,
              userRole,
              // messages
              messages,
              onOpenChat,
              openChats,
              onCloseChat,
            })
          ) : (
            <p className="text-muted text-center py-4">{placeholder}</p>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export default EntrepreneurTabs;