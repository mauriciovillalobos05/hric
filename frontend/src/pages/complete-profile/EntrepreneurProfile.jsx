import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

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
    financials: "",
    target_market: "",
    business_model: "",
    problem_solved: "",
    traction_summary: "",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    tier: null,
  });
  const [error, setError] = useState(null);
  const [enterpriseId, setEnterpriseId] = useState(null);
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) throw userError;

        const { stripe_customer_id, stripe_subscription_id, plan } =
          user.user_metadata || {};

        // Fetch existing enterprise data
        const { data: enterpriseData, error: enterpriseError } = await supabase
          .from("enterprise")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (enterpriseData) {
          setEnterpriseId(enterpriseData.id);
          setForm({
            ...form,
            ...enterpriseData,
            stripe_customer_id,
            stripe_subscription_id,
            tier: plan,
          });
        } else {
          setForm((prev) => ({
            ...prev,
            stripe_customer_id,
            stripe_subscription_id,
            tier: plan,
          }));
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
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

      const payload = { ...form };

      // Clean up all empty strings to null or valid types
      for (const key in payload) {
        if (typeof payload[key] === "string" && payload[key].trim() === "") {
          payload[key] = null;
        }
      }

      // Parse financials if it's a non-empty string
      if (form.financials?.trim()) {
        try {
          payload.financials = JSON.parse(form.financials.trim());
        } catch (err) {
          setError(
            "'Financial Summary' must be valid JSON (e.g. { \"revenue\": 50000 })"
          );
          setLoading(false);
          return;
        }
      } else {
        payload.financials = null;
      }

      // Convert numeric strings to real numbers
      if (payload.team_size)
        payload.team_size = parseInt(payload.team_size, 10);
      if (payload.funding_needed)
        payload.funding_needed = parseFloat(payload.funding_needed);

      const res = await fetch("http://127.0.0.1:8000/enterprise/profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
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
          <CardTitle className="text-2xl font-bold">
            Entrepreneur Profile
          </CardTitle>
          <p className="text-sm text-gray-500">
            Help investors understand your company
          </p>
        </CardHeader>
        <CardContent>
          {enterpriseId && (
            <p className="text-sm text-blue-600 mb-3 text-center">
              You're editing an existing profile.
            </p>
          )}
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              name="name"
              placeholder="Company Name"
              value={form.name}
              onChange={handleChange}
            />
            <Input
              name="industry"
              placeholder="Industry"
              value={form.industry}
              onChange={handleChange}
            />
            <Input
              name="stage"
              placeholder="Stage (e.g. Pre-seed, Series A)"
              value={form.stage}
              onChange={handleChange}
            />
            <Input
              name="location"
              placeholder="Company Location"
              value={form.location}
              onChange={handleChange}
            />
            <Input
              name="team_size"
              placeholder="Team Size"
              type="number"
              value={form.team_size}
              onChange={handleChange}
            />
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
              name="financials"
              placeholder="Financial Summary"
              value={form.financials}
              onChange={handleChange}
            />
            <Input
              name="target_market"
              placeholder="Target Market"
              value={form.target_market}
              onChange={handleChange}
            />
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
              {loading ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                "Submit"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/dashboard/entrepreneur")}
            >
              Complete Later
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
