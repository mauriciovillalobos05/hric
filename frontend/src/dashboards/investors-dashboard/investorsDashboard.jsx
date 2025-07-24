import React, { useState, useEffect } from "react";
import HeaderBar from "./dashboard-components/components/headerBarComponents/headerBar.jsx";
import InvestorOverview from "./dashboard-components/components/investorOverview.jsx";
import MatchFeed from "./dashboard-components/components/matchComponents/matchFeed.jsx";
import InvestorTools from "./dashboard-components/components/investorTools.jsx";
import EventHighlight from "./dashboard-components/components/eventHighlight.jsx";
import MessagesPreview from "./dashboard-components/components/messagesComponents/messagesPreview.jsx";
import MessagesDock from "./dashboard-components/components/messagesComponents/messagesDock.jsx";
import PortfolioSummary from "./dashboard-components/components/portfolioSummary.jsx";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function InvestorsDashboard() {
  const [matches, setMatches] = useState([]);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [investorName, setInvestorName] = useState("Investor");
  const [openChats, setOpenChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // 1. Fetch user info (basic profile)
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) return;

        const userId = session.user.id;

        const { data: user, error: userError } = await supabase
          .from("user")
          .select("first_name, last_name, profile_image")
          .eq("id", userId)
          .single();

        if (userError) throw userError;

        setInvestorName(`${user.first_name} ${user.last_name}`);
        

        if (user.profile_image) {
          const { data: publicUrlData } = supabase.storage
            .from("profile-images") // Replace with your actual bucket name if different
            .getPublicUrl(user.profile_image);

          if (publicUrlData?.publicUrl) {
            setAvatarUrl(publicUrlData.publicUrl);
          } else {
            setAvatarUrl("./src/assets/default_user_image.png");
          }
        } else {
          setAvatarUrl("./src/assets/default_user_image.png");
        }

        // 2. Fetch matches for this investor
        const { data: matchData, error: matchError } = await supabase
          .from("match")
          .select(
            `
          id,
          compatibility_score,
          match_reasons,
          enterprise:enterprise_id (
            company_name,
            company_description,
            location,
            industry,
            funding_stage,
            profile_image,
            user_id,
            founded_date
          )
        `
          )
          .eq("investor_id", userId)
          .order("compatibility_score", { ascending: false });

        if (matchError) throw matchError;

        const formattedMatches = matchData.map((m) => ({
          founder: "Startup Team", // optional: fetch founders via join if needed
          company_name: m.enterprise.company_name,
          description: m.enterprise.company_description,
          location: m.enterprise.location,
          profile_image: m.enterprise.profile_image,
          match_score: m.compatibility_score,
          match_reasons: m.match_reasons ? m.match_reasons.split(",") : [],
          funding_stage: m.enterprise.funding_stage,
          industry: m.enterprise.industry,
        }));

        setMatches(formattedMatches);

        // 3. Fetch upcoming events
        const { data: eventsData, error: eventsError } = await supabase
          .from("event")
          .select("*")
          .gte("date", new Date().toISOString())
          .order("date", { ascending: true })
          .limit(5);

        if (eventsError) throw eventsError;

        setEvents(eventsData);

        // 4. Fetch recent messages (last 5 received)
        const { data: msgData, error: msgErr } = await supabase
          .from("message")
          .select("content, sender_id, created_at, is_read")
          .eq("recipient_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (msgErr) throw msgErr;

        const formattedMessages = msgData.map((msg) => ({
          sender: `Sender ${msg.sender_id.slice(0, 6)}`, // Simplified name
          preview: msg.content.slice(0, 60),
          time: new Date(msg.created_at).toLocaleTimeString(),
          read: msg.is_read,
        }));

        setMessages(formattedMessages);

        // 5. Placeholder notifications for now
        setNotifications([
          {
            title: "New matches available",
            time: "Just now",
            read: false,
          },
        ]);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    };

    fetchDashboardData();
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

  // Stock profile image for testing
  // const profileImage = "https://i.pravatar.cc/150?img=8"; // Placeholder image URL
  return (
    <>
      {/* greeting, notifications, avatar menu */}
      <HeaderBar
        investorName={investorName}
        notifications={notifications}
        profileImage={avatarUrl}
        messages={messages}
        onOpenChat={handleOpenChat}
      />

      {/* summary metrics (matches, portfolio, events) */}
      <InvestorOverview onMetricsLoaded={handleMetricsLoaded} />

      {/* summary of current holdings */}
      <PortfolioSummary />

      {/* prioritized list of startup matches */}
      <MatchFeed matches={testMatches} />

      {/* quick links to: 
      - search startups 
      - set preferences 
      - view saved startups */}
      <InvestorTools />

      {/* upcoming pitch events or invites */}
      <EventHighlight Events={sampleEvents} />

      {/* preview of unread messages */}
      <MessagesPreview
        messages={messages}
        onOpenChat={handleOpenChat} // pass down to child
      />

      {/* chat dock for ongoing conversations */}
      <MessagesDock openChats={openChats} onCloseChat={handleCloseChat} />

      {/* TO BE DONE IN A NEAR FUTURE */}
      {/* analytics & trends */}
      {/* <InsightsPanel />  */}
    </>
  );
}

export default InvestorsDashboard;
