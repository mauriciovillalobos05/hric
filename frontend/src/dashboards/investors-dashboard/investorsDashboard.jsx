import React, { useState } from "react";
import HeaderBar from "./dashboard-components/components/headerBar.jsx";
import InvestorOverview from "./dashboard-components/components/investorOverview.jsx";
import MatchFeed from "./dashboard-components/components/matchComponents/matchFeed.jsx";
import InvestorTools from "./dashboard-components/components/investorTools.jsx";
import EventHighlight from "./dashboard-components/components/eventHighlight.jsx";
import MessagesPreview from "./dashboard-components/components/messagesComponents/messagesPreview.jsx";
import MessagesDock from "./dashboard-components/components/messagesComponents/messagesDock.jsx";
import PortfolioSummary from "./dashboard-components/components/portfolioSummary.jsx";

function InvestorsDashboard() {
  const [openChats, setOpenChats] = useState([]);
  const [messages, setMessages] = useState([]);

  const handleOpenChat = (msg) => {
    setOpenChats((prev) => {
      const alreadyOpen = prev.some((chat) => chat.sender === msg.sender);
      return alreadyOpen ? prev : [...prev, { sender: msg.sender, history: [msg] }];
    });
  };

  const handleCloseChat = (sender) => {
    setOpenChats((prev) => prev.filter((chat) => chat.sender !== sender));
  };

  const handleMetricsLoaded = () => {
    const mockMessages = [
      {
        sender: "Mateo",
        preview: "Let’s connect about the event...",
        time: "2h ago",
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

  const testNotifications = [
    {
      title: "New startup match: GreenTech AI",
      time: "2 hours ago",
      read: false,
    },
    {
      title: "You have an upcoming pitch event",
      time: "1 day ago",
      read: true,
    },
    {
      title: "Investor Insights Weekly Report is ready",
      time: "3 days ago",
      read: true,
    },
  ];

  const testMatches = [
    {
      founder: "Maria López",
      company_name: "GreenTech AI",
      description: "AI-powered grid optimization for LATAM utility companies.",
      location: "Guadalajara, MX",
      profile_image: "https://i.pravatar.cc/150?img=32",
      match_score: 92,
      match_reasons: ["Industry match", "Geographic focus", "Stage alignment"],
      funding_stage: "Seed",
      industry: "CleanTech",
    },
    {
      founder: "Carlos Rivera",
      company_name: "BioLogix",
      description: "Biotech SaaS platform for clinical trial automation.",
      location: "CDMX, MX",
      profile_image: "https://i.pravatar.cc/150?img=45",
      match_score: 88,
      match_reasons: ["Sector experience", "High alignment"],
      funding_stage: "Series A",
      industry: "HealthTech",
    },
  ];

  const sampleEvents = [
    {
      id: 1,
      title: "AI Startup Pitch Night",
      type: "showcase",
      date: "2025-08-10T18:00:00Z",
      location: "San Francisco, CA",
      registration_status: "approved",
    },
    {
      id: 2,
      title: "Monthly Investor Roundtable",
      type: "monthly_meeting",
      date: "2025-08-15T16:00:00Z",
      location: "Virtual",
      registration_status: null, // Not registered yet
    },
    {
      id: 3,
      title: "Biotech Startup Showcase",
      type: "showcase",
      date: "2025-08-25T14:00:00Z",
      location: "New York, NY",
      registration_status: "pending",
    },
  ];
  
  const profileImage = "https://i.pravatar.cc/150?img=8"; // Placeholder image URL
  return (
    <>
      {/* greeting, notifications, avatar menu */}
      <HeaderBar
        investorName={"Pedro"}
        notifications={testNotifications}
        profileImage={profileImage}
        messages={messages}
        onOpenChat={handleOpenChat}
      />

      {/* summary metrics (matches, portfolio, events) */}
      <InvestorOverview onMetricsLoaded={handleMetricsLoaded}/>

      {/* summary of current holdings */}
      <PortfolioSummary /> 

      {/* prioritized list of startup matches */}
      <MatchFeed matches={testMatches}/>

      {/* quick links to: 
      - search startups 
      - set preferences 
      - view saved startups */}
      <InvestorTools /> 

      {/* upcoming pitch events or invites */}
      <EventHighlight Events={sampleEvents}/> 

      {/* preview of unread messages */}
      <MessagesPreview
        messages={messages}
        onOpenChat={handleOpenChat} // pass down to child
      />

      {/* chat dock for ongoing conversations */}
      <MessagesDock 
        openChats={openChats}
        onCloseChat={handleCloseChat}
      />

      
      {/* TO BE DONE IN A NEAR FUTURE */}
      {/* analytics & trends */}
      {/* <InsightsPanel />  */}
    </>
  );
}

export default InvestorsDashboard;
