import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import HeaderBar from "./dashboard-components/components/headerBarComponents/headerBar.jsx";
import MessagesPreview from "./dashboard-components/components/messagesComponents/messagesPreview.jsx";
import MessagesDock from "./dashboard-components/components/messagesComponents/messagesDock.jsx";
import InvestorMatches from "./dashboard-components/components/matchComponents/investorMatches.jsx";
import PipelineSummary from "./dashboard-components/components/pipelineSummary.jsx";
import ProfileStatusCard from "./dashboard-components/components/profileStatusComponents/profileStatusCard.jsx";
import EventShowcaseAccess from "./dashboard-components/components/eventShowcaseComponents/eventShowcaseAccess.jsx";
import DocumentStatus from "./dashboard-components/components/documentStatus.jsx";
import InsightsPanel from "./dashboard-components/components/insightsPanel.jsx";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function EntrepreneurDashboard() {
  const [entrepreneurName, setEntrepreneurName] = useState("Founder");
  const [avatarUrl, setAvatarUrl] = useState("");
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

  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) return;
        const userId = session.user.id;

        // Fetch user details
        const { data: user, error: userErr } = await supabase
          .from("user")
          .select("first_name, last_name, profile_image")
          .eq("id", userId)
          .single();

        if (userErr) throw userErr;

        setEntrepreneurName(`${user.first_name} ${user.last_name}`);

        if (user.profile_image) {
          const { data: publicUrlData } = supabase.storage
            .from("profile-images")
            .getPublicUrl(user.profile_image);

          setAvatarUrl(
            publicUrlData?.publicUrl || "./src/assets/default_user_image.png"
          );
        } else {
          setAvatarUrl("./src/assets/default_user_image.png");
        }

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

        // Fetch investor matches
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
        const { data: eventsData } = await supabase
          .from("event")
          .select("*")
          .gte("date", new Date().toISOString())
          .order("date", { ascending: true })
          .limit(5);

        setEvents(eventsData || []);

        // Placeholder notifications
        setNotifications([
          {
            title: "You have a new investor match",
            time: "Just now",
            read: false,
          },
        ]);

        // Static pipeline data (replace with real queries if available)
        setPipelineData({
          contacted: 3,
          interested: 2,
          scheduled: 1,
          diligence: 0,
          termSheet: 0,
        });
      } catch (err) {
        console.error("Entrepreneur dashboard fetch error:", err);
      }
    };

    fetchData();
  }, []);

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

  // MOCK DATA FOR MATEO
  const formattedMessages = [
    {
      sender: "Sender user_0",
      preview: "This is a test message from user_0.",
      time: "9:06 PM",
      read: false,
    },
    {
      sender: "Sender user_1",
      preview: "This is a test message from user_1.",
      time: "6:06 PM",
      read: true,
    },
    {
      sender: "Sender user_2",
      preview: "This is a test message from user_2.",
      time: "3:06 PM",
      read: false,
    },
  ];

  const formattedMatches = [
    {
      founder: "InvestorCo 0",
      company_name: "InvestorCo 0",
      description: "Invests in Fintech",
      location: "San Francisco, CA",
      profile_image: "https://i.pravatar.cc/150?img=10",
      match_score: 94,
      match_reasons: ["Industry match", "Stage fit"],
      funding_stage: "Seed",
      industry: "Fintech",
    },
    {
      founder: "InvestorCo 1",
      company_name: "InvestorCo 1",
      description: "Invests in Fintech",
      location: "San Francisco, CA",
      profile_image: "https://i.pravatar.cc/150?img=11",
      match_score: 77,
      match_reasons: ["Industry match", "Stage fit"],
      funding_stage: "Seed",
      industry: "Fintech",
    },
  ];

  const mockEvents = [
    {
      title: "Pitch Event 0",
      date: "2025-07-24T21:06:33Z",
      type: "Pitch Showcase",
      registration_status: "not_registered",
    },
    {
      title: "Pitch Event 1",
      date: "2025-07-29T21:06:33Z",
      type: "Pitch Showcase",
      registration_status: "registered",
    },
  ];

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
        completion={60}
        missingSections={["Company Pitch", "Financials", "Team Info"]}
        onUpdateClick={() => navigate("/dashboard/user")}
      />

      <InvestorMatches matches={formattedMatches} onToggleFavorite={() => {}} />

      <EventShowcaseAccess events={mockEvents} />

      <DocumentStatus initialDocuments={[]} />

      <MessagesPreview messages={formattedMessages} onOpenChat={handleOpenChat} />

      <MessagesDock openChats={openChats} onCloseChat={handleCloseChat} />

      {/* TO BE DONE IN A NEAR FUTURE */}
      {/* analytics & trends */}
      <InsightsPanel />
    </>
  );
}

export default EntrepreneurDashboard;
