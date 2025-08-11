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
import InvestorProfile from "./pages/complete-profile/InvestorProfile";
import EntrepreneurProfile from "./pages/complete-profile/EntrepreneurProfile";
import EmailPendingSecondary from "./pages/emailPendingSecondary";
import EmailConfirmationSent from "./pages/emailConfirmationSent";
import ProfilePreview from "./pages/profileViews/ProfilePreview";
import { Loader2 } from "lucide-react"; 
// import Subscription from "./pages/Subscription"; // assuming you have this actual component
import { createClient } from "@supabase/supabase-js";

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
      console.log("Access token:", session?.access_token);
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
    <>
      <Routes>
        {/* Public routes */}
        {/* Home, Login and Register routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Secondary Email pending confirmation route */}
        <Route
          path="/email-pending-secondary"
          element={
            <ProtectedRoute>
              <EmailPendingSecondary />
            </ProtectedRoute>
          }
        />

        {/* Email confirmation route */}
        <Route
          path="/email-confirmation-sent"
          element={<EmailConfirmationSent />}
        />

        {/* Onboarding and profile completion routes */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />

        {/* Investor profile completion */}
        <Route
          path="/complete-profile/investor"
          element={
            <ProtectedRoute>
              <InvestorProfile />
            </ProtectedRoute>
          }
        />

        {/* Entrepreneur profile completion */}
        <Route
          path="/complete-profile/entrepreneur"
          element={
            <ProtectedRoute>
              <EntrepreneurProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile-settings"
          element={
            <ProtectedRoute>
              <ProfileSettings />
            </ProtectedRoute>
          }
        />

        {/* View a profile */}
        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute>
              <ProfilePreview />
            </ProtectedRoute>
          }
        />
        {/* FOR LATER once we have the subscription page */}
        {/* <Route
        path="/subscription"
        element={
          <ProtectedRoute>
            <Subscription />
          </ProtectedRoute>
        }
      /> */}

        <Route
          path="/dashboard/user"
          element={
            <ProtectedRoute>
              {user?.role ? (
                <MainUserDashboard role={user.role} />
              ) : (
                <div className="min-h-screen flex items-center justify-center text-gray-600">
                  <Loader2 className="h-8 w-8 animate-spin mr-2" />
                  <span>Loading your role...</span>
                </div>
              )}
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/investor"
          element={
            //<ProtectedRoute isAllowed={user?.role === "investor"}>
              <InvestorsDashboard />
            //</ProtectedRoute>
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
    </>
  );
}

export default App;
