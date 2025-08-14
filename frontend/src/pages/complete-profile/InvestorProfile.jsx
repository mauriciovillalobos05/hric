// src/pages/InvestorProfile.jsx
// Simulation-only version: NO Supabase, NO backend. Persists to sessionStorage.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import LocationMultiSelect from "../cmpnnts/LocationMultiSelect";

// ---------- sessionStorage helpers ----------
const KEYS = {
  USERS: "hri:users",          // map: { [email]: { ...userRecord, investorProfile? } }
  SESSION: "hri:authSession",  // { email, issuedAt }
};

const read = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const write = (key, value) => {
  sessionStorage.setItem(key, JSON.stringify(value));
};

// ---------- tiny utils ----------
const toNumber = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const arrayEnsure = (x) => (Array.isArray(x) ? x : []);

// ---------- small UI helper ----------
function MultiSelect({ label, options, selected, onChange }) {
  const toggleOption = (option) => {
    if (selected.includes(option)) onChange(selected.filter((x) => x !== option));
    else onChange([...selected, option]);
  };

  return (
    <div>
      <label className="block font-medium mb-1">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => toggleOption(option)}
            className={`px-3 py-1 border rounded-full text-sm ${
              selected.includes(option)
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function InvestorProfile() {
  const navigate = useNavigate();

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    industries: [],
    investment_stages: [],
    geographic_focus: [],
    investment_range_min: "",
    investment_range_max: "",
    accredited_status: false,
    investor_type: "",
    risk_tolerance: "",
    portfolio_size: "",
    advisory_availability: false,
    communication_frequency: "",
    meeting_preference: "",
  });

  const industryOptions = [
    "Technology",
    "Healthcare",
    "Finance",
    "Education",
    "Agriculture",
    "Energy",
    "E-commerce",
    "Transportation",
    "Media",
    "Real Estate",
  ];

  const investmentStageOptions = [
    "Pre-seed",
    "Seed",
    "Series A",
    "Series B",
    "Series C",
    "Growth",
    "IPO",
  ];

  const investorTypeOptions = [
    "Angel",
    "Venture Capitalist",
    "Institutional",
    "Family Office",
    "Corporate VC",
    "Accelerator/Incubator",
  ];

  const riskOptions = ["Low", "Medium", "High"];
  const commOptions = ["Weekly", "Bi-weekly", "Monthly", "Quarterly", "On-demand"];
  const meetingOptions = ["In-person", "Virtual", "Hybrid", "Email Only"];

  // ---------- initial load from sessionStorage ----------
  useEffect(() => {
    try {
      const session = read(KEYS.SESSION); // { email, issuedAt }
      if (!session?.email) throw new Error("Not authenticated. Please register or log in.");

      const users = read(KEYS.USERS);
      const user = users[session.email];
      if (!user) throw new Error("User record not found. Please register again.");

      const profile = user.investorProfile || {};

      setForm((prev) => ({
        ...prev,
        industries: arrayEnsure(profile.industries),
        investment_stages: arrayEnsure(profile.investment_stages),
        geographic_focus: arrayEnsure(profile.geographic_focus),
        investment_range_min: profile.investment_range_min ?? "",
        investment_range_max: profile.investment_range_max ?? "",
        accredited_status: Boolean(profile.accredited_status),
        investor_type: profile.investor_type || "",
        risk_tolerance: profile.risk_tolerance || "",
        portfolio_size: profile.portfolio_size ?? "",
        advisory_availability: Boolean(profile.advisory_availability),
        communication_frequency: profile.communication_frequency || "",
        meeting_preference: profile.meeting_preference || "",
      }));
    } catch (e) {
      console.error("Boot error:", e);
      setError(e.message || "Failed to load profile.");
    } finally {
      setBooting(false);
    }
  }, []);

  // ---------- generic input handler ----------
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  // ---------- submit (save to sessionStorage only) ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const session = read(KEYS.SESSION);
      if (!session?.email) throw new Error("Not authenticated.");

      const users = read(KEYS.USERS);
      const user = users[session.email];
      if (!user) throw new Error("User record not found.");

      // Client-side validations
      const minV =
        form.investment_range_min !== "" ? Number(form.investment_range_min) : null;
      const maxV =
        form.investment_range_max !== "" ? Number(form.investment_range_max) : null;
      if (minV !== null && maxV !== null && minV > maxV) {
        throw new Error("Minimum investment cannot exceed maximum.");
      }

      // Build the profile object (normalized types)
      const profile = {
        industries: arrayEnsure(form.industries),
        investment_stages: arrayEnsure(form.investment_stages),
        geographic_focus: arrayEnsure(form.geographic_focus),
        investment_range_min: toNumber(form.investment_range_min),
        investment_range_max: toNumber(form.investment_range_max),
        accredited_status: Boolean(form.accredited_status),
        investor_type: form.investor_type || "",
        risk_tolerance: form.risk_tolerance || "",
        portfolio_size: toNumber(form.portfolio_size),
        advisory_availability: Boolean(form.advisory_availability),
        communication_frequency: form.communication_frequency || "",
        meeting_preference: form.meeting_preference || "",
        savedAt: Date.now(),
      };

      // Persist under the current user
      users[session.email] = {
        ...user,
        investorProfile: profile,
        updatedAt: Date.now(),
      };
      write(KEYS.USERS, users);

      // Done — go to the simulated dashboard
      navigate("/dashboard/investor");
    } catch (err) {
      console.error("Profile error:", err);
      setError(err.message || "Could not submit profile");
    } finally {
      setSaving(false);
    }
  };

  // ---------- UI ----------
  if (booting) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin h-6 w-6 text-gray-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Investor Profile (Simulation)</CardTitle>
          <p className="text-sm text-gray-500">This saves locally to sessionStorage — no backend involved.</p>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <MultiSelect
              label="Industries"
              options={industryOptions}
              selected={form.industries}
              onChange={(v) => setForm((p) => ({ ...p, industries: v }))}
            />

            <MultiSelect
              label="Investment Stages"
              options={investmentStageOptions}
              selected={form.investment_stages}
              onChange={(v) => setForm((p) => ({ ...p, investment_stages: v }))}
            />

            <LocationMultiSelect
              values={form.geographic_focus}
              onChange={(v) => setForm((p) => ({ ...p, geographic_focus: v }))}
            />

            <div className="flex gap-4">
              <Input
                name="investment_range_min"
                placeholder="Min Investment (USD)"
                type="number"
                value={form.investment_range_min}
                onChange={handleChange}
              />
              <Input
                name="investment_range_max"
                placeholder="Max Investment (USD)"
                type="number"
                value={form.investment_range_max}
                onChange={handleChange}
              />
            </div>

            <select
              name="investor_type"
              value={form.investor_type}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select Investor Type</option>
              {investorTypeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <select
              name="risk_tolerance"
              value={form.risk_tolerance}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select Risk Tolerance</option>
              {riskOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <Input
              name="portfolio_size"
              placeholder="Portfolio Size (# of investments)"
              type="number"
              value={form.portfolio_size}
              onChange={handleChange}
            />

            <select
              name="communication_frequency"
              value={form.communication_frequency}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select Communication Frequency</option>
              {["Weekly", "Bi-weekly", "Monthly", "Quarterly", "On-demand"].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <select
              name="meeting_preference"
              value={form.meeting_preference}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select Meeting Preference</option>
              {["In-person", "Virtual", "Hybrid", "Email Only"].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="accredited_status"
                checked={form.accredited_status}
                onChange={handleChange}
              />
              Accredited Investor
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="advisory_availability"
                checked={form.advisory_availability}
                onChange={handleChange}
              />
              Available for Advisory
            </label>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="animate-spin h-5 w-5" /> : "Submit"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}