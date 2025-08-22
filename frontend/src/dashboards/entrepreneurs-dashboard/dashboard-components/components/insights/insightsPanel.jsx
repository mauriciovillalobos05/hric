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
  <div className="relative w-full min-h-[520px] flex items-center justify-center overflow-hidden rounded-2xl border bg-white">
    {/* soft gradient glow */}
    <div className="pointer-events-none absolute -inset-24 opacity-60 blur-2xl animate-pulse
                    bg-[radial-gradient(60rem_30rem_at_50%_-10%,theme(colors.blue.200),transparent),
                        radial-gradient(40rem_20rem_at_-10%_120%,theme(colors.purple.200),transparent),
                        radial-gradient(40rem_20rem_at_110%_120%,theme(colors.teal.200),transparent)]" />
    {/* card-ish chip */}
    <div className="relative rounded-2xl border bg-white/80 backdrop-blur px-10 py-7 shadow-xl">
      <span className="select-none text-3xl font-semibold tracking-tight text-gray-800">
        Coming soon
      </span>
    </div>
  </div>
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
