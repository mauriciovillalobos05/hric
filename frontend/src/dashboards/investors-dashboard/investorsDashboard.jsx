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
import { AuthBridge } from "@/helpers/authBridge.js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
const USE_SUPABASE = false;

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

  // ---- SESSION-FIRST HYDRATION ----
  useEffect(() => {
    (async () => {
      try {
        if (!USE_SUPABASE) {
          const user = AuthBridge.getSessionUser();

          const displayName =
            [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
            user.fullName?.trim() || // if you ever add it later
            user.investorProfile?.name?.trim() ||
            user.entrepreneurProfile?.name?.trim() ||
            AuthBridge.getCurrentEmail()?.split("@")[0] ||
            "Investor";

          setInvestorName(displayName);
          setUserRole((user.role || "investor").toLowerCase());
          setAvatarUrl(user.avatarUrl || defaultAvatar);
          setInvestor(user.investorProfile || {});

          // Leave demo chrome for a working UI
          setMessages([
            {
              sender: "Founder JP",
              preview: "Here’s our traction…",
              time: "10:05",
              read: false,
            },
            {
              sender: "HRIC",
              preview: "Showcase starts Thu",
              time: "09:12",
              read: true,
            },
          ]);
          setEvents([
            {
              id: "evt_invest_1",
              title: "Startup Showcase",
              description: "AI & Fintech pitches",
              date: new Date(Date.now() + 5 * 24 * 3600e3).toISOString(),
              agenda: ["Welcome", "Pitches", "Q&A"],
              presenters: ["Startup A", "Startup B"],
              registration_status: null,
            },
          ]);
          setNotifications([
            { title: "New startup match", time: "Just now", read: false },
          ]);

          // Optional: seed fake matches or leave empty until you wire real data
          setMatches([]);
          setFilteredMatches([]);
          return;
        }

        // ---- SUPABASE PATH (kept intact for future switch) ----
        const { data: sessionData } = await supabase.auth.getSession();
        const supaUser = sessionData?.session?.user;
        if (!supaUser) throw new Error("Not authenticated");
        const userId = supaUser.id;

        const { data: userRow } = await supabase
          .from("user")
          .select("first_name, last_name, profile_image, email, role")
          .eq("id", userId)
          .single();

        setInvestorName(`${userRow.first_name} ${userRow.last_name}`);
        setUserRole(userRow.role);
        const avatar = userRow.profile_image
          ? supabase.storage
              .from("profile-images")
              .getPublicUrl(userRow.profile_image).data?.publicUrl
          : defaultAvatar;
        setAvatarUrl(avatar);

        const { data: investorData } = await supabase
          .from("investor_profile")
          .select("*")
          .eq("user_id", userId)
          .single();
        setInvestor(investorData);

        const { data: msgData } = await supabase
          .from("message")
          .select("content, sender_id, created_at, is_read")
          .eq("recipient_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);
        setMessages(
          (msgData || []).map((m) => ({
            sender: `Sender ${m.sender_id.slice(0, 6)}`,
            preview: m.content.slice(0, 60),
            time: new Date(m.created_at).toLocaleTimeString(),
            read: m.is_read,
          }))
        );

        const { data: eventsData } = await supabase
          .from("event")
          .select(
            `
            id, title, description, date, agenda, presenters,
            event_registration!left(user_id, registration_status)
          `
          )
          .gte("date", new Date().toISOString())
          .order("date", { ascending: true })
          .limit(20);
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
            title: "You have a new startup match",
            time: "Just now",
            read: false,
          },
        ]);
      } catch (e) {
        console.warn("Investor session load fallback:", e?.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleOpenRegister = (event) => {
    setSelectedEvent(event);
    setShowRegisterModal(true);
  };

  const handleSubmitRegistration = async (answers) => {
    try {
      if (!USE_SUPABASE) {
        // Dev no-op: mark event as registered in local state
        setEvents((prev) =>
          prev.map((e) =>
            e.id === selectedEvent.id
              ? { ...e, registration_status: "registered" }
              : e
          )
        );
        setShowRegisterModal(false);
        return;
      }
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

  const handleSearchClick = ({ industry, stage }) => {
    const filtered = matches.filter((m) => {
      const iOk = industry
        ? (m.industry || "").toLowerCase().includes(industry.toLowerCase())
        : true;
      const sOk = stage
        ? (m.funding_stage || "").toLowerCase().includes(stage.toLowerCase())
        : true;
      return iOk && sOk;
    });
    setFilteredMatches(filtered);
  };

  const handleOpenChat = (msg) =>
    setOpenChats((prev) =>
      prev.some((c) => c.sender === msg.sender)
        ? prev
        : [...prev, { sender: msg.sender, history: [msg] }]
    );
  const handleCloseChat = (sender) =>
    setOpenChats((prev) => prev.filter((c) => c.sender !== sender));

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
