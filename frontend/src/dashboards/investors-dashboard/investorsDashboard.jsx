// src/pages/InvestorsDashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import HeaderBar from "./dashboard-components/components/headerBarComponents/headerBar.jsx";
import { Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import defaultAvatar from "../../assets/default_user_image.png";
import InvestorTabs from "./dashboard-components/components/investorTabs.jsx";
import { makeApi } from "@/lib/apiClient.js";
import transformFilters from "./dashboard-components/components/matchComponents/FilterPanel/transformFilters.jsx";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function InvestorsDashboard() {
  const [matches, setMatches] = useState([]);
  const [filteredMatches, setFilteredMatches] = useState([]);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [investorName, setInvestorName] = useState("Investor");
  const [investor, setInvestor] = useState(null);
  const [userRole, setUserRole] = useState("");
  const [openChats, setOpenChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedTab, setSelectedTab] = useState("matches");

  // multi-select filters state
  const [filters, setFilters] = useState({
    stagePreferences: [],
    locationPreferences: [],
    industryPreferences: [],
    roiWeight: 20,
    technicalFoundersWeight: 15,
    previousExitsWeight: 10,
    revenueWeight: 25,
    teamSizeWeight: 10,
    currentlyRaisingWeight: 20,
  });

  const authRef = useRef({ token: null, userId: null });

  const mapMessages = (items) =>
    (Array.isArray(items) ? items : []).map((m) => ({
      id: m.id,
      subject: m.subject ?? "",
      preview: m.preview ?? "",
      created_at: m.created_at ?? m.date ?? null,
    }));

  const mapMatches = (items = []) =>
    items.map((it) => ({
      id: it.match_id || it.id,
      startup_id: it.startup_enterprise_id || it.startup?.id,
      startup_name: it.startup?.name || it.startup_name || "Startup",
      industry: it.startup?.profile?.industry || it.industry || it.startup_industry || "",
      funding_stage: it.startup?.profile?.stage || it.stage || it.funding_stage || "",
      location: it.startup?.location || it.location || "",
      score: Number(it.overall_score ?? 0),
      badges: it.badges || [],
      _raw: it,
    }));

  const filtersActive = (f) =>
    (f.stagePreferences?.length > 0) ||
    (f.industryPreferences?.length > 0) ||
    (f.locationPreferences?.length > 0);

  const applyLocalMultiFilter = (allMatches, f) => {
    const lower = (s) => (s || "").toString().trim().toLowerCase();
    const has = (arr, x) => arr.includes(x);

    const wantStages = (f.stagePreferences || []).map(lower);
    const wantIndustries = (f.industryPreferences || []).map(lower);
    const wantLocs = (f.locationPreferences || []).map(lower);

    return (filtersActive(f) ? allMatches.filter((m) => {
      const stage = lower(m.funding_stage);
      const ind = lower(m.industry);
      const loc = lower(m.location || m._raw?.startup?.location || "");

      if (wantStages.length && !has(wantStages, stage)) return false;          // exact
      if (wantIndustries.length && !has(wantIndustries, ind)) return false;    // exact
      if (wantLocs.length && !wantLocs.some((w) => loc.includes(w))) return false; // substring any
      return true;
    }) : allMatches);
  };

  const fetchMatchesWithFilters = async (raw) => {
    const { token } = authRef.current || {};
    if (!token) return;

    const f = transformFilters(raw); // gives arrays + back-compat singles
    try {
      const res = await fetchMatchesApi(
        {
          filters: {
            stagePreferences: f.stagePreferences,
            industryPreferences: f.industryPreferences,
            locationPreferences: f.locationPreferences,
            // back-compat singles if your server still reads them
            stagePreference: f.stagePreference,
            industryPreference: f.industryPreference,
            locationPreference: f.locationPreference,
          },
          weights: {
            roiWeight: f.roiWeight,
            technicalFoundersWeight: f.technicalFoundersWeight,
            previousExitsWeight: f.previousExitsWeight,
            revenueWeight: f.revenueWeight,
            teamSizeWeight: f.teamSizeWeight,
            currentlyRaisingWeight: f.currentlyRaisingWeight,
          },
        },
        token
      );

      const mMatches = mapMatches(res?.matches || []);
      setMatches(mMatches);
      setFilteredMatches(filtersActive(f) && mMatches.length === 0 ? [] : mMatches);
    } catch (err) {
      console.warn("Server match fetch failed, falling back locally:", err);
      setFilteredMatches(applyLocalMultiFilter(matches, f));
    }
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { setLoading(false); return; }

        const token = session.access_token;
        const userId = session.user.id;
        authRef.current = { token, userId };
        const api = makeApi(token);

        // Fetch basic stuff
        const [me, investorData, inbox, upcoming, notifs] = await Promise.all([
          api.me(),
          api.investorMe(),
          api.messages(5),
          api.events(20),
          api.notifications(20).catch(() => []),
        ]);
        if (cancelled) return;

        const firstName = me?.first_name || "Investor";
        const lastName = me?.last_name || "";
        setInvestorName(me?.full_name || `${firstName}${lastName ? " " + lastName : ""}`);
        setUserRole(me?.role || me?.user_role || "");
        setAvatarUrl(me?.profile_image_url || defaultAvatar);
        setInvestor(investorData || null);

        setMessages(mapMessages(inbox?.items || inbox?.messages || inbox || []));
        setNotifications(mapMessages(notifs?.items || notifs?.messages || notifs || []));

        setEvents((upcoming || []).map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          date: e.start_time || e.date,
          agenda: e.agenda || [],
          presenters: e.speakers || e.presenters || [],
          registration_status: e.registration?.status || e.registration_status || null,
          _raw: e,
        })));

        // Seed from sessionStorage if you like
        const stored = JSON.parse(sessionStorage.getItem("investmentPreferences") || "null");
        const initial = {
          ...filters,
          stagePreferences: stored?.investment_stages || stored?.stagePreferences || [],
          industryPreferences: stored?.industries || stored?.industryPreferences || [],
          locationPreferences: stored?.geographic_focus || stored?.locationPreferences || [],
        };
        setFilters(initial);

        await fetchMatchesWithFilters(initial);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    bootstrap();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenRegister = (event) => { setSelectedEvent(event); setShowRegisterModal(true); };

  const handleSubmitRegistration = async (answers) => {
    try {
      const { token, userId } = authRef.current || {};
      if (!token || !userId) throw new Error("Not authenticated");
      const api = makeApi(token);
      await api.registerToEvent(selectedEvent.id, answers);
      setEvents((prev) =>
        prev.map((e) => e.id === selectedEvent.id ? { ...e, registration_status: "registered" } : e)
      );
      setShowRegisterModal(false);
    } catch (e) { console.error("Event registration failed:", e); }
  };

  // Called by Tools/Search – accept arrays or strings
  const handleSearchClick = (payload = {}) => {
    const ensureArr = (v) => Array.isArray(v) ? v : (v ? [v] : []);
    const nextRaw = {
      ...filters,
      stagePreferences: ensureArr(payload.stages ?? payload.stage ?? filters.stagePreferences),
      industryPreferences: ensureArr(payload.industries ?? payload.industry ?? filters.industryPreferences),
      locationPreferences: ensureArr(payload.locations ?? payload.location ?? filters.locationPreferences),
    };
    setFilters(nextRaw);
    fetchMatchesWithFilters(nextRaw);
  };

  const handleOpenChat = (msg) => {
    setOpenChats((prev) => prev.some((c) => c.sender === msg.sender) ? prev : [...prev, { sender: msg.sender, history: [msg] }]);
  };
  const handleCloseChat = (sender) => setOpenChats((prev) => prev.filter((c) => c.sender !== sender));

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-gray-600">
        <Loader2 className="h-10 w-10 animate-spin mb-4 text-gray-800" />
        <p className="text-sm">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <>
      <HeaderBar
        investorName={investorName}
        notifications={notifications}
        profileImage={avatarUrl}
        messages={messages}
        onOpenChat={handleOpenChat}
      />
      <InvestorTabs
        matches={matches}
        filteredMatches={filteredMatches}
        onSearchClick={handleSearchClick} // accepts { industries, stages, locations }
        selectedTab={selectedTab}
        onTabChange={setSelectedTab}
        events={events}
        userRole={userRole}
        onRegisterClick={setShowRegisterModal}
        registerModalOpen={showRegisterModal}
        onCloseRegisterModal={() => setShowRegisterModal(false)}
        selectedEvent={selectedEvent}
        onSubmitRegistration={handleSubmitRegistration}
        onMetricsLoaded={() => {}}
        messages={messages}
        onOpenChat={handleOpenChat}
        openChats={openChats}
        onCloseChat={handleCloseChat}
      />
    </>
  );
}

export default InvestorsDashboard;