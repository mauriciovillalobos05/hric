import EntrepreneurDashboard from './entrepreneurs-dashboard/entrepreneursDashboard.jsx';
import InvestorsDashboard from './investors-dashboard/investorsDashboard.jsx';

function MainUserDashboard() {
  // will be changed once we have authentication and user roles
  const  role = 'investor'

  if (role === 'investor') return <InvestorsDashboard />;
  if (role === 'entrepreneur') return <EntrepreneurDashboard />;
}

export default MainUserDashboard;