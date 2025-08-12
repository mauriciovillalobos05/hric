import React from "react";
import { Routes, Route } from "react-router-dom";
import HomePage from "./dashboards/HomePage";
import MainUserDashboard from "./dashboards/MainUserDashboard";
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
function App() {
  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/select-plan" element={<SelectPlan />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Keep everything public for the dummy simulation */}
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/email-pending-secondary" element={<EmailPendingSecondary />} />
        <Route path="/email-confirmation-sent" element={<EmailConfirmationSent />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/complete-profile/investor" element={<InvestorProfile />} />
        <Route path="/complete-profile/entrepreneur" element={<EntrepreneurProfile />} />
        <Route path="/profile-settings" element={<ProfileSettings />} />
        <Route path="/profile/:userId" element={<ProfilePreview />} />

        {/* Dashboards (no auth required) */}
        <Route path="/dashboard/user" element={<MainUserDashboard />} />
        <Route path="/dashboard/investor" element={<InvestorsDashboard />} />
        <Route path="/dashboard/entrepreneur" element={<EntrepreneurDashboard />} />
      </Routes>
    </>
  );
}

export default App;