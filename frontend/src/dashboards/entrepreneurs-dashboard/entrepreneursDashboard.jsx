import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button.jsx";
import HeaderBar from "./dashboard-components/components/headerBarComponents/headerBar.jsx";
import DashboardShortcuts from "./dashboard-components/components/directAccessButtons/DashboardShortcuts.jsx";
import MessagesPreview from "./dashboard-components/components/messagesComponents/messagesPreview.jsx";
import MessagesDock from "./dashboard-components/components/messagesComponents/messagesDock.jsx";
import MatchesDashboard from "./dashboard-components/components/matchComponents/matchesDashboard.jsx";
import ProfileStatusCard from "./dashboard-components/components/profileStatusComponents/profileStatusCard.jsx";
import EventList from "../../pages/eventShowcaseComponents/eventShowcaseAccess.jsx";
import RegisterModal from "../../pages/eventShowcaseComponents/registerModal.jsx";
import DocumentStatus from "./dashboard-components/components/documentStatus.jsx";
import InsightsPanel from "./dashboard-components/components/insightsPanel.jsx";
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

  const navigate = useNavigate();

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    // Optional: run matching logic here based on updated filters
  };

  //
  // Example matcher function
  //

  useEffect(() => {
    const matcher = new InvestorMatcher();
    const simFilters = transformFilters(filters);

    const filteredAndScored = mockMatches
      .filter((inv) => {
        const matchesStage =
          filters.stagePreference === "All" ||
          inv.stage.includes(filters.stagePreference);
        const matchesIndustry =
          filters.industryPreference === "All" ||
          inv.industries.includes(filters.industryPreference);
        const matchesLocation =
          filters.locationPreference === "All" ||
          inv.location.includes(filters.locationPreference);
        return matchesStage && matchesIndustry && matchesLocation;
      })
      .map((investor) => {
        const sim = matcher.runMonteCarloSimulation(investor, simFilters);
        return {
          ...investor,
          matchScore: sim.mean, // or baseScore if you want the raw weighted average
          simulation: sim,
        };
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
  const resetFilters = () => {
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
  };

  // Fetch user, enterprise, messages, matches, events on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
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

      {/* Shortcut navigation */}
      <div className="px-6 mt-4">
        <DashboardShortcuts />
      </div>

      {/* Profile Completion */}
      <div id="profile-completion">
        <ProfileStatusCard
          completion={completion}
          missingSections={missingSections}
          onUpdateClick={() => navigate("/complete-profile/entrepreneur")}
        />
      </div>

      {/* Matches */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT: Filter Panel */}
        <div className="w-full lg:w-1/4 space-y-4 sticky top-6">
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

        {/* RIGHT: Dashboard */}
        <div className="w-full lg:w-3/4">
          <MatchesDashboard
            matchedInvestors={matchedInvestors}
            selectedInvestors={selectedInvestors}
            onInvestorSelect={handleInvestorSelect}
            simulationResults={simulationResults}
          />
        </div>
      </div>

      {/* Events */}
      <div id="events">
        <EventList
          events={events}
          role={userRole}
          onRegisterClick={handleOpenRegister}
        />
        <RegisterModal
          open={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
          event={selectedEvent}
          role={userRole}
          onSubmit={handleSubmitRegistration}
        />
      </div>

      {/* Documents */}
      <div id="documents">
        <DocumentStatus />
      </div>

      {/* Messages */}
      <div id="messages">
        <MessagesPreview messages={messages} onOpenChat={handleOpenChat} />
        <MessagesDock openChats={openChats} onCloseChat={handleCloseChat} />
      </div>

      {/* Insights */}
      <div id="insights">
        <InsightsPanel role={userRole} />
      </div>

      <ScrollToTopButton />
    </>
  );
}

export default EntrepreneurDashboard;