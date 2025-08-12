// insightsPanel.jsx (trimmed)
import React, { useMemo, Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);
const Line = React.lazy(() =>
  import("react-chartjs-2").then((m) => ({ default: m.Line }))
);

export default function InsightsPanel({
  stats,
  timeseries,
  viewers,
  isPremium,
  onUpgrade,
}) {
  const chartData = useMemo(
    () => ({
      labels: timeseries?.map((d) => d.label) ?? [],
      datasets: [
        {
          label: "Profile Views",
          data: timeseries?.map((d) => d.value) ?? [],
          fill: true,
          tension: 0.3,
        },
      ],
    }),
    [timeseries]
  );

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };

  return (
    <section className="mx-auto max-w-7xl">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT: KPIs + Chart */}
        <div className="lg:col-span-2 space-y-4 bg-white rounded-lg shadow-sm p-4">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <KPI
              color="blue"
              label="Deck Views"
              value={stats?.deckViews ?? 0}
            />
            <KPI color="green" label="Messages" value={stats?.messages ?? 0} />
            <KPI
              color="purple"
              label="Favorites"
              value={stats?.favorites ?? 0}
            />
          </div>

          {/* Chart */}
          <div className="relative bg-gray-50 p-3 rounded-md h-80">
            {!isPremium && <PremiumGate onUpgrade={onUpgrade} />}
            <h3 className="text-xs font-semibold text-gray-700 mb-2">
              Weekly Engagement
            </h3>
            <Suspense
              fallback={
                <div className="h-full animate-pulse bg-gray-200 rounded" />
              }
            >
              <Line data={chartData} options={options} />
            </Suspense>
          </div>
        </div>
        {/* RIGHT: Viewers */}
        <div className="relative bg-white rounded-lg shadow-sm p-4">
          {!isPremium && <PremiumGate onUpgrade={onUpgrade} />}
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Recent Deck Viewers
          </h3>
          <ul className="space-y-2">
            {(viewers ?? []).slice(0, 6).map((v) => (
              <li
                key={v.id ?? v.name}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={v.image}
                    alt={v.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {v.name}
                    </p>
                    <p className="text-xs text-gray-500">{v.title}</p>
                  </div>
                </div>
                <button className="text-xs text-blue-600 hover:underline">
                  View
                </button>
              </li>
            ))}
            {!viewers?.length && (
              <div className="text-sm text-muted-foreground">
                No viewers yet
              </div>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

function KPI({ color, label, value }) {
  const bg = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
  }[color];
  return (
    <div className={`${bg?.split(" ")[0]} p-3 rounded-md`}>
      <p className={`text-2xl font-bold ${bg?.split(" ")[1]}`}>{value}</p>
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  );
}

function PremiumGate({ onUpgrade }) {
  return (
    <div className="pointer-events-none absolute inset-0 rounded-md bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
      {" "}
      <div className="text-center space-y-2">
        <p className="text-sm text-gray-700">Insights is a premium feature</p>
        <Button onClick={onUpgrade} className="px-4 pointer-events-auto">
          Upgrade to unlock
        </Button>
      </div>
    </div>
  );
}
