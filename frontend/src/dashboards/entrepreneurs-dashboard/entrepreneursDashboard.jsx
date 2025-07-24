import React from "react";
import { useState, useEffect } from "react";
import HeaderBar from "./dashboard-components/components/headerBar.jsx";
import MessagesPreview from "./dashboard-components/components/messagesComponents/messagesPreview.jsx";
import MessagesDock from "./dashboard-components/components/messagesComponents/messagesDock.jsx";
import InvestorMatches from "./dashboard-components/components/matchComponents/investorMatches.jsx";
import PipelineSummary from "./dashboard-components/components/pipelineSummary.jsx";

function EntrepreneurDashboard() {
  const [openChats, setOpenChats] = useState([]);
  const [messages, setMessages] = useState([]);

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

  const testNotifications = [
    {
      title: "New investor match: Angel Partners",
      time: "Just now",
      read: false,
    },
    {
      title: "Pitch event tomorrow at 4pm",
      time: "3h ago",
      read: false,
    },
    {
      title: "Investor Smith viewed your deck",
      time: "Yesterday",
      read: true,
    },
  ];

  const pipelineData = {
    contacted: 4,
    interested: 3,
    scheduled: 2,
    diligence: 1,
    termSheet: 0
  };

  const mockInvestorMatches = [
    {
      founder: "Jane Capital",
      company_name: "Capital Group Ventures",
      description: "Invests in early-stage health and fintech startups.",
      location: "New York, NY",
      profile_image: "https://i.pravatar.cc/150?img=12",
      match_score: 92,
      match_reasons: ["HealthTech", "Pre-seed fit", "Mentorship available"],
      funding_stage: "Pre-seed",
      industry: "HealthTech",
      isFavorite: false,
    },
    {
      founder: "Tom Bridges",
      company_name: "Bridge Equity",
      description: "Focused on scalable SaaS companies.",
      location: "San Francisco, CA",
      profile_image: "https://i.pravatar.cc/150?img=7",
      match_score: 85,
      match_reasons: ["SaaS focus", "Prior investment in similar space"],
      funding_stage: "Seed",
      industry: "SaaS",
      isFavorite: true,
    },
  ];

  const handleMetricsLoaded = () => {
    const mockMessages = [
      {
        sender: "Mateo (Investor)",
        preview: "Let's connect about the pitch session...",
        time: "2h ago",
        read: false,
      },
      {
        sender: "Sophia (VC Bridge Fund)",
        preview: "I liked your deck, can we talk Monday?",
        time: "6h ago",
        read: false,
      },
      {
        sender: "Alice (Startup X)",
        preview: "Thanks for your interest!",
        time: "1d ago",
        read: true,
      },
    ];
    setMessages(mockMessages);
  };

  useEffect(() => {
    handleMetricsLoaded();
  }, []);

  const profileImage = "https://i.pravatar.cc/150?img=7"; // Placeholder image URL
  return (
    <>
      {/* greeting, notifications, avatar menu */}
      <HeaderBar
        entrepreneurName={"Michael"}
        notifications={testNotifications}
        profileImage={profileImage}
        messages={messages}
        onOpenChat={handleOpenChat}
      />

      {/* show interest stages (contacted, scheduled, etc.) */}
      <PipelineSummary data={pipelineData} />

      {/* show completion %, CTA to update profile */}
      {/* <ProfileStatusCard /> */}

      {/* AI-generated investor cards */}
      <InvestorMatches
        matches={mockInvestorMatches}
        onToggleFavorite={(data) => console.log("Favorite toggled:", data)}
      />

      {/* pitch event CTA or registration card */}
      {/* <EventShowcaseAccess /> */}

      {/* uploaded docs & access log */}
      {/* <DocumentStatus /> */}

      {/* preview or open recent chats */}
      <MessagesPreview messages={messages} onOpenChat={handleOpenChat} />

      {/* chat dock for ongoing conversations */}
      <MessagesDock openChats={openChats} onCloseChat={handleCloseChat} />

      {/* THIS WILL BE A PREMIUM OPTION */}
      {/* who viewed, when, and how often */}
      {/* <EngagementAnalytics />  */}
    </>
  );
}

export default EntrepreneurDashboard;
