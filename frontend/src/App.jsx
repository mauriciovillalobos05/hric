import { Routes, Route } from 'react-router-dom';
import HomePage from './dashboards/HomePage';
import MainUserDashboard from './dashboards/MainUserDashboard';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dashboard/user" element={<MainUserDashboard />} />
    </Routes>
  );
}

export default App;
