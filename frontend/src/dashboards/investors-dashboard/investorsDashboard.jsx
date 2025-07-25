import React, { useState, useEffect } from "react";
import HeaderBar from "./dashboard-components/components/headerBarComponents/headerBar.jsx";
import InvestorOverview from "./dashboard-components/components/investorOverview.jsx";
import MatchFeed from "./dashboard-components/components/matchComponents/matchFeed.jsx";
import InvestorTools from "./dashboard-components/components/investorTools.jsx";
import EventHighlight from "./dashboard-components/components/eventHighlight.jsx";
import MessagesPreview from "./dashboard-components/components/messagesComponents/messagesPreview.jsx";
import MessagesDock from "./dashboard-components/components/messagesComponents/messagesDock.jsx";
import PortfolioSummary from "./dashboard-components/components/portfolioSummary.jsx";

function InvestorsDashboard() {
  const [matches, setMatches] = useState([]);
  const [filteredMatches, setFilteredMatches] = useState([]);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [investorName, setInvestorName] = useState("Investor");
  const [openChats, setOpenChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    const profile = JSON.parse(sessionStorage.getItem("profile"));
    if (profile) {
      setInvestorName(`${profile.first_name} ${profile.last_name}`);
      setAvatarUrl(profile.profile_image || "./default-profile.png");
    } else {
      setInvestorName("Investor");
      setAvatarUrl("./default-profile.png");
    }

    setMatches(testMatches);
    setFilteredMatches(testMatches);
    setEvents(sampleEvents);
    setMessages([
      {
        sender: "Mateo",
        preview: "Let's connect about the event...",
        time: "2h ago",
        read: false,
      },
      {
        sender: "Alice (Startup X)",
        preview: "Thanks for your interest!",
        time: "1d ago",
        read: true,
      },
    ]);
    setNotifications(testNotifications);
  }, []);

  const handleSearchClick = ({ industry, stage }) => {
    const filtered = matches.filter((match) => {
      const matchesIndustry = industry
        ? match.industry.toLowerCase().includes(industry.toLowerCase())
        : true;
      const matchesStage = stage
        ? match.funding_stage.toLowerCase().includes(stage.toLowerCase())
        : true;
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

  const testNotifications = [
    { title: "New startup match: GreenTech AI", time: "2 hours ago", read: false },
    { title: "You have an upcoming pitch event", time: "1 day ago", read: true },
    { title: "Investor Insights Weekly Report is ready", time: "3 days ago", read: true },
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
    { id: 1, title: "AI Startup Pitch Night", type: "showcase", date: "2025-08-10T18:00:00Z", location: "San Francisco, CA", registration_status: "approved" },
    { id: 2, title: "Monthly Investor Roundtable", type: "monthly_meeting", date: "2025-08-15T16:00:00Z", location: "Virtual", registration_status: null },
    { id: 3, title: "Biotech Startup Showcase", type: "showcase", date: "2025-08-25T14:00:00Z", location: "New York, NY", registration_status: "pending" },
  ];

  return (
    <>
      <HeaderBar
        investorName={investorName}
        notifications={notifications}
        profileImage={avatarUrl}
        messages={messages}
        onOpenChat={handleOpenChat}
      />

      <InvestorOverview onMetricsLoaded={() => {}} />
      <PortfolioSummary />

      {/* Updated to use filteredMatches */}
      <MatchFeed matches={filteredMatches} />

      <InvestorTools
        onSearchClick={handleSearchClick}
        onPreferencesClick={() => alert("Preferences coming soon")}
        onSavedClick={() => alert("Watchlist coming soon")}
      />

      <EventHighlight Events={sampleEvents} />

      <MessagesPreview messages={messages} onOpenChat={handleOpenChat} />
      <MessagesDock openChats={openChats} onCloseChat={handleCloseChat} />
    </>
  );
}

export default InvestorsDashboard;