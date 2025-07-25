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

function EntrepreneurDashboard() {
  const navigate = useNavigate();
  const [entrepreneurName, setEntrepreneurName] = useState("Founder");
  const [avatarUrl, setAvatarUrl] = useState("./default-profile.png");
  const [notifications, setNotifications] = useState([]);
  const [openChats, setOpenChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [matches, setMatches] = useState([]);
  const [events, setEvents] = useState([]);
  const [pipelineData, setPipelineData] = useState({
    contacted: 3,
    interested: 2,
    scheduled: 1,
    diligence: 0,
    termSheet: 0,
  });

  useEffect(() => {
    // Get profile and plan from sessionStorage
    const profile = JSON.parse(sessionStorage.getItem("profile"));
    const plan = sessionStorage.getItem("selected_plan");

    // Set name and avatar
    if (profile) {
      const firstName = profile.firstName || "Unnamed";
      const lastName = profile.lastName || "";
      setEntrepreneurName(`${firstName} ${lastName}`);
      setAvatarUrl(profile.profile_image || "./default-profile.png");
    }

    // Set mock messages
    setMessages([
      {
        sender: "Mateo",
        preview: "Hi! Ready to pitch next week?",
        time: "1h ago",
        read: false,
      },
      {
        sender: "Lucía (InvestorX)",
        preview: "Can we schedule a call this Friday?",
        time: "5h ago",
        read: true,
      },
    ]);

    // Set mock events
    setEvents([
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
    ]);

    // Set mock matches
    setMatches([
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
        description: "Invests in HealthTech",
        location: "Berlin, DE",
        profile_image: "https://i.pravatar.cc/150?img=11",
        match_score: 78,
        match_reasons: ["Geographic alignment"],
        funding_stage: "Series A",
        industry: "HealthTech",
      },
    ]);

    // Notification sample
    setNotifications([
      {
        title: "You have a new investor match!",
        time: "Just now",
        read: false,
      },
    ]);
  }, []);

  const handleOpenChat = (msg) => {
    setOpenChats((prev) => {
      const alreadyOpen = prev.some((chat) => chat.sender === msg.sender);
      return alreadyOpen ? prev : [...prev, { sender: msg.sender, history: [msg] }];
    });
  };

  const handleCloseChat = (sender) => {
    setOpenChats((prev) => prev.filter((chat) => chat.sender !== sender));
  };

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

      <InvestorMatches matches={matches} onToggleFavorite={() => {}} />

      <EventShowcaseAccess events={events} />

      <DocumentStatus initialDocuments={[]} />

      <MessagesPreview messages={messages} onOpenChat={handleOpenChat} />

      <MessagesDock openChats={openChats} onCloseChat={handleCloseChat} />

      <InsightsPanel />
    </>
  );
}

export default EntrepreneurDashboard;
