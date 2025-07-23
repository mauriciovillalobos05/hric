import React, { useEffect, useState } from "react";
import { Users, Briefcase, Calendar, Mail } from "lucide-react";

function InvestorOverview({ onMetricsLoaded }) {
  const [metrics, setMetrics] = useState({
    matches: 0,
    portfolioSize: 0,
    upcomingEvents: 0,
    unreadMessages: 0,
  });

  useEffect(() => {
    // Simulate fetching metrics
    const fetchMetrics = async () => {
      const mockMetrics = {
        matches: 8,
        portfolioSize: 4,
        upcomingEvents: 2,
        unreadMessages: 3,
      };
      setMetrics(mockMetrics);
      if (onMetricsLoaded) onMetricsLoaded(mockMetrics);
    };

    fetchMetrics();
  }, []);

  const cardStyle = "flex items-center space-x-4 bg-white shadow-sm p-4 rounded-lg border";

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
      <div className={cardStyle}>
        <Users className="h-6 w-6 text-blue-600" />
        <div>
          <p className="text-sm text-gray-500">Startup Matches</p>
          <p className="text-lg font-semibold text-gray-800">{metrics.matches}</p>
        </div>
      </div>

      <div className={cardStyle}>
        <Briefcase className="h-6 w-6 text-green-600" />
        <div>
          <p className="text-sm text-gray-500">Portfolio Size</p>
          <p className="text-lg font-semibold text-gray-800">{metrics.portfolioSize}</p>
        </div>
      </div>

      <div className={cardStyle}>
        <Calendar className="h-6 w-6 text-purple-600" />
        <div>
          <p className="text-sm text-gray-500">Upcoming Events</p>
          <p className="text-lg font-semibold text-gray-800">{metrics.upcomingEvents}</p>
        </div>
      </div>

      <div className={cardStyle}>
        <Mail className="h-6 w-6 text-red-600" />
        <div>
          <p className="text-sm text-gray-500">Unread Messages</p>
          <p className="text-lg font-semibold text-gray-800">{metrics.unreadMessages}</p>
        </div>
      </div>
    </section>
  );
}

export default InvestorOverview;
