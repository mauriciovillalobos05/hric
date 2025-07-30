import React, { useState, useEffect } from "react";
import HeaderBar from "./dashboard-components/components/headerBarComponents/headerBar.jsx";
import InvestorOverview from "./dashboard-components/components/investorOverview.jsx";
import MatchFeed from "./dashboard-components/components/matchComponents/matchFeed.jsx";
import InvestorTools from "./dashboard-components/components/investorTools.jsx";
import EventHighlight from "./dashboard-components/components/eventHighlight.jsx";
import MessagesPreview from "./dashboard-components/components/messagesComponents/messagesPreview.jsx";
import MessagesDock from "./dashboard-components/components/messagesComponents/messagesDock.jsx";
import PortfolioSummary from "./dashboard-components/components/portfolioSummary.jsx";
import { Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

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
  const [openChats, setOpenChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile, error: profileError } = await supabase
          .from("user")
          .select("first_name, last_name, profile_image")
          .eq("id", user.id)
          .single();

        if (profile && !profileError) {
          let profileImg = "/default_user_image.png";
          if (profile.profile_image) {
            const { data } = supabase.storage
              .from("profile-images")
              .getPublicUrl(profile.profile_image);
            profileImg = data?.publicUrl || profileImg;
          }
          setInvestorName(`${profile.first_name} ${profile.last_name}`);
          setAvatarUrl(profileImg);
        }

        const [
          { data: matchesData },
          { data: eventsData },
          { data: notificationsData },
          { data: messagesData },
        ] = await Promise.all([
          supabase.from("matches").select("*").eq("investor_id", user.id),
          supabase
            .from("events")
            .select("*")
            .order("date", { ascending: true }),
          supabase
            .from("notifications")
            .select("title, time, read")
            .eq("user_id", user.id)
            .order("time", { ascending: false }),
          supabase
            .from("messages")
            .select("sender, preview, time, read")
            .eq("receiver_id", user.id)
            .order("time", { ascending: false }),
        ]);

        setMatches(matchesData || []);
        setFilteredMatches(matchesData || []);
        setEvents(eventsData || []);
        setNotifications(notificationsData || []);
        setMessages(messagesData || []);
      } catch (error) {
        console.error("Dashboard data load failed:", error);
      } finally {
        setLoading(false); 
      }
    };

    fetchData();
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

      <InvestorOverview onMetricsLoaded={() => {}} />
      <PortfolioSummary />

      <MatchFeed matches={filteredMatches} />

      <InvestorTools
        onSearchClick={handleSearchClick}
        onPreferencesClick={() => alert("Preferences coming soon")}
        onSavedClick={() => alert("Watchlist coming soon")}
      />

      <EventHighlight Events={events} />

      <MessagesPreview messages={messages} onOpenChat={handleOpenChat} />
      <MessagesDock openChats={openChats} onCloseChat={handleCloseChat} />
    </>
  );
}

export default InvestorsDashboard;