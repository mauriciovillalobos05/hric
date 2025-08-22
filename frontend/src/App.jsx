import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./dashboards/HomePage";
import MainUserDashboard from "./dashboards/mainUserDashboard.jsx";
import InvestorsDashboard from "./dashboards/investors-dashboard/investorsDashboard";
import EntrepreneurDashboard from "./dashboards/entrepreneurs-dashboard/entrepreneursDashboard";
import ProfileSettings from "./pages/ProfileSettings/profileSettings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Portfolio from "./pages/Portfolio/Portfolio";
import Analysis from "./pages/AnalysisMonteCarlo/Analysis";
import InvestorProfile from "./pages/complete-profile/InvestorProfile";
import EntrepreneurProfile from "./pages/complete-profile/EntrepreneurProfile";
import EmailPendingSecondary from "./pages/emailPendingSecondary";
import EmailConfirmationSent from "./pages/emailConfirmationSent";
import ProfilePreview from "./pages/profileViews/ProfilePreview";
import SelectPlan from "./pages/selectPlan";
import ProtectedRoute from "./auth/protectedRoute";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/email-confirmation-sent" element={<EmailConfirmationSent />} />

      {/* Protected (signed-in) */}
      <Route
        path="/select-plan"
        element={
          <ProtectedRoute>
            <SelectPlan />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portfolio"
        element={
          <ProtectedRoute>
            <Portfolio />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analysis"
        element={
          <ProtectedRoute>
            <Analysis />
          </ProtectedRoute>
        }
      />
      <Route
        path="/email-pending-secondary"
        element={
          <ProtectedRoute>
            <EmailPendingSecondary />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/complete-profile/investor"
        element={
          <ProtectedRoute>
            <InvestorProfile />
          </ProtectedRoute>
        }
      />
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
      <Route
        path="/profile/:userId"
        element={
          <ProtectedRoute>
            <ProfilePreview />
          </ProtectedRoute>
        }
      />

      {/* Dashboards */}
      <Route
        path="/dashboard/user"
        element={
          <ProtectedRoute>
            {/* Let the component resolve enterpriseType (or sessionStorage) itself */}
            <MainUserDashboard />
          </ProtectedRoute>
        }
      />

      {/* Enterprise-type gated dashboards */}
      <Route
        path="/dashboard/investor"
        element={
          <ProtectedRoute requiredEnterpriseTypes={["investor"]}>
            <InvestorsDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/entrepreneur"
        element={
          <ProtectedRoute requiredEnterpriseTypes={["startup"]}>
            <EntrepreneurDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}