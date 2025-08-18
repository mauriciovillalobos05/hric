import React from 'react';
import { BarChart3, Heart, Users, Calendar } from 'lucide-react';

const MOCK_ANALYTICS = { totalRevenue: 14950, socialImpactFund: 598, ticketsSold: 72, averageFillRate: 24 };

const AnalyticsCards = () => {
  const tiles = [
    { label: 'Total Revenue', value: `$${MOCK_ANALYTICS.totalRevenue}`, icon: BarChart3 },
    { label: 'Social Impact Fund', value: `$${MOCK_ANALYTICS.socialImpactFund}`, icon: Heart },
    { label: 'Tickets Sold', value: MOCK_ANALYTICS.ticketsSold, icon: Users },
    { label: 'Avg Fill Rate', value: `${MOCK_ANALYTICS.averageFillRate}%`, icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">Event Analytics</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiles.map((t) => (
          <div key={t.label} className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p>{t.label}</p>
                <p className="text-2xl font-bold">{t.value}</p>
              </div>
              <t.icon className="w-8 h-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnalyticsCards;
