import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import NavigationTabs from "./components/NavigationTabs";
import EventList from "./components/EventList";
import PurchaseForm from "./components/PurchaseForm";
import AnalyticsCards from "./components/AnalyticsCards";
import MyTickets from "./components/MyTickets";
import { MOCK_ANALYTICS } from "./data/mockAnalytics";

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
  const start = row.start_time ? new Date(row.start_time) : null;
  const end = row.end_time ? new Date(row.end_time) : null;
  return {
    id: row.id,
    title: row.title,
    startDate: start,
    endDate: end,
    startISO: row.start_time || null,
    endISO: row.end_time || null,
    startMs: row.start_time ? Date.parse(row.start_time) : NaN,
    endMs: row.end_time ? Date.parse(row.end_time) : NaN,
    date: start
      ? start.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
      : "",
    time:
      start && end
        ? `${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
        : "",
    venue: row.venue_details?.name
      ? [row.venue_details.name, row.venue_details.city].filter(Boolean).join(", ")
      : row.location || "",
    featured: row.event_details?.featured || "",
    special: row.event_details?.special || "",
    capacity: {
      total: Number(row.max_attendees || 0),
      sold: Number(row.current_attendees || 0),
      available: Math.max(Number(row.max_attendees || 0) - Number(row.current_attendees || 0), 0),
    },
    pricing: {
      vip: row.event_details?.pricing?.vip ?? Number(row.ticket_price || 0),
      standard: row.event_details?.pricing?.standard ?? Number(row.ticket_price || 0),
      residents: row.event_details?.pricing?.residents ?? Number(row.ticket_price || 0),
    },
  };
}

const EventManagementApp = () => {
  const [activeTab, setActiveTab] = useState("events");
  const [selectedEventId, setSelectedEventId] = useState(null);

  const currentInvestorId = "investor-demo";

  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadEvents() {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("event")
        .select(
          "id, title, event_type, start_time, end_time, location, venue_details, ticket_price, max_attendees, current_attendees, event_details"
        )
        .order("start_time", { ascending: true });

      if (!isMounted) return;
      if (error) {
        setError(error.message || "Failed to load events");
        setEvents([]);
      } else {
        setEvents((data || []).map(formatUiEvent));
      }
      setLoading(false);
    }

    async function loadTickets() {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, investor_id, event_id, tier, purchase_date, code")
        .eq("investor_id", currentInvestorId)
        .order("purchase_date", { ascending: false });
      if (!isMounted) return;
      if (error) {
        console.error("Failed to load tickets", error);
      } else {
        setTickets(
          (data || []).map((t) => ({
            id: t.id,
            investorId: t.investor_id,
            eventId: t.event_id,
            tier: t.tier,
            purchaseDate: t.purchase_date,
            code: t.code,
          }))
        );
      }
    }

    loadEvents();
    loadTickets();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleEventClick = (eventId) => {
    setSelectedEventId(eventId);
    setActiveTab("purchase");
  };

  const generateTicketCode = (p) => {
    const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(2, 6);
    const tier = p.ticketType.slice(0, 3).toUpperCase();
    const ev = String(p.eventId).split("-")[0].toUpperCase();
    return `INV-${rand}-${ev}-${tier}`;
  };

  const handleSimulatedPurchase = async (payload) => {
    const newTicket = {
      investor_id: currentInvestorId,
      event_id: payload.eventId,
      tier: payload.ticketType,
      purchase_date: payload.createdAt,
      code: generateTicketCode(payload),
    };
    const { data, error } = await supabase.from("tickets").insert(newTicket).select().single();
    if (error) {
      console.error("Failed to insert ticket", error);
      return;
    }
    setTickets((prev) => [
      {
        id: data.id,
        investorId: data.investor_id,
        eventId: data.event_id,
        tier: data.tier,
        purchaseDate: data.purchase_date,
        code: data.code,
      },
      ...prev,
    ]);
  };

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="rounded-2xl bg-white/80 shadow p-6 text-center text-gray-600">Loading events…</div>
      );
    }
    if (error) {
      return (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 text-center text-rose-700">
          Failed to load events: <span className="font-medium">{error}</span>
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
  }, [activeTab, events, error, loading, selectedEventId, tickets]);

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
