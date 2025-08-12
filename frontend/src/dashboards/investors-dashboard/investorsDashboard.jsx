// ...imports unchanged at the top except: remove direct imports of
// InvestorOverview, MatchFeed, InvestorTools, PortfolioSummary, EventList, RegisterModal,
// MessagesPreview, MessagesDock — those will now render inside InvestorTabs.

import React, { useState, useEffect } from "react";
import HeaderBar from "./dashboard-components/components/headerBarComponents/headerBar.jsx";
import { Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import defaultAvatar from "../../assets/default_user_image.png";
import InvestorTabs from "./dashboard-components/components/investorTabs.jsx";
import ScrollToTopButton from "@/components/scrollToTopButton.jsx";

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

  const [simulationResults, setSimulationResults] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
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
  
        setInvestorName(`${user.first_name} ${user.last_name}`);
        setUserRole(user.role);
  
        const resolvedAvatarUrl =
          user.profile_image && user.profile_image.trim().length > 0
            ? supabase.storage.from("profile-images").getPublicUrl(user.profile_image).data?.publicUrl
            : defaultAvatar;
        setAvatarUrl(resolvedAvatarUrl);
  
        const { data: investorData, error: investorErr } = await supabase
          .from("investor_profile")
          .select("*")
          .eq("user_id", userId)
          .single();
        if (investorErr) throw investorErr;
        setInvestor(investorData);
  
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
  
        const { data: matchData } = await supabase.from("match_recommendation").select("*");
        // TODO: map matchData into your UI shape if needed
        // setMatches(formattedMatches); setFilteredMatches(formattedMatches);
  
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
  
        const withStatus = (eventsData || []).map((e) => {
          const reg = (e.event_registration || []).find((r) => r.user_id === userId);
          return { ...e, registration_status: reg?.registration_status || null };
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
        console.error("Investor dashboard fetch error:", err);
  
        // ======================== DUMMY EVENTS: START (error fallback) ========================
        const now = Date.now();
        const plusDays = (d) => new Date(now + d * 24 * 60 * 60 * 1000).toISOString();
  
        setEvents([
          {
            // Supabase table columns
            id: "evt_demo_err_001",
            sponsors: ["Fallback Sponsor"],
            status: "scheduled",
            is_public: true,
            registration_required: false,
            created_by: "dev_user",
            updated_at: new Date().toISOString(),
  
            // UI fields used by EventList/RegisterModal
            title: "Fallback Event",
            description: "Shown because event fetch failed.",
            date: plusDays(5),
            agenda: ["Intro", "Session"],
            presenters: ["TBD"],
            registration_status: null,
          },
          {
            id: "evt_demo_err_002",
            sponsors: ["Tech Angels"],
            status: "scheduled",
            is_public: true,
            registration_required: true,
            created_by: "dev_user",
            updated_at: new Date().toISOString(),
  
            title: "Backup Pitch Night",
            description: "Backup list for local testing without a database.",
            date: plusDays(10),
            agenda: ["Welcome", "Pitches", "Networking"],
            presenters: ["Startup A", "Startup B"],
            registration_status: null,
          },
        ]);
        // ========================= DUMMY EVENTS: END (error fallback) =========================
      } finally {
        setLoading(false);
      }
    };
  
    fetchData();
  }, []);
  

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
        answers,
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

  const handleSearchClick = ({ industry, stage }) => {
    const filtered = matches.filter((match) => {
      const matchesIndustry = industry ? match.industry.toLowerCase().includes(industry.toLowerCase()) : true;
      const matchesStage = stage ? match.funding_stage.toLowerCase().includes(stage.toLowerCase()) : true;
      return matchesIndustry && matchesStage;
    });
    setFilteredMatches(filtered);
  };

  const handleOpenChat = (msg) => {
    setOpenChats((prev) => {
      const alreadyOpen = prev.some((chat) => chat.sender === msg.sender);
      return alreadyOpen ? prev : [...prev, { sender: msg.sender, history: [msg] }];
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
        investorName={investorName}
        notifications={notifications}
        profileImage={avatarUrl}
        messages={messages}
        onOpenChat={handleOpenChat}
      />
    </div>
      <InvestorTabs
        matches={matches}
        filteredMatches={filteredMatches}
        onSearchClick={handleSearchClick}
        selectedTab={selectedTab}
        onTabChange={(value) => setSelectedTab(value)}
        // Overview content (moved here)
        events={events}
        userRole={userRole}
        onRegisterClick={handleOpenRegister}
        registerModalOpen={showRegisterModal}
        onCloseRegisterModal={() => setShowRegisterModal(false)}
        selectedEvent={selectedEvent}
        onSubmitRegistration={handleSubmitRegistration}
        onMetricsLoaded={() => {}}
        // Messages content (moved here)
        messages={messages}
        onOpenChat={handleOpenChat}
        openChats={openChats}
        onCloseChat={handleCloseChat}
      />
      <ScrollToTopButton />
    </>
  );
}

export default InvestorsDashboard;
