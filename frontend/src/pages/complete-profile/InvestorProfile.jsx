// src/pages/CompleteProfile/InvestorProfile.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import LocationMultiSelect from "../cmpnnts/LocationMultiSelect";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function MultiSelect({ label, options, selected, onChange }) {
  const toggleOption = (option) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
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
  const [loading, setLoading] = useState(true);
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
    stripe_customer_id: null,
    stripe_subscription_id: null,
    tier: null,
  });
  const [error, setError] = useState(null);

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

  const commOptions = [
    "Weekly",
    "Bi-weekly",
    "Monthly",
    "Quarterly",
    "On-demand",
  ];

  const meetingOptions = ["In-person", "Virtual", "Hybrid", "Email Only"];

  useEffect(() => {
    const fetchStripeMeta = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;
        const { stripe_customer_id, stripe_subscription_id, plan } =
          user.user_metadata || {};
        setForm((prev) => ({
          ...prev,
          stripe_customer_id,
          stripe_subscription_id,
          tier: plan,
        }));
      } catch (err) {
        console.error("Metadata error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStripeMeta();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No session token found");

      const res = await fetch("http://127.0.0.1:8000/investors/profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      navigate("/dashboard/investor");
    } catch (err) {
      console.error("Profile error:", err);
      setError(err.message || "Could not submit profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
          <CardTitle className="text-2xl font-bold">Investor Profile</CardTitle>
          <p className="text-sm text-gray-500">Tell us about your preferences</p>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <MultiSelect
              label="Industries"
              options={industryOptions}
              selected={form.industries}
              onChange={(newValues) =>
                setForm((prev) => ({ ...prev, industries: newValues }))
              }
            />
            <MultiSelect
              label="Investment Stages"
              options={investmentStageOptions}
              selected={form.investment_stages}
              onChange={(newValues) =>
                setForm((prev) => ({ ...prev, investment_stages: newValues }))
              }
            />
            <LocationMultiSelect
              values={form.geographic_focus}
              onChange={(newValues) =>
                setForm((prev) => ({ ...prev, geographic_focus: newValues }))
              }
            />
            <div className="flex gap-4">
              <Input
                name="investment_range_min"
                placeholder="Min Investment"
                type="number"
                value={form.investment_range_min}
                onChange={handleChange}
              />
              <Input
                name="investment_range_max"
                placeholder="Max Investment"
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
              placeholder="Portfolio Size"
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
              {commOptions.map((opt) => (
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
              {meetingOptions.map((opt) => (
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
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Submit"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}