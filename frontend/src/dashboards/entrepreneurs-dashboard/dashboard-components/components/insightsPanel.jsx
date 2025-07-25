import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

function InsightsPanel() {
  const [deckViews] = useState(32);
  const [messagesReceived] = useState(12);
  const [favoriteCount] = useState(7);
  const [plan, setPlan] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("selected_plan");
    if (stored) setPlan(stored.toLowerCase());
  }, []);

  const engagementData = {
    labels: ["Jul 1", "Jul 8", "Jul 15", "Jul 22"],
    datasets: [
      {
        label: "Profile Views",
        data: [5, 10, 20, 30],
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.2)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const viewers = [
    {
      name: "Elena Woods",
      title: "Angel Investor, SeedBright",
      image: "https://i.pravatar.cc/150?img=11",
    },
    {
      name: "Thomas Gray",
      title: "Partner, Bridge VC",
      image: "https://i.pravatar.cc/150?img=14",
    },
    {
      name: "Lina Perez",
      title: "Principal, Elevate Capital",
      image: "https://i.pravatar.cc/150?img=28",
    },
  ];

  return (
    <div className="bg-white rounded-md shadow-sm p-4 mt-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Investor Insights</h2>

      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
        <div className="bg-blue-50 p-3 rounded-md">
          <p className="text-2xl font-bold text-blue-600">{deckViews}</p>
          <p className="text-xs text-gray-600">Deck Views</p>
        </div>
        <div className="bg-green-50 p-3 rounded-md">
          <p className="text-2xl font-bold text-green-600">{messagesReceived}</p>
          <p className="text-xs text-gray-600">Messages</p>
        </div>
        <div className="bg-purple-50 p-3 rounded-md">
          <p className="text-2xl font-bold text-purple-600">{favoriteCount}</p>
          <p className="text-xs text-gray-600">Favorites</p>
        </div>
      </div>

      {plan === "enterprise" && (
        <div className="bg-gray-50 p-3 rounded-md mb-4">
          <h3 className="text-xs font-semibold text-gray-700 mb-2">Weekly Engagement</h3>
          <Line data={engagementData} options={{ plugins: { legend: { display: false } } }} />
        </div>
      )}

      {(plan === "premium" || plan === "enterprise") && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent Deck Viewers</h3>
          <ul className="space-y-2">
            {viewers.map((viewer, idx) => (
              <li key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                <div className="flex items-center gap-3">
                  <img
                    src={viewer.image}
                    alt={viewer.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{viewer.name}</p>
                    <p className="text-xs text-gray-500">{viewer.title}</p>
                  </div>
                </div>
                <button className="text-xs text-blue-600 hover:underline">View</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default InsightsPanel;