import EntrepreneurDashboard from "./entrepreneurs-dashboard/entrepreneursDashboard.jsx";
import InvestorsDashboard from "./investors-dashboard/investorsDashboard.jsx";
import { Loader2 } from "lucide-react";

function MainUserDashboard({ role }) {
  if (!role) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-gray-600">
        <Loader2 className="h-10 w-10 animate-spin mb-4 text-gray-800" />
        <p className="text-sm">Loading role information...</p>
      </div>
    );
  }

  switch (role) {
    case "investor":
      return <InvestorsDashboard />;
    case "entrepreneur":
      return <EntrepreneurDashboard />;
    default:
      return (
        <div className="min-h-screen flex items-center justify-center text-red-600">
          Unknown role: {role}
        </div>
      );
  }
}

export default MainUserDashboard;
