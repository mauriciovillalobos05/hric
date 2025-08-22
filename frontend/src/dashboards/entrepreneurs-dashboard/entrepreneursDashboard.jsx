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
  const [minScore, setMinScore] = useState(0); // applied to server-side view_score (0..100)
  const [order, setOrder] = useState("desc"); // "desc" | "asc"

  // Debounce/derive transform payloads whenever filters change
  const tf = useMemo(() => transformFilters(filters), [filters]);
  // tf.weightsParam -> stringified JSON for ?weights=
  // tf.raiseTargetUsd -> number for ?raise_target_usd=

  const handleFilterChange = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    // Optionally persist to sessionStorage for shareable state across sessions:
    sessionStorage.setItem(
      "entrepreneurMatchFilters",
      JSON.stringify({ ...filters, ...newFilters })
    );
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
    const HARDCODE_MODE = false; // set false when wiring to Supabase data fully

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
            {
              sender: "Investor JP",
              preview: "Interested in your KPIs...",
              time: "10:14",
              read: false,
            },
            {
              sender: "Ana (HRIC)",
              preview: "Event reminder for Thu",
              time: "09:21",
              read: true,
            },
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

          setNotifications([
            {
              title: "You have a new investor match",
              time: "Just now",
              read: false,
            },
          ]);
          setLoading(false);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;
        const userId = session.user.id;

        const { data: userRow, error: userErr } = await supabase
          .from("users")
          .select("first_name,last_name,profile_image_url,email")
          .eq("id", userId)
          .single();
        if (userErr) throw userErr;

        setEntrepreneurName(`${userRow.first_name} ${userRow.last_name}`);

        const resolvedAvatarUrl = userRow.profile_image_url
          ? supabase.storage
              .from("profile-images")
              .getPublicUrl(userRow.profile_image_url).data?.publicUrl
          : null; // set null so you don’t render an empty src
        setAvatarUrl(resolvedAvatarUrl || defaultAvatar);

        const { data: memberships, error: mErr } = await supabase
          .from("enterprise_user")
          .select(
            `
    role,
    is_active,
    enterprise:enterprise_id (
      id, name, enterprise_type, location, website, description, logo_url, status
    )
  `
          )
          .eq("user_id", userId);
        if (mErr) throw mErr;

        const owner = (memberships || []).find(
          (m) => m.role === "owner" && m.is_active
        );
        const enterprise = owner?.enterprise || null;

        const { data: sp } = await supabase
          .from("startup_profile")
          .select(
            `
    business_model,
    revenue_model,
    team_size,
    current_revenue,
    monthly_growth_rate,
    customer_count,
    market_size,
    addressable_market,
    mrr_usd,
    arr_usd,
    current_valuation_usd,
    competitive_advantages,
    current_investors,
    technical_founders_pct,
    previous_exits_pct,
    traction_metrics
  `
          )
          .eq("enterprise_id", enterprise.id)
          .single();

        // fetch enterprise_profile for tags
        const { data: ep } = await supabase
          .from("enterprise_profile")
          .select("headline_tags")
          .eq("enterprise_id", enterprise.id)
          .single();

        const tm = sp?.traction_metrics || {};
        const enterpriseForUI = {
          ...(enterprise || {}),
          ...(sp || {}),
          // flatten traction_metrics to top-level so ProfileStatusCard can read them
          industry: tm.industry || null,
          stage: tm.stage || null,
          pitch_deck_url: tm.pitch_deck_url || null,
          funding_needed: tm.funding_needed ?? null,
          demo_url: tm.demo_url || null,
          headline_tags: ep?.headline_tags || [], // from enterprise_profile
        };

        setEnterprise(enterpriseForUI);

        const enterpriseType = enterprise?.enterprise_type;
        setUserRole(enterpriseType === "investor" ? "investor" : "startup");

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
            "id,title,description,start_time,agenda,speakers,status,location"
          )
          .gte("start_time", new Date().toISOString())
          .order("start_time", { ascending: true })
          .limit(20);
        if (eventsErr) throw eventsErr;

        setEvents(
          (eventsData || []).map((e) => ({ ...e, registration_status: null }))
        );

        setNotifications([
          {
            title: "You have a new investor match",
            time: "Just now",
            read: false,
          },
        ]);
      } catch (err) {
        console.error("Entrepreneur dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- REQUIRED for profile to unlock (tier 1) ---
  const REQUIRED = [
    "name",
    "industry",
    "stage",
    "location",
    "team_size",
    "funding_needed",
    "pitch_deck_url",
    "business_model",
  ];

  // --- NICE TO HAVE (shows as “missing” but not required to unlock) ---
  const OPTIONAL = [
    "revenue_model",
    "current_revenue",
    "customer_count",
    "mrr_usd",
    "arr_usd",
    "market_size",
    "addressable_market",
    "current_valuation_usd",
    "headline_tags",
    "competitive_advantages",
    "demo_url",
  ];

  const isFilled = (val) => {
    if (val === 0) return true; // 0 is valid
    if (val == null) return false;
    if (typeof val === "string") return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object") return Object.keys(val).length > 0;
    return Boolean(val);
  };

  const LABELS = {
    name: "Name",
    industry: "Industry",
    stage: "Stage",
    location: "Location",
    team_size: "Team Size",
    funding_needed: "Funding Needs",
    pitch_deck_url: "Pitch Deck",
    business_model: "Business Model",
    revenue_model: "Revenue Model",
    current_revenue: "Current Revenue",
    customer_count: "Customer Count",
    mrr_usd: "MRR (USD)",
    arr_usd: "ARR (USD)",
    market_size: "Market Size (USD)",
    addressable_market: "Addressable Market (USD)",
    current_valuation_usd: "Current Valuation (USD)",
    headline_tags: "Headline Tags",
    competitive_advantages: "Competitive Advantages",
    demo_url: "Demo URL",
  };

  const missingRequired = REQUIRED.filter(
    (k) => !isFilled(enterprise?.[k])
  ).map((k) => LABELS[k] || k);
  const missingOptional = OPTIONAL.filter(
    (k) => !isFilled(enterprise?.[k])
  ).map((k) => LABELS[k] || k);

  // % complete is based only on REQUIRED
  const completion = Math.round(
    ((REQUIRED.length - missingRequired.length) / REQUIRED.length) * 100
  );

  // Gate matches until ≥ 90%
  const isLocked = completion < 90;

  const handleOpenRegister = (event) => {
    setSelectedEvent(event);
    setShowRegisterModal(true);
  };

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
        prev.map((e) =>
          e.id === selectedEvent.id
            ? { ...e, registration_status: "registered" }
            : e
        )
      );
      setShowRegisterModal(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenChat = (msg) => {
    setOpenChats((prev) => {
      const alreadyOpen = prev.some((chat) => chat.sender === msg.sender);
      return alreadyOpen
        ? prev
        : [...prev, { sender: msg.sender, history: [msg] }];
    });
  };
  const handleCloseChat = (sender) =>
    setOpenChats((prev) => prev.filter((chat) => chat.sender !== sender));

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

      <div id="profile-completion" className="mb-6">
        <ProfileStatusCard
          completion={completion}
          missingRequired={missingRequired}
          missingOptional={missingOptional}
          onUpdateClick={() => navigate("/complete-profile/entrepreneur")}
        />
        {/* Nice-to-have list badge strip (optional visual) */}
        {missingOptional.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-gray-600 mb-1">
              Nice to have:
            </p>
            <div className="flex flex-wrap gap-2">
              {missingOptional.map((m) => (
                <span
                  key={`opt-${m}`}
                  className="px-2 py-1 text-xs rounded-full border bg-white"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
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
      {/* Matches area with lock until profile completion >= 90% */}
      <div className="relative">
        <div className={isLocked ? "pointer-events-none opacity-40" : ""}>
          <EntrepreneurTabs
            selectedTab="matches"
            onTabChange={() => {}}
            // filters
            filters={filters}
            onFilterChange={handleFilterChange}
            onResetFilters={resetFilters}
            // computed query params for matches
            weightsParam={tf.weightsParam}
            raiseTargetUsd={tf.raiseTargetUsd}
            minScore={minScore}
            order={order}
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
            // score/order handlers
            onChangeMinScore={setMinScore}
            onChangeOrder={setOrder}
          />
        </div>

        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm">
            <div className="rounded-xl bg-white p-4 shadow border text-center max-w-sm">
              <p className="font-medium mb-2">
                Finish your startup profile to unlock the dashboard
              </p>
              <p className="text-sm text-gray-600 mb-3">
                Missing: {missingRequired.join(", ")}
              </p>
              <button
                onClick={() => navigate("/complete-profile/entrepreneur")}
                className="px-4 py-2 rounded-md bg-black text-white"
              >
                Complete profile
              </button>
            </div>
          </div>
        )}
      </div>

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
