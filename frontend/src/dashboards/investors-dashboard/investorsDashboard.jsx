import React, { useState, useEffect, useRef } from "react";
import HeaderBar from "./dashboard-components/components/headerBarComponents/headerBar.jsx";
import { Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import defaultAvatar from "../../assets/default_user_image.png";
import InvestorTabs from "./dashboard-components/components/investorTabs.jsx";
import { makeApi } from "@/lib/apiClient.js";

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

  // keep token & userId handy for follow-up actions (e.g. event registration)
  const authRef = useRef({ token: null, userId: null });

  // ---------- Mappers from API -> UI ----------
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
      industry:
        it.startup?.profile?.industry?.name ||
        it.industry ||
        it.startup_industry ||
        "",
      funding_stage:
        it.startup?.profile?.stage?.name || it.stage || it.funding_stage || "",
      score: Number(it.overall_score ?? 0),
      badges: it.badges || [],
      _raw: it,
    }));

  const mapEvents = (items = [], userId) =>
    items.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      date: e.start_time || e.date, // your API might send start_time
      agenda: e.agenda || [],
      presenters: e.speakers || e.presenters || [],
      registration_status:
        e.registration?.status || e.registration_status || null,
      _raw: e,
    }));

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1) Auth via Supabase (we use its JWT for your API)
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          setLoading(false);
          return;
        }

        const token = session.access_token;
        const userId = session.user.id;
        authRef.current = { token, userId };
        const api = makeApi(token);
        const inboxRes = await api.messages(5);
        const inboxItems = Array.isArray(inboxRes?.items)
          ? inboxRes.items
          : Array.isArray(inboxRes?.messages)
          ? inboxRes.messages
          : Array.isArray(inboxRes)
          ? inboxRes
          : [];

        setInbox(mapMessages(inboxItems));

        const notifRes = await api.notifications(20);
        const notifItems = Array.isArray(notifRes?.items)
          ? notifRes.items
          : Array.isArray(notifRes?.messages)
          ? notifRes.messages
          : Array.isArray(notifRes)
          ? notifRes
          : [];

        setNotifications(mapMessages(notifItems));
        // 2) Load everything in parallel from your endpoints
        const [me, investorData, inbox, recs, upcoming, notifs] =
          await Promise.all([
            api.me(), // { first_name, last_name, profile_image_url, role, ... }
            api.investorMe(), // investor profile
            api.messages(5), // inbox preview
            api.matches({ limit: 50, mode: "investor" }), // recommendations
            api.events(20), // upcoming + registration status
            api.notifications(20).catch(() => []), // best-effort
          ]);

        if (cancelled) return;

        // 3) Apply to UI state
        const firstName = me?.first_name || "Investor";
        const lastName = me?.last_name || "";
        setInvestorName(
          me?.full_name || `${firstName}${lastName ? " " + lastName : ""}`
        );
        setUserRole(me?.role || me?.user_role || "");
        setAvatarUrl(me?.profile_image_url || defaultAvatar);
        setInvestor(investorData || null);

        const mMsgs = mapMessages(inbox);
        setMessages(mMsgs);

        const mMatches = mapMatches(recs?.matches || []);
        setMatches(mMatches);
        setFilteredMatches(mMatches);

        const mEvents = mapEvents(upcoming, userId);
        setEvents(mEvents);

        setNotifications(
          Array.isArray(notifs) && notifs.length
            ? notifs.map((n) => ({
                title: n.title || n.type || "Notification",
                time: new Date(
                  n.created_at || n.sent_at || Date.now()
                ).toLocaleString(),
                read: !!n.read_at,
                _raw: n,
              }))
            : []
        );
      } catch (err) {
        console.error("Investor dashboard fetch error (API):", err);

        // ---- Fallback demo events, like you had before ----
        const now = Date.now();
        const plusDays = (d) =>
          new Date(now + d * 24 * 60 * 60 * 1000).toISOString();
        setEvents([
          {
            id: "evt_demo_err_001",
            title: "Fallback Event",
            description: "Shown because event fetch failed.",
            date: plusDays(5),
            agenda: ["Intro", "Session"],
            presenters: ["TBD"],
            registration_status: null,
          },
          {
            id: "evt_demo_err_002",
            title: "Backup Pitch Night",
            description: "Backup list for local testing without a database.",
            date: plusDays(10),
            agenda: ["Welcome", "Pitches", "Networking"],
            presenters: ["Startup A", "Startup B"],
            registration_status: null,
          },
        ]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenRegister = (event) => {
    setSelectedEvent(event);
    setShowRegisterModal(true);
  };

  const handleSubmitRegistration = async (answers) => {
    try {
      const { token, userId } = authRef.current || {};
      if (!token || !userId) throw new Error("Not authenticated");
      const api = makeApi(token);

      await api.registerToEvent(selectedEvent.id, answers);

      setEvents((prev) =>
        prev.map((e) =>
          e.id === selectedEvent.id
            ? { ...e, registration_status: "registered" }
            : e
        )
      );
      setShowRegisterModal(false);
    } catch (e) {
      console.error("Event registration failed:", e);
    }
  };

  const handleSearchClick = ({ industry, stage }) => {
    const filtered = matches.filter((match) => {
      const matchesIndustry = industry
        ? String(match.industry || "")
            .toLowerCase()
            .includes(industry.toLowerCase())
        : true;
      const matchesStage = stage
        ? String(match.funding_stage || "")
            .toLowerCase()
            .includes(stage.toLowerCase())
        : true;
      return matchesIndustry && matchesStage;
    });
    setFilteredMatches(filtered);
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
        onSearchClick={handleSearchClick}
        selectedTab={selectedTab}
        onTabChange={(value) => setSelectedTab(value)}
        // Overview content
        events={events}
        userRole={userRole}
        onRegisterClick={handleOpenRegister}
        registerModalOpen={showRegisterModal}
        onCloseRegisterModal={() => setShowRegisterModal(false)}
        selectedEvent={selectedEvent}
        onSubmitRegistration={handleSubmitRegistration}
        onMetricsLoaded={() => {}}
        // Messages content
        messages={messages}
        onOpenChat={handleOpenChat}
        openChats={openChats}
        onCloseChat={handleCloseChat}
      />
    </>
  );
}

export default InvestorsDashboard;
