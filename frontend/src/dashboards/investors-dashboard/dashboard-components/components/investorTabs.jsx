import React, { useRef, useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Target, BarChart3, Radar, ChevronLeft, ChevronRight } from "lucide-react";

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

// Tabs to keep: matches, analytics, compare, mont carlo, overview, messages
const TABS = [
  {
    value: "matches",
    label: "Matches",
    icon: Users,
    render: ({ filteredMatches, onSearchClick }) => (
      <>
        <MatchFeed matches={filteredMatches} />
      </>
    ),
  },
  {
    value: "analytics",
    label: "Analytics",
    icon: BarChart3,
  },
  {
    value: "compare",
    label: "Compare",
    icon: Radar,
    placeholder: "Comparison tool coming soon.",
  },
  {
    value: "montecarlo",
    label: "Monte Carlo",
    icon: BarChart3,
    placeholder: "Monte Carlo analysis coming soon.",
  },
  {
    value: "overview",
    label: "Overview",
    icon: Target,
    // Overview aggregates dashboard content EXCEPT messages
    render: ({
      onMetricsLoaded,
      filteredMatches,
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
          {/* Events */}
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
        </div>
  
        {/* Right column */}
        <div className="space-y-4">
          <InvestorTools onSearchClick={onSearchClick} />
          
        </div>
      </div>
      <PortfolioSummary />
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
    <Tabs defaultValue={selectedTab} onValueChange={onTabChange} className="w-full px-4 py-2">
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

        <div ref={scrollRef} className="overflow-x-auto no-scrollbar w-full px-6">
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

      {/* Tab Content Panels */}
      {TABS.map(({ value, render, placeholder }) => (
        <TabsContent key={value} value={value} className="mt-4">
          {render ? (
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

export default InvestorTabs;
