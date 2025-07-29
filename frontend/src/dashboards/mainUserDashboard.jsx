import EntrepreneurDashboard from './entrepreneurs-dashboard/entrepreneursDashboard.jsx';
import InvestorsDashboard from './investors-dashboard/investorsDashboard.jsx';

function MainUserDashboard( { role }) {
  // will be changed once we have authentication and user roles
  if (!role) return <div>Loading dashboard...</div>;

  if (role === 'investor') return <InvestorsDashboard />;
  if (role === 'entrepreneur') return <EntrepreneurDashboard />;
  return <div>Unknown role</div>
}

export default MainUserDashboard;