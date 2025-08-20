import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import NavigationTabs from "./components/NavigationTabs";
import EventList from "./components/EventList";
import PurchaseForm from "./components/PurchaseForm";
import AnalyticsCards from "./components/AnalyticsCards";
import MyTickets from "./components/MyTickets";
import { MOCK_ANALYTICS } from "./data/mockAnalytics";

/**
 * EventManagementApp
 * - Replaces MOCK_EVENTS with live data from Supabase table `event` (singular)
 * - Connects tickets to Supabase table `tickets` (no in-memory array)
 * - Keeps child component APIs by mapping DB rows to UI shape
 * - Simple loading/error states
 */

// Prefer environment variables; supports Vite and Next.js public env keys
const SUPABASE_URL =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL
    ? import.meta.env.VITE_SUPABASE_URL
    : process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY
    ? import.meta.env.VITE_SUPABASE_ANON_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function formatUiEvent(row) {
  // Create friendly date/time strings and map DB fields to the UI shape used by components
  const start = row.start_time ? new Date(row.start_time) : null;
  const end = row.end_time ? new Date(row.end_time) : null;
  const date = start
    ? start.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "";
  const time = start && end
    ? `${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
    : "";

  const vd = row.venue_details || {};
  const venue = vd.name ? [vd.name, vd.city].filter(Boolean).join(", ") : row.location || "";

  const ed = row.event_details || {};
  const capacity = {
    total: Number(row.max_attendees || 0),
    sold: Number(row.current_attendees || 0),
    available: Math.max(Number(row.max_attendees || 0) - Number(row.current_attendees || 0), 0),
  };
  const pricing = {
    vip: ed?.pricing?.vip ?? Number(row.ticket_price || 0),
    standard: ed?.pricing?.standard ?? Number(row.ticket_price || 0),
    residents: ed?.pricing?.residents ?? Number(row.ticket_price || 0),
  };

  return {
    id: row.id,
    title: row.title,
    date,
    time,
    venue,
    featured: ed.featured || "",
    special: ed.special || "",
    capacity,
    pricing,
  };
}

function formatUiTicket(row) {
  return {
    id: row.id,
    investorId: row.investor_id,
    eventId: row.event_id,
    tier: row.tier,
    purchaseDate: row.purchase_date,
    code: row.code,
  };
}

const EventManagementApp = () => {
  const [activeTab, setActiveTab] = useState("events");
  const [selectedEventId, setSelectedEventId] = useState(null);

  // 🔐 In a real app, get this from Supabase auth.user()
  const currentInvestorId = "investor-demo";

  // Live events from Supabase
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState(null);

  // Live tickets from Supabase (for current investor)
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketsError, setTicketsError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      setLoadingEvents(true);
      setEventsError(null);
      const { data, error } = await supabase
        .from("event")
        .select(
          "id, title, event_type, start_time, end_time, location, venue_details, ticket_price, max_attendees, current_attendees, event_details"
        )
        .order("start_time", { ascending: true });

      if (!isMounted) return;
      if (error) {
        setEventsError(error.message || "Failed to load events");
        setEvents([]);
      } else {
        setEvents((data || []).map(formatUiEvent));
      }
      setLoadingEvents(false);
    }

    async function loadTickets() {
      setLoadingTickets(true);
      setTicketsError(null);
      const { data, error } = await supabase
        .from("tickets")
        .select("id, investor_id, event_id, tier, purchase_date, code")
        .eq("investor_id", currentInvestorId)
        .order("purchase_date", { ascending: false });

      if (!isMounted) return;
      if (error) {
        setTicketsError(error.message || "Failed to load tickets");
        setTickets([]);
      } else {
        setTickets((data || []).map(formatUiTicket));
      }
      setLoadingTickets(false);
    }

    loadEvents();
    loadTickets();

    return () => {
      isMounted = false;
    };
  }, [currentInvestorId]);

  const handleEventClick = (eventId) => {
    setSelectedEventId(eventId);
    setActiveTab("purchase");
  };

  // Helper for a short, readable code like INV-AB12-OCT25-VIP
  const generateTicketCode = (p) => {
    const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(2, 6);
    const tier = p.ticketType.slice(0, 3).toUpperCase();
    const ev = String(p.eventId).split("-")[0].toUpperCase();
    return `INV-${rand}-${ev}-${tier}`;
  };

  // 👇 Called by PurchaseForm on simulated submit — now persists to Supabase
  const handleSimulatedPurchase = async (payload) => {
    const code = generateTicketCode(payload);
    const row = {
      investor_id: currentInvestorId,
      event_id: payload.eventId,
      tier: payload.ticketType,
      purchase_date: payload.createdAt,
      code,
    };

    const { error } = await supabase.from("tickets").insert(row);
    if (error) {
      console.error("Ticket insert failed:", error);
      alert(`Failed to create ticket: ${error.message}`);
      return;
    }

    // Refresh tickets after insert
    const { data, error: reloadErr } = await supabase
      .from("tickets")
      .select("id, investor_id, event_id, tier, purchase_date, code")
      .eq("investor_id", currentInvestorId)
      .order("purchase_date", { ascending: false });
    if (reloadErr) {
      console.error("Ticket reload failed:", reloadErr);
    } else {
      setTickets((data || []).map(formatUiTicket));
    }

    // Optionally jump to My Tickets tab
    setActiveTab("myTickets");
  };

  const content = useMemo(() => {
    const loading = loadingEvents || loadingTickets;
    const error = eventsError || ticketsError;

    if (loading) {
      return (
        <div className="rounded-2xl bg-white/80 shadow p-6 text-center text-gray-600">Loading…</div>
      );
    }
    if (error) {
      return (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 text-center text-rose-700">
          {eventsError && (
            <div>Failed to load events: <span className="font-medium">{eventsError}</span></div>
          )}
          {ticketsError && (
            <div className="mt-2">Failed to load tickets: <span className="font-medium">{ticketsError}</span></div>
          )}
        </div>
      );
    }

    return (
      <>
        {activeTab === "events" && (
          <EventList events={events} showFilters onEventClick={handleEventClick} />
        )}

        {activeTab === "purchase" && (
          <PurchaseForm
            events={events}
            defaultEventId={selectedEventId}
            onSimulatePurchase={handleSimulatedPurchase}
          />
        )}

        {activeTab === "analytics" && <AnalyticsCards analytics={MOCK_ANALYTICS} />}

        {activeTab === "myTickets" && (
          <MyTickets
            tickets={tickets}
            events={events}
            currentInvestorId={currentInvestorId}
          />
        )}
      </>
    );
  }, [activeTab, events, eventsError, tickets, ticketsError, loadingEvents, loadingTickets, selectedEventId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          <NavigationTabs activeTab={activeTab} onChange={setActiveTab} />
          {content}
        </div>
      </main>
    </div>
  );
};

export default EventManagementApp;
