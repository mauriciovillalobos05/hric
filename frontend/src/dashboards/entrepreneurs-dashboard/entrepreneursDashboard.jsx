import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button.jsx";
import HeaderBar from "./dashboard-components/components/headerBarComponents/headerBar.jsx";
import EntrepreneurTabs from "./dashboard-components/components/entrepreneurTabs.jsx";
import MessagesPreview from "./dashboard-components/components/messagesComponents/messagesPreview.jsx";
import MessagesDock from "./dashboard-components/components/messagesComponents/messagesDock.jsx";
import MatchesDashboard from "./dashboard-components/components/matchComponents/matchesDashboard.jsx";
import ProfileStatusCard from "./dashboard-components/components/profileStatusComponents/profileStatusCard.jsx";
import EventList from "../../pages/eventShowcaseComponents/eventShowcaseAccess.jsx";
import RegisterModal from "../../pages/eventShowcaseComponents/registerModal.jsx";
import DocumentStatus from "./dashboard-components/components/documentStatus.jsx";
import InsightsPanel from "./dashboard-components/components/insights/insightsPanel.jsx";
import FilterPanel from "./dashboard-components/components/matchComponents/components/FilterPanel/FilterPanel.jsx";
import { Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import ScrollToTopButton from "@/components/scrollToTopButton.jsx";
import defaultAvatar from "../../assets/default_user_image.png";
import transformFilters from "./dashboard-components/components/matchComponents/components/FilterPanel/transformFilters.jsx";

// Matching algorithm
import { InvestorMatcher } from "./dashboard-components/components/matchComponents/components/algorithms/matchingAlgorithm.js"; // Import the matching algorithm

// Mock matches
import mockMatches from "./dashboard-components/components/matchComponents/mockInvestors.js"; // Import mock matches if needed

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function EntrepreneurDashboard() {
  const [entrepreneurName, setEntrepreneurName] = useState("Founder");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [userRole, setUserRole] = useState(""); // optional: store user role
  const [enterprise, setEnterprise] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [openChats, setOpenChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [events, setEvents] = useState([]);

  // Matches state
  const [matchedInvestors, setMatchedInvestors] = useState([]);
  const [selectedInvestors, setSelectedInvestors] = useState([]);

  // Simulation results state
  const [simulationResults, setSimulationResults] = useState(null);

  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const DEFAULT_FILTERS = {
    // what FilterPanel already emits
    userType: "vc", // "vc" | "angel" | "corporate" | "any"
    stagePreference: "All",
    locationPreference: "All",
    industryPreference: "All",

    // extra hard filters you added
    checkMin: 0,
    checkMax: Number.POSITIVE_INFINITY,
    followOnMin: 0,
    boardSeat: "any", // any | willing | avoid
    syndication: "any", // any | lead | co-lead
    dealTimeMaxDays: 999,

    // sliders that transformFilters already expects
    roiWeight: 25,
    technicalFoundersWeight: 15,
    previousExitsWeight: 15,
    revenueWeight: 20,
    teamSizeWeight: 20,
    currentlyRaisingWeight: 10,
  };

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const navigate = useNavigate();
  const HARDCODE_MODE = true;
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    // Optional: run matching logic here based on updated filters
  };

  // Budget parsing function
  function parseCheckRange(str = "") {
    // "$5M - $50M" | "$250k–$1.5M" | "$10M" | "Undisclosed"
    if (!str || /undisclosed/i.test(str)) return [0, Infinity];
    // grab all numbers with optional decimals, k/m/b suffix
    const parts = [...str.matchAll(/(\d+(\.\d+)?)(\s*[kmb])?/gi)].map((m) => {
      const n = parseFloat(m[1]);
      const suf = (m[3] || "").trim().toLowerCase();
      const mult =
        suf === "k" ? 1e3 : suf === "m" ? 1e6 : suf === "b" ? 1e9 : 1;
      return n * mult;
    });
    if (parts.length === 1) return [parts[0], parts[0]];
    if (parts.length >= 2)
      return [Math.min(parts[0], parts[1]), Math.max(parts[0], parts[1])];
    return [0, Infinity];
  }

  // Average deal time parsing function
  function parseAvgDealTime(str = "") {
    // "3-6 months" | "45-90 days" | "8 weeks" | "3 months"
    if (!str) return 999;
    const range = [...str.matchAll(/(\d+(\.\d+)?)/g)].map((m) =>
      parseFloat(m[1])
    );
    const hasMonths = /month/i.test(str);
    const hasWeeks = /week/i.test(str);
    const hasDays = /day/i.test(str);

    const avg = range.length
      ? range.reduce((a, b) => a + b, 0) / range.length
      : 0;
    if (hasMonths) return Math.round(avg * 30);
    if (hasWeeks) return Math.round(avg * 7);
    if (hasDays) return Math.round(avg);
    return 999;
  }

  //
  // Example matcher function
  //

  useEffect(() => {
    const matcher = new InvestorMatcher();

    const filteredAndScored = mockMatches
      .filter((inv) => {
        const norm = (s) =>
          String(s || "")
            .toLowerCase()
            .trim();
        const mapType = (v) => {
          const x = norm(v);
          if (x === "vc") return "venture capital";
          if (x.startsWith("corporate")) return "corporate";
          return x; // angel, any, etc.
        };

        const stageOk =
          filters.stagePreference === "All" ||
          inv.stage?.some((s) => norm(s) === norm(filters.stagePreference));

        const industryOk =
          filters.industryPreference === "All" ||
          inv.industries?.some(
            (i) => norm(i) === norm(filters.industryPreference)
          );

        const geoOk =
          filters.locationPreference === "All" ||
          norm(inv.location).includes(norm(filters.locationPreference));

        const typeOk =
          filters.userType === "any" ||
          norm(inv.type).includes(mapType(filters.userType));

        const [min, max] = parseCheckRange(inv.checkSize); // "$5M - $50M" -> [5_000_000, 50_000_000]
        const checkOk = max >= filters.checkMin && min <= filters.checkMax;

        const followOk = (inv.followOnRate ?? 0) >= filters.followOnMin;

        const boardOk =
          filters.boardSeat === "any" ||
          (filters.boardSeat === "willing" &&
            /board/i.test(inv.boardSeats || "")) ||
          (filters.boardSeat === "avoid" &&
            !/board/i.test(inv.boardSeats || ""));

        const syndOk =
          filters.syndication === "any" ||
          inv.investmentBehavior?.syndicationPreference === filters.syndication;

        const avgDealDays = parseAvgDealTime(inv.avgDealTime); // "3-6 months" -> ~135–180d avg; pick mid
        const ddDays = inv.investmentBehavior?.dueDiligenceTime ?? avgDealDays;
        const timeOk = Math.min(avgDealDays, ddDays) <= filters.dealTimeMaxDays;

        return (
          stageOk &&
          industryOk &&
          geoOk &&
          typeOk &&
          checkOk &&
          followOk &&
          boardOk &&
          syndOk &&
          timeOk
        );
      })
      .map((investor) => {
        // transform weights into your sim input
        const sim = matcher.runMonteCarloSimulation(
          investor,
          transformFilters(filters)
        );
        return { ...investor, matchScore: sim.mean, simulation: sim };
      });

    setMatchedInvestors(filteredAndScored);
  }, [filters]);

  const handleInvestorSelect = (investor) => {
    setSelectedInvestors((prev) => {
      const isSelected = prev.some((i) => i.id === investor.id);
      const updated = isSelected
        ? prev.filter((i) => i.id !== investor.id)
        : [...prev, investor];

      if (!isSelected && updated.length === 1) {
        setSimulationResults(investor.simulation); // ✅ set it here!
      }

      return updated;
    });
  };

  // Reset filters to default
  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  // Fetch user, enterprise, messages, matches, events on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (HARDCODE_MODE) {
          // ---- Hardcoded demo data (no backend required) ----
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
              registration_status: null, // will turn "registered" after clicking the button
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
          return; // <-- IMPORTANT: skip the Supabase branch below
        }
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) return;
        const userId = session.user.id;

        // Updated user fetch with email and role
        const { data: user, error: userErr } = await supabase
          .from("user")
          .select("first_name, last_name, profile_image, email, role")
          .eq("id", userId)
          .single();

        if (userErr) throw userErr;

        setEntrepreneurName(`${user.first_name} ${user.last_name}`);
        setUserRole(user.role); // you can now use this for role-based logic

        const resolvedAvatarUrl =
          user.profile_image && user.profile_image.trim().length > 0
            ? supabase.storage
                .from("profile-images")
                .getPublicUrl(user.profile_image).data?.publicUrl
            : defaultAvatar;

        setAvatarUrl(resolvedAvatarUrl);

        // Fetch enterprise data
        const { data: enterpriseData, error: enterpriseErr } = await supabase
          .from("enterprise")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (enterpriseErr) throw enterpriseErr;

        setEnterprise(enterpriseData);

        // Fetch messages
        const { data: msgData } = await supabase
          .from("message")
          .select("content, sender_id, created_at, is_read")
          .eq("recipient_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);

        const formattedMessages = (msgData || []).map((msg) => ({
          sender: `Sender ${msg.sender_id.slice(0, 6)}`,
          preview: msg.content.slice(0, 60),
          time: new Date(msg.created_at).toLocaleTimeString(),
          read: msg.is_read,
        }));

        setMessages(formattedMessages);

        // Fetch matches
        const { data: matchData } = await supabase
          .from("match")
          .select(
            `
            id,
            compatibility_score,
            match_reasons,
            investor:investor_id (
              company_name,
              location,
              industry,
              funding_stage,
              profile_image
            )
          `
          )
          .eq("enterprise_id", userId)
          .order("compatibility_score", { ascending: false });

        // Format matches (UNLINED LATER)

        // const formattedMatches = (matchData || []).map((m) => ({
        //   founder: m.investor.company_name,
        //   company_name: m.investor.company_name,
        //   description: `Invests in ${m.investor.industry}`,
        //   location: m.investor.location,
        //   profile_image: m.investor.profile_image,
        //   match_score: m.compatibility_score,
        //   match_reasons: m.match_reasons ? m.match_reasons.split(",") : [],
        //   funding_stage: m.investor.funding_stage,
        //   industry: m.investor.industry,
        // }));

        // For now, use mock data

        // Set matches state

        // Fetch events
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
    event_registration!left(
      user_id,
      registration_status
    )
  `
          )
          .gte("date", new Date().toISOString())
          .order("date", { ascending: true })
          .limit(20);

        if (eventsErr) throw eventsErr;

        // attach this user's registration_status to each event row
        const withStatus = (eventsData || []).map((e) => {
          const reg = (e.event_registration || []).find(
            (r) => r.user_id === userId
          );
          return {
            ...e,
            registration_status: reg?.registration_status || null,
          };
        });

        setEvents(withStatus);

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
          return field
            .replace("_", " ")
            .replace(/\b\w/g, (l) => l.toUpperCase());
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
        answers, // JSONB (your dynamic form)
        registration_status: "registered",
      });

      if (error) throw error;

      // Optimistically update UI
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
      // optionally show a toast with e.message
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

  const handleCloseChat = (sender) => {
    setOpenChats((prev) => prev.filter((chat) => chat.sender !== sender));
  };

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

      <EntrepreneurTabs
        selectedTab="matches"
        onTabChange={() => {}}
        // filters
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={resetFilters}
        // matches
        matchedInvestors={matchedInvestors}
        selectedInvestors={selectedInvestors}
        onInvestorSelect={handleInvestorSelect}
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
        insightsProps={{
          isPremium: userRole === "entrepreneur_pro",
          onUpgrade: () => navigate("/billing"),
          stats: { deckViews: 32, messages: 12, favorites: 7 },
          timeseries: [
            { label: "Jul 1", value: 5 },
            { label: "Jul 8", value: 10 },
            { label: "Jul 15", value: 20 },
            { label: "Jul 22", value: 30 },
          ],
          viewers: matchedInvestors.slice(0, 3).map((m) => ({
            id: m.id,
            name: m.name,
            title: m.type,
            image: m.profile_image || defaultAvatar,
          })),
        }}
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
