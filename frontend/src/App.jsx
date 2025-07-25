// src/App.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import MainUserDashboard from "./dashboards/mainUserDashboard.jsx";
import HomePage from "./dashboards/homePage.jsx";
import ProfileSettings from "./dashboards/investors-dashboard/dashboard-components/components/headerBarComponents/components/profileSettings";
import Subscription from "./dashboards/investors-dashboard/dashboard-components/components/headerBarComponents/components/Subscription.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/dashboard/user" element={<MainUserDashboard />} />
      <Route path="/profile-settings" element={<ProfileSettings />} />
      <Route path="/subscription" element={<Subscription />} />
    </Routes>
  );
}

export default App;