import React, { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import HomePage from "./dashboards/HomePage";
import MainUserDashboard from "./dashboards/MainUserDashboard";
import InvestorsDashboard from "./dashboards/investors-dashboard/investorsDashboard";
import EntrepreneurDashboard from "./dashboards/entrepreneurs-dashboard/entrepreneursDashboard";
import ProfileSettings from "./pages/ProfileSettings/profileSettings";
import ProtectedRoute from "./auth/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import ConfirmEmail from "./pages/emailConfirmation";
import EntrepreneurProfile from "./pages/complete-profile/EntrepreneurProfile";
import InvestorProfile from "./pages/complete-profile/InvestorProfile";
import { createClient } from "@supabase/supabase-js";
import Subscription from "./dashboards/investors-dashboard/dashboard-components/components/headerBarComponents/components/Subscription.jsx";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUserSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: userProfile, error } = await supabase
          .from("user")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (!error && userProfile) {
          setUser({
            ...session.user,
            role: userProfile.role,
          });
        }
      }
      setLoading(false);
    };

    getUserSession();
  }, []);

  if (loading) return null; // or a spinner/loading screen

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/confirm-email" element={<ConfirmEmail />} />

      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />

      <Route path="/complete-profile/investor" element={
        <ProtectedRoute>
          <InvestorProfile />
        </ProtectedRoute>} 
      />
      
      <Route path="/complete-profile/entrepreneur" element={
        <ProtectedRoute>
          <EntrepreneurProfile />
        </ProtectedRoute>} 
      />

      <Route
        path="/profile-settings"
        element={
          <ProtectedRoute>
            <ProfileSettings />
          </ProtectedRoute>
        }
      />


      {/* FOR LATER once we have the subscription page */}
      <Route
        path="/subscription"
        element={
          <ProtectedRoute>
            <Subscription />
          </ProtectedRoute>
        }
      /> 

      <Route
        path="/dashboard/user"
        element={
          <ProtectedRoute>
            <MainUserDashboard role={user?.role || ""} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/investor"
        element={
          <ProtectedRoute isAllowed={user?.role === "investor"}>
            <InvestorsDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/entrepreneur"
        element={
          <ProtectedRoute isAllowed={user?.role === "entrepreneur"}>
            <EntrepreneurDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
