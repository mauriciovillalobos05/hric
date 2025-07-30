import EntrepreneurDashboard from "./entrepreneurs-dashboard/entrepreneursDashboard.jsx";
import InvestorsDashboard from "./investors-dashboard/investorsDashboard.jsx";
import { Loader2 } from "lucide-react";

function MainUserDashboard({ role }) {
  if (role === undefined || role === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-gray-600">
        <Loader2 className="h-10 w-10 animate-spin mb-4 text-gray-800" />
        <p className="text-sm">Loading...</p>
      </div>
    );
  }

  if (role === "investor") return <InvestorsDashboard />;
  if (role === "entrepreneur") return <EntrepreneurDashboard />;

  return <div>Unknown role: {role}</div>;
}

export default MainUserDashboard;
