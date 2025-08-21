import React from "react";
import { Routes, Route } from "react-router-dom";

// DASHBOARDS (match exact filenames in repo)
import HomePage from "./dashboards/homePage.jsx";
import MainUserDashboard from "./dashboards/mainUserDashboard.jsx";
import InvestorsDashboard from "./dashboards/investors-dashboard/investorsDashboard.jsx";
import EntrepreneurDashboard from "./dashboards/entrepreneurs-dashboard/entrepreneursDashboard.jsx";

// PAGES (these likely already match; add .jsx if you hit case/extension issues)
import ProfileSettings from "./pages/ProfileSettings/profileSettings.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import Portfolio from "./pages/Portfolio/Portfolio.jsx";
import Analysis from "./pages/AnalysisMonteCarlo/Analysis.jsx";
import InvestorProfile from "./pages/complete-profile/InvestorProfile.jsx";
import EntrepreneurProfile from "./pages/complete-profile/EntrepreneurProfile.jsx";
import EmailPendingSecondary from "./pages/emailPendingSecondary.jsx";
import EmailConfirmationSent from "./pages/emailConfirmationSent.jsx";
import ProfilePreview from "./pages/profileViews/ProfilePreview.jsx";
import SelectPlan from "./pages/selectPlan.jsx";

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