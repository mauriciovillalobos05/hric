import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './dashboards/HomePage';
import MainUserDashboard from './dashboards/MainUserDashboard';
import InvestorsDashboard from './dashboards/investors-dashboard/investorsDashboard';
import EntrepreneurDashboard from './dashboards/entrepreneurs-dashboard/entrepreneursDashboard';
import ProtectedRoute from './auth/protectedRoute';

function App() {
  // const [user, setUser] = useState(null); // Replace with real auth logic

  const [ user ]  = useState({ 
    id: '123',
    name: 'John Doe',
    role: 'entrepreneur', // or 'investor'

  })
  return (
    
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />

        {/* General Authenticated Route */}
        <Route
          element={<ProtectedRoute isAllowed={!!user} redirectPath="/" />}
        >
          <Route path="/dashboard/user" element={<MainUserDashboard role={user.role}/>} />
        </Route>

        {/* Investor Only Route */}
        <Route
          path="/dashboard/investor"
          element={
            <ProtectedRoute
              isAllowed={!!user && user.role === "investor"}
              redirectPath="/"
            >
              <InvestorsDashboard />
            </ProtectedRoute>
          }
        />

        {/* Entrepreneur Only Route */}
        <Route
          path="/dashboard/entrepreneur"
          element={
            <ProtectedRoute
              isAllowed={!!user && user.role === "entrepreneur"}
              redirectPath="/"
            >
              <EntrepreneurDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default App;
