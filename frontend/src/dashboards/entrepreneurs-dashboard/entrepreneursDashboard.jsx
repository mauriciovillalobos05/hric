// =============================================
// FILE: EntrepreneurDashboard.jsx  (adapted to backend-driven matches)
// =============================================
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import HeaderBar from "./dashboard-components/components/headerBarComponents/headerBar.jsx";
import EntrepreneurTabs from "./dashboard-components/components/entrepreneurTabs.jsx";
import ProfileStatusCard from "./dashboard-components/components/profileStatusComponents/profileStatusCard.jsx";
import RegisterModal from "../../pages/eventShowcaseComponents/registerModal.jsx";
import { Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import ScrollToTopButton from "@/components/scrollToTopButton.jsx";
import defaultAvatar from "../../assets/default_user_image.png";

// IMPORTANT: this transform maps your UI filters to the
// entrepreneur weights JSON the backend expects (?weights=...)
// and also emits `raiseTargetUsd` for ?raise_target_usd=
import transformFilters from "./dashboard-components/components/matchComponents/components/FilterPanel/transformFilters.jsx";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function EntrepreneurDashboard() {
  const [entrepreneurName, setEntrepreneurName] = useState("Founder");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [userRole, setUserRole] = useState("");
  const [enterprise, setEnterprise] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [openChats, setOpenChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [events, setEvents] = useState([]);

  // Matches-related state (cards fetch happens downstream in MatchesDashboard)
  const [matchedInvestors] = useState([]); // optional prop for back-compat

  // Simulation & compare
  const [simulationResults, setSimulationResults] = useState(null);
  const [activeInvestor, setActiveInvestor] = useState(null);
  const [compareIds, setCompareIds] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const navigate = useNavigate();

  // ---- FILTERS: align with Entrepreneur route (NOT investor sliders) ----
  // These keys match FilterPanel + transformFilters (industryFitWeight, etc.)
  const DEFAULT_FILTERS = {
    investorTypes: [],
    stagePreferences: [],
    industryPreferences: [],
    locationPreferences: [],
    locationPreference: "All",

    // Optional UI filters you may add later (server ignores for now):
    verifiedOnly: false,
    maxDecisionDays: 30,
    portfolioKeyword: "",
    preferMyCity: false,

    // Scoring helper for check-size fit (maps to ?raise_target_usd=)
    raiseTargetUsd: 0,

    // Entrepreneur weight sliders (sum doesn’t need to be 100; transform will normalize)
    industryFitWeight: 30,
    stageAlignmentWeight: 25,
    geoCoverageWeight: 15,
    checkSizeFitWeight: 20,
    decisionSpeedWeight: 5,
    verificationTrustWeight: 5,
    activityTrackRecordWeight: 0,
  };

  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  // View controls for matches list
  const [minScore, setMinScore] = useState(0);     // applied to server-side view_score (0..100)
  const [order, setOrder] = useState("desc");      // "desc" | "asc"

  // Debounce/derive transform payloads whenever filters change
  const tf = useMemo(() => transformFilters(filters), [filters]);
  // tf.weightsParam -> stringified JSON for ?weights=
  // tf.raiseTargetUsd -> number for ?raise_target_usd=

  const handleFilterChange = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    // Optionally persist to sessionStorage for shareable state across sessions:
    sessionStorage.setItem("entrepreneurMatchFilters", JSON.stringify({ ...filters, ...newFilters }));
  };

  // On "Simulate" click from a card
  const handleSimulate = (investor) => {
    setActiveInvestor(investor);
    setSimulationResults(investor.simulation ?? null);
  };

  // Compare selection (max 3)
  const toggleCompare = (investorId) => {
    setCompareIds((prev) =>
      prev.includes(investorId)
        ? prev.filter((id) => id !== investorId)
        : prev.length >= 3
        ? prev
        : [...prev, investorId]
    );
  };

  // Reset filters to defaults
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    sessionStorage.removeItem("entrepreneurMatchFilters");
  };

  // Restore filters from session (optional)
  useEffect(() => {
    const saved = sessionStorage.getItem("entrepreneurMatchFilters");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFilters((prev) => ({ ...prev, ...parsed }));
      } catch {}
    }
  }, []);

  // Fetch user + enterprise + events (mock/demo option kept)
  useEffect(() => {
    const HARDCODE_MODE = true; // set false when wiring to Supabase data fully

    const fetchData = async () => {
      try {
        if (HARDCODE_MODE) {
          setEntrepreneurName("Alex Rivera");
          setUserRole("entrepreneur");
          setAvatarUrl(defaultAvatar);

          setEnterprise({
            name: "NeoCart AI",
            industry: "Artificial Intelligence",
            stage: "Seed",
            location: "Guadalajara",
            team_size: 8,
            funding_needed: 350000,
            pitch_deck_url: "https://example.com/deck.pdf",
            financials: true,
            business_model: "SaaS",
          });

          setMessages([
            { sender: "Investor JP", preview: "Interested in your KPIs...", time: "10:14", read: false },
            { sender: "Ana (HRIC)", preview: "Event reminder for Thu", time: "09:21", read: true },
          ]);

          const upcoming = [
            {
              id: "evt_1",
              title: "HRIC Pitch Night",
              description: "3 startups, panel Q&A",
              date: new Date(Date.now() + 3 * 24 * 3600e3).toISOString(),
              agenda: ["Networking", "Pitches", "Q&A"],
              presenters: ["Panel A", "Panel B"],
              registration_status: null,
            },
            {
              id: "evt_2",
              title: "Investor Roundtable",
              description: "Sector: AI/Fintech",
              date: new Date(Date.now() + 10 * 24 * 3600e3).toISOString(),
              agenda: ["Roundtable", "Breakouts"],
              presenters: ["VC Group"],
              registration_status: "registered",
            },
          ];
          setEvents(upcoming);

          setNotifications([{ title: "You have a new investor match", time: "Just now", read: false }]);
          setLoading(false);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;
        const userId = session.user.id;

        const { data: user, error: userErr } = await supabase
          .from("user")
          .select("first_name, last_name, profile_image, email, role")
          .eq("id", userId)
          .single();
        if (userErr) throw userErr;

        setEntrepreneurName(`${user.first_name} ${user.last_name}`);
        setUserRole(user.role);

        const resolvedAvatarUrl =
          user.profile_image && user.profile_image.trim().length > 0
            ? supabase.storage.from("profile-images").getPublicUrl(user.profile_image).data?.publicUrl
            : defaultAvatar;
        setAvatarUrl(resolvedAvatarUrl);

        const { data: enterpriseData, error: enterpriseErr } = await supabase
          .from("enterprise")
          .select("*")
          .eq("user_id", userId)
          .single();
        if (enterpriseErr) throw enterpriseErr;
        setEnterprise(enterpriseData);

        const { data: msgData } = await supabase
          .from("message")
          .select("content, sender_id, created_at, is_read")
          .eq("recipient_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);
        const formattedMessages = (msgData || []).map((msg) => ({
          sender: `Sender ${String(msg.sender_id || "").slice(0, 6)}`,
          preview: msg.content.slice(0, 60),
          time: new Date(msg.created_at).toLocaleTimeString(),
          read: msg.is_read,
        }));
        setMessages(formattedMessages);

        const { data: eventsData, error: eventsErr } = await supabase
          .from("event")
          .select(
            `
              id,
              title,
              description,
              date,
              agenda,
              presenters,
              event_registration!left(user_id, registration_status)
            `
          )
          .gte("date", new Date().toISOString())
          .order("date", { ascending: true })
          .limit(20);
        if (eventsErr) throw eventsErr;

        const withStatus = (eventsData || []).map((e) => {
          const reg = (e.event_registration || []).find((r) => r.user_id === userId);
          return { ...e, registration_status: reg?.registration_status || null };
        });
        setEvents(withStatus);

        setNotifications([{ title: "You have a new investor match", time: "Just now", read: false }]);
      } catch (err) {
        console.error("Entrepreneur dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Profile completion calc
  const requiredFields = [
    "name",
    "industry",
    "stage",
    "location",
    "team_size",
    "funding_needed",
    "pitch_deck_url",
    "financials",
    "business_model",
  ];
  const totalFields = requiredFields.length;
  const filledFields = requiredFields.filter((field) => enterprise[field]);
  const completion = Math.round((filledFields.length / totalFields) * 100);

  const handleOpenRegister = (event) => {
    setSelectedEvent(event);
    setShowRegisterModal(true);
  };

  const missingSections = requiredFields
    .filter((field) => !enterprise[field])
    .map((field) => {
      switch (field) {
        case "pitch_deck_url":
          return "Pitch Deck";
        case "funding_needed":
          return "Funding Needs";
        default:
          return field.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
      }
    });

  const handleSubmitRegistration = async (answers) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("event_registration").insert({
        event_id: selectedEvent.id,
        user_id: user.id,
        answers, // JSONB
        registration_status: "registered",
      });
      if (error) throw error;

      setEvents((prev) =>
        prev.map((e) => (e.id === selectedEvent.id ? { ...e, registration_status: "registered" } : e))
      );
      setShowRegisterModal(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenChat = (msg) => {
    setOpenChats((prev) => {
      const alreadyOpen = prev.some((chat) => chat.sender === msg.sender);
      return alreadyOpen ? prev : [...prev, { sender: msg.sender, history: [msg] }];
    });
  };
  const handleCloseChat = (sender) => setOpenChats((prev) => prev.filter((chat) => chat.sender !== sender));

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
      <div id="dashboard-top">
        <HeaderBar
          entrepreneurName={entrepreneurName}
          notifications={notifications}
          profileImage={avatarUrl}
          messages={messages}
          onOpenChat={handleOpenChat}
        />
      </div>

      {/* Profile Completion */}
      <div id="profile-completion">
        <ProfileStatusCard
          completion={completion}
          missingSections={missingSections}
          onUpdateClick={() => navigate("/complete-profile/entrepreneur")}
        />
      </div>

      {/* NOTE:
          EntrepreneurTabs should forward the props
            - weightsParam
            - raiseTargetUsd
            - minScore
            - order
          to its internal MatchesDashboard component, which (in your adapted code)
          will call GET /matching/matches/entrepreneur with these query params.
      */}
      <EntrepreneurTabs
        selectedTab="matches"
        onTabChange={() => {}}
        // filters
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={resetFilters}
        // computed query params for matches
        weightsParam={tf.weightsParam}           // -> ?weights=<JSON>
        raiseTargetUsd={tf.raiseTargetUsd}       // -> ?raise_target_usd=<number>
        minScore={minScore}                      // -> ?min_score=
        order={order}                            // -> ?order=desc|asc
        // matches (optional back-compat; MatchesDashboard will fetch itself)
        matchedInvestors={matchedInvestors}
        activeInvestor={activeInvestor}
        compareIds={compareIds}
        onSimulate={handleSimulate}
        onToggleCompare={toggleCompare}
        simulationResults={simulationResults}
        // overview
        enterprise={enterprise}
        events={events}
        onRegisterClick={handleOpenRegister}
        registerModalOpen={showRegisterModal}
        onCloseRegisterModal={() => setShowRegisterModal(false)}
        selectedEvent={selectedEvent}
        onSubmitRegistration={handleSubmitRegistration}
        userRole={userRole}
        // messages
        messages={messages}
        onOpenChat={handleOpenChat}
        openChats={openChats}
        onCloseChat={handleCloseChat}
        // optional UI handlers to change score/order from a control bar you add later
        onChangeMinScore={setMinScore}
        onChangeOrder={setOrder}
      />

      {/* Events */}
      <div id="events">
        <RegisterModal
          open={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
          event={selectedEvent}
          role={userRole}
          onSubmit={handleSubmitRegistration}
        />
      </div>

      <ScrollToTopButton />
    </>
  );
}

export default EntrepreneurDashboard;