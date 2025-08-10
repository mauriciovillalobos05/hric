import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import LocationAutocomplete from "../cmpnnts/Location";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

export default function EntrepreneurProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    industry: "",
    stage: "",
    location: "",
    team_size: "",
    funding_needed: "",
    pitch_deck_url: "",
    demo_url: "",
    financials: {
      funding_goal: "",
    },
    target_market: "",
    business_model: "",
    problem_solved: "",
    traction_summary: "",
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

  const stageOptions = [
    "Idea",
    "Pre-seed",
    "Seed",
    "Series A",
    "Series B",
    "Series C",
    "Growth",
    "IPO",
  ];

  const teamSizeOptions = [
    "1-2",
    "3-5",
    "6-10",
    "11-20",
    "21-50",
    "51-100",
    "100+",
  ];

  const targetMarketOptions = [
    "Young Adults (18-25)",
    "Adults (26-40)",
    "Middle-aged (41-60)",
    "Seniors (60+)",
    "Parents",
    "Students",
    "Working Professionals",
    "High-Income Individuals",
    "Budget-Conscious Consumers",
    "Urban Residents",
    "Rural Communities",
    "Tech-Savvy Users",
    "Non-Tech-Savvy Users",
    "Health-Conscious Consumers",
    "Sustainability-Focused Consumers",
    "Small Businesses",
    "Enterprises",
    "Freelancers / Creators",
    "B2B (Business to Business)",
    "B2C (Business to Consumer)",
  ];

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;

        const { stripe_customer_id, stripe_subscription_id, plan } =
          user?.user_metadata || {};
        setForm((prev) => ({
          ...prev,
          stripe_customer_id,
          stripe_subscription_id,
          tier: plan,
        }));
      } catch (e) {
        console.error("Metadata error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const teamSizeToInt = (v) => {
    // "3-5" -> 5, "100+" -> 100, "12" -> 12, "" -> null
    if (!v) return null;
    if (typeof v === "number") return v;
    const plus = v.endsWith("+");
    if (plus) return parseInt(v, 10) || null;
    if (v.includes("-")) {
      const parts = v.split("-").map((x) => parseInt(x, 10)).filter(Boolean);
      if (!parts.length) return null;
      return Math.max(...parts);
    }
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };

  const toFloat = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
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

      const payload = {
        ...form,
        team_size: teamSizeToInt(form.team_size),
        funding_needed: toFloat(form.funding_needed),
        financials: {
          funding_goal: toFloat(form.financials.funding_goal),
        },
      };

      const res = await fetch(`${API_BASE}/api/entrepreneurs/profile`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Submission failed");

      navigate("/dashboard/entrepreneur");
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
          <CardTitle className="text-2xl font-bold">Entrepreneur Profile</CardTitle>
          <p className="text-sm text-gray-500">Help investors understand your company</p>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              name="name"
              placeholder="Company Name"
              value={form.name}
              onChange={handleChange}
            />
            <select
              name="industry"
              value={form.industry}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select Industry</option>
              {industryOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            <select
              name="stage"
              value={form.stage}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select Stage</option>
              {stageOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            <LocationAutocomplete
              value={form.location}
              onChange={(value) => setForm((prev) => ({ ...prev, location: value }))}
            />

            <select
              name="team_size"
              value={form.team_size}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select Team Size</option>
              {teamSizeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            <Input
              name="funding_needed"
              placeholder="Funding Needed (USD)"
              type="number"
              value={form.funding_needed}
              onChange={handleChange}
            />
            <Input
              name="pitch_deck_url"
              placeholder="Pitch Deck URL"
              value={form.pitch_deck_url}
              onChange={handleChange}
            />
            <Input
              name="demo_url"
              placeholder="Demo URL"
              value={form.demo_url}
              onChange={handleChange}
            />
            <Input
              name="funding_goal"
              type="number"
              placeholder="Funding Goal (USD)"
              value={form.financials.funding_goal}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  financials: { ...prev.financials, funding_goal: e.target.value },
                }))
              }
            />
            <select
              name="target_market"
              value={form.target_market}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select Target Market</option>
              {targetMarketOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <textarea
              name="business_model"
              placeholder="Business Model"
              rows={3}
              className="w-full border rounded-md p-2"
              value={form.business_model}
              onChange={handleChange}
            />
            <textarea
              name="problem_solved"
              placeholder="Problem Solved"
              rows={3}
              className="w-full border rounded-md p-2"
              value={form.problem_solved}
              onChange={handleChange}
            />
            <textarea
              name="traction_summary"
              placeholder="Traction Summary"
              rows={3}
              className="w-full border rounded-md p-2"
              value={form.traction_summary}
              onChange={handleChange}
            />

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Submit"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}