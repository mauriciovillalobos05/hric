import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./dashboards/homePage";
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

            <SelectPlan />

        }
      />
      <Route
        path="/portfolio"
        element={

            <Portfolio />

        }
      />
      <Route
        path="/analysis"
        element={

            <Analysis />

        }
      />
      <Route
        path="/email-pending-secondary"
        element={

            <EmailPendingSecondary />

        }
      />
      <Route
        path="/onboarding"
        element={

            <Onboarding />

        }
      />
      <Route
        path="/complete-profile/investor"
        element={

            <InvestorProfile />

        }
      />
      <Route
        path="/complete-profile/entrepreneur"
        element={

            <EntrepreneurProfile />

        }
      />
      <Route
        path="/profile-settings"
        element={

            <ProfileSettings />

        }
      />
      <Route
        path="/profile/:userId"
        element={

            <ProfilePreview />

        }
      />

      {/* Dashboards */}
      <Route path="/dashboard/user" element={<MainUserDashboard />} />

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
            <EntrepreneurDashboard />
        }
      />
    </Routes>
  );
}