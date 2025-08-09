import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import ScrollToTopButton from "@/components/scrollToTopButton.jsx";
import defaultAvatar from "../../assets/default_user_image.png";

// Matching algorithm
import { StartupMatcher } from "./dashboard-components/components/matchComponents/components/algorithms/matchingAlgorithm.js"; // Import the matching algorithm

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
  const [matches, setMatches] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedStartups, setSelectedStartups] = useState([]);

  // Simulation results state
  const [simulationResults, setSimulationResults] = useState(null);

  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const navigate = useNavigate();

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
        const formattedMatches = [
          {
            founder: "Mock Capital",
            startup_name: "Mock Capital",
            description: "Invests in AI and SaaS",
            location: "San Francisco, CA",
            profile_image: null,
            match_score: 88,
            match_reasons: [
              "Aligned industry",
              "Strong traction",
              "Good team fit",
            ],
            funding_stage: "Seed",
            industry: "Technology",

            // Correct attributes for algorithm
            fundingSeeking: 2000000,
            percent_technical_founders: 80,
            percent_previous_exits: 20,
            revenue_scalar: 0.8, // (normalized value between 0–1)
            number_of_employees: 30,
            currently_raising: true,
            roi_category: "High",

            // Optional display fields for card
            monthly_revenue: 50000,
            valuation: 20000000,
            current_investors: ["Accel", "Sequoia"],
          },
          {
            founder: "SeedSpark",
            startup_name: "SeedSpark",
            description: "Invests in early-stage consumer startups",
            location: "New York, NY",
            profile_image: null,
            match_score: 72,
            match_reasons: ["Geographic alignment", "Early-stage focus"],
            funding_stage: "Pre-Seed",
            industry: "Consumer",

            fundingSeeking: 1500000,
            percent_technical_founders: 60,
            percent_previous_exits: 0,
            revenue_scalar: 0.3,
            number_of_employees: 10,
            currently_raising: false,
            roi_category: "Medium",

            monthly_revenue: 10000,
            valuation: 5000000,
            current_investors: ["First Round"],
          },
        ];
        
        // Set matches state
        setMatches(formattedMatches);
        if (formattedMatches.length > 0) {
          setSelectedStartups([formattedMatches[0]]);
        }

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

  //
  // Example matcher function
  //
  const matcher = new StartupMatcher();

  const runSimulation = (startup) => {
    const filters = {
      roiWeight: 25,
      technicalFoundersWeight: 20,
      previousExitsWeight: 15,
      revenueWeight: 20,
      teamSizeWeight: 10,
      currentlyRaisingWeight: 10,
      stagePreference: "All",
      locationPreference: "All",
      industryPreference: "All",
    };
    return matcher.runMonteCarloSimulation(startup, filters);
  };

  useEffect(() => {
    if (selectedStartups.length > 0) {
      const result = runSimulation(selectedStartups[0]);
      setSimulationResults(result);
    } else {
      setSimulationResults(null);
    }
  }, [selectedStartups]);

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
      <div id="matches">
        <MatchesDashboard
          matchedStartups={matches}
          selectedStartups={selectedStartups}
          onStartupSelect={(startup) => setSelectedStartups([startup])}
          simulationResults={simulationResults} // optionally add if available
        />
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
