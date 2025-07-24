import EntrepreneurDashboard from './entrepreneurs-dashboard/entrepreneursDashboard.jsx';
import InvestorsDashboard from './investors-dashboard/investorsDashboard.jsx';
import { useEffect, useState } from 'react';

function MainUserDashboard() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    const storedRole = sessionStorage.getItem("user_role") || "entrepreneur";
    setRole(storedRole);
  }, []);

  if (!role) return <div>Loading dashboard...</div>;

  if (role === 'investor') return <InvestorsDashboard />;
  if (role === 'entrepreneur') return <EntrepreneurDashboard />;
  return <div>Unknown role</div>;
}

export default MainUserDashboard;