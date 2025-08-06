import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import HeaderBar from "./dashboard-components/components/headerBarComponents/headerBar.jsx";
import MessagesPreview from "./dashboard-components/components/messagesComponents/messagesPreview.jsx";
import MessagesDock from "./dashboard-components/components/messagesComponents/messagesDock.jsx";
import InvestorMatches from "./dashboard-components/components/matchComponents/matchFeed.jsx";
import PipelineSummary from "./dashboard-components/components/pipelineSummary.jsx";
import ProfileStatusCard from "./dashboard-components/components/profileStatusComponents/profileStatusCard.jsx";
import EventList from "../../pages/eventShowcaseComponents/eventShowcaseAccess.jsx";
import RegisterModal from "../../pages/eventShowcaseComponents/registerModal.jsx";
import DocumentStatus from "./dashboard-components/components/documentStatus.jsx";
import InsightsPanel from "./dashboard-components/components/insightsPanel.jsx";
import { Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import defaultAvatar from "../../assets/default_user_image.png";

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
  const [pipelineData, setPipelineData] = useState({
    contacted: 0,
    interested: 0,
    scheduled: 0,
    diligence: 0,
    termSheet: 0,
  });
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

        const formattedMatches = (matchData || []).map((m) => ({
          founder: m.investor.company_name,
          company_name: m.investor.company_name,
          description: `Invests in ${m.investor.industry}`,
          location: m.investor.location,
          profile_image: m.investor.profile_image,
          match_score: m.compatibility_score,
          match_reasons: m.match_reasons ? m.match_reasons.split(",") : [],
          funding_stage: m.investor.funding_stage,
          industry: m.investor.industry,
        }));

        setMatches(formattedMatches);

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

        setPipelineData({
          contacted: 3,
          interested: 2,
          scheduled: 1,
          diligence: 0,
          termSheet: 0,
        });
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
      <HeaderBar
        entrepreneurName={entrepreneurName}
        notifications={notifications}
        profileImage={avatarUrl}
        messages={messages}
        onOpenChat={handleOpenChat}
      />
      <PipelineSummary data={pipelineData} />
      <ProfileStatusCard
        completion={completion}
        missingSections={missingSections}
        onUpdateClick={() => navigate("/complete-profile/entrepreneur")}
      />
      <InvestorMatches matches={matches} onToggleFavorite={() => {}} />
      <EventList
        events={events}
        role={userRole}
        onRegisterClick={handleOpenRegister}
      />
      <RegisterModal
        open={showRegisterModal}
        onClose={() => {
          setShowRegisterModal(false);
        }}
        event={selectedEvent}
        role={userRole}
        onSubmit={handleSubmitRegistration}
      />
      <DocumentStatus />
      <MessagesPreview messages={messages} onOpenChat={handleOpenChat} />
      <MessagesDock openChats={openChats} onCloseChat={handleCloseChat} />
      <InsightsPanel role={userRole} /> {/* Optional */}
    </>
  );
}

export default EntrepreneurDashboard;
