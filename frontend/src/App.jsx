import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import HomePage from "./dashboards/HomePage";
import MainUserDashboard from "./dashboards/MainUserDashboard";
import InvestorsDashboard from "./dashboards/investors-dashboard/investorsDashboard";
import EntrepreneurDashboard from "./dashboards/entrepreneurs-dashboard/entrepreneursDashboard";
import ProtectedRoute from "./auth/protectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getUserSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser({
          ...session.user,
          role:
            session.user.user_metadata?.role ||
            localStorage.getItem("user_role"),
        });
      }
    };
    getUserSession();
  }, []);

  // MOCK USER DATA
  // const [ user ]  = useState({
  //   id: '123',
  //   name: 'John Doe',
  //   role: 'entrepreneur', // or 'investor'

  // })
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Generic authenticated dashboard */}
      <Route
        path="/dashboard/user"
        element={
          <ProtectedRoute isAllowed={!!user} redirectPath="/login">
            <MainUserDashboard />
          </ProtectedRoute>
        }
      />

      {/* Investor dashboard route */}
      <Route
        path="/dashboard/investor"
        element={
          <ProtectedRoute
            isAllowed={!!user && user.role === "investor"}
            redirectPath="/login"
          >
            <InvestorsDashboard />
          </ProtectedRoute>
        }
      />

      {/* Entrepreneur dashboard route */}
      <Route
        path="/dashboard/entrepreneur"
        element={
          <ProtectedRoute
            isAllowed={!!user && user.role === "entrepreneur"}
            redirectPath="/login"
          >
            <EntrepreneurDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
