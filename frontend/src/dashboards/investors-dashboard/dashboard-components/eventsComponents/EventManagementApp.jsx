// EventManagementApp.jsx
import React, { useState } from "react";
import NavigationTabs from "./components/NavigationTabs";
import EventList from "./components/EventList";
import PurchaseForm from "./components/PurchaseForm";
import TicketValidator from "./components/TicketValidator";
import AnalyticsCards from "./components/AnalyticsCards";
import { MOCK_EVENTS } from "./data/mockEvents";
import { MOCK_ANALYTICS } from "./data/mockAnalytics";

const EventManagementApp = () => {
  const [activeTab, setActiveTab] = useState("events");
  const [selectedEventId, setSelectedEventId] = useState(null);

  // ⬇ when a card is clicked, go to Purchase and remember the event id
  const handleEventClick = (eventId) => {
    setSelectedEventId(eventId);
    setActiveTab("purchase");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          <NavigationTabs activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === "events" && (
            <EventList
              events={MOCK_EVENTS}
              showFilters
              onEventClick={handleEventClick}   // ⬅ pass handler down
            />
          )}

          {activeTab === "purchase" && (
            <PurchaseForm
              events={MOCK_EVENTS}
              defaultEventId={selectedEventId}  // ⬅ preselect this in the form
            />
          )}

          {/*activeTab === "validate" && (
            <TicketValidator events={MOCK_EVENTS} />
          )*/}

          {activeTab === "analytics" && (
            <AnalyticsCards analytics={MOCK_ANALYTICS} />
          )}
        </div>
      </main>
      {/* <Footer /> */}
    </div>
  );
};

export default EventManagementApp;
