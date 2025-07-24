import React, { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import HomePage from "./dashboards/HomePage";
import MainUserDashboard from "./dashboards/MainUserDashboard";
import InvestorsDashboard from "./dashboards/investors-dashboard/investorsDashboard";
import EntrepreneurDashboard from "./dashboards/entrepreneurs-dashboard/entrepreneursDashboard";
import ProfileSettings from "./pages/ProfileSettings/profileSettings";
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
        const { data: userProfile, error } = await supabase
          .from("user")
          .select("user_type")
          .eq("id", session.user.id)
          .single();

        if (error) {
          console.error("User profile fetch error:", error);
          return;
        }

        setUser({
          ...session.user,
          role: userProfile.user_type,
        });
      }
    };

    getUserSession();
  }, []);

  useEffect(() => {
    console.log("Updated user:", user);
  }, [user]);

  // MOCK USER DATA
  const [ user1 ]  = useState({
    id: '123',
    name: 'John Doe',
    role: 'entrepreneur', // or 'investor'

  })
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/profile-settings" element={<ProfileSettings />} />
      {/* <Route path="/subscription" element={<SubscriptionPage />} /> */}

      {/* Generic authenticated dashboard */}
      <Route
        path="/dashboard/user"
        element={
          <ProtectedRoute isAllowed={!!user} redirectPath="/login">
            <MainUserDashboard role={user?.role || ""} />
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
            isAllowed={!!user1 && user1.role === "entrepreneur"}
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
