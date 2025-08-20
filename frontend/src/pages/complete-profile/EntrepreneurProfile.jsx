// src/pages/EntrepreneurProfile.jsx
// Simulation-only version: NO Supabase, NO backend. Persists to sessionStorage.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import LocationAutocomplete from "../cmpnnts/Location";

// ---------- sessionStorage helpers ----------
const KEYS = {
  USERS: "hri:users",          // map: { [email]: { ...userRecord, entrepreneurProfile? } }
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

// ---------- helpers ----------
const teamSizeOptionsDefault = ["1-2","3-5","6-10","11-20","21-50","51-100","100+"];
const stageOptionsDefault = ["Idea","Pre-seed","Seed","Series A","Series B","Series C","Growth","IPO"];
const industryOptionsDefault = [
  "Technology","Healthcare","Finance","Education","Agriculture","Energy",
  "E-commerce","Transportation","Media","Real Estate",
];
const targetMarketOptions = [
  "Young Adults (18-25)","Adults (26-40)","Middle-aged (41-60)","Seniors (60+)",
  "Parents","Students","Working Professionals","High-Income Individuals",
  "Budget-Conscious Consumers","Urban Residents","Rural Communities",
  "Tech-Savvy Users","Non-Tech-Savvy Users","Health-Conscious Consumers",
  "Sustainability-Focused Consumers","Small Businesses","Enterprises",
  "Freelancers / Creators","B2B (Business to Business)","B2C (Business to Consumer)",
];

const teamSizeToInt = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v);
  if (s.endsWith("+")) return parseInt(s, 10) || null;
  if (s.includes("-")) {
    const parts = s.split("-").map((x) => parseInt(x, 10)).filter(Number.isFinite);
    return parts.length ? Math.max(...parts) : null;
  }
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};

const toNumber = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toPct = (v) => {
  const n = toNumber(v);
  if (n == null) return null;
  return Math.max(0, Math.min(100, n));
};

const csvToArray = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const arrayToCSV = (arr) => (Array.isArray(arr) ? arr.join(", ") : "");

const numberOrEmpty = (n) => (n == null ? "" : String(n));

const pickTeamSizeOption = (n) => {
  if (n == null) return "";
  if (n >= 100) return "100+";
  if (n >= 51) return "51-100";
  if (n >= 21) return "21-50";
  if (n >= 11) return "11-20";
  if (n >= 6) return "6-10";
  if (n >= 3) return "3-5";
  if (n >= 1) return "1-2";
  return "";
};

const cleanPayload = (obj) => {
  if (Array.isArray(obj)) {
    const arr = obj.map(cleanPayload).filter((v) => v !== "" && v !== null);
    return arr;
  }
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const cv = cleanPayload(v);
      if (cv !== "" && cv !== null && !(Array.isArray(cv) && cv.length === 0)) out[k] = cv;
    }
    return out;
  }
  return obj === "" ? null : obj;
};

// ---------- component ----------
export default function EntrepreneurProfile() {
  const navigate = useNavigate();

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [industryOptions] = useState(industryOptionsDefault);
  const [stageOptions] = useState(stageOptionsDefault);
  const [teamSizeOptions] = useState(teamSizeOptionsDefault);

  const [form, setForm] = useState({
    name: "",
    industry: "",
    stage: "",
    location: "",
    team_size: "", // UI option string
    funding_needed: "",
    pitch_deck_url: "",
    demo_url: "",
    financials: { funding_goal: "" },
    target_market: "",
    business_model: "",
    problem_solved: "",
    traction_summary: "",
    headline_tags: "", // CSV
    revenue_model: "",
    competitive_advantages: "", // CSV
    current_revenue: "",
    monthly_growth_rate: "",
    customer_count: "",
    market_size: "",
    addressable_market: "",
    intellectual_property: "", // freeform notes
    // NEW metrics
    mrr_usd: "",
    arr_usd: "",
    current_valuation_usd: "",
    current_investors: "", // CSV
    technical_founders_pct: "",
    previous_exits_pct: "",
  });

  // ARR auto from MRR if empty
  useEffect(() => {
    if (form.mrr_usd && !form.arr_usd) {
      const mrr = Number(form.mrr_usd);
      if (Number.isFinite(mrr)) {
        setForm((p) => ({ ...p, arr_usd: String(mrr * 12) }));
      }
    }
  }, [form.mrr_usd]); // eslint-disable-line

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ---------- initial load from sessionStorage ----------
  useEffect(() => {
    try {
      const session = read(KEYS.SESSION); // { email, issuedAt }
      if (!session?.email) throw new Error("Not authenticated. Please register or log in.");

      const users = read(KEYS.USERS);
      const user = users[session.email];
      if (!user) throw new Error("User record not found. Please register again.");

      // Prefill from any existing entrepreneurProfile
      const profile = user.entrepreneurProfile || {};

      const fetchedTeamSizeNumber =
        typeof profile.team_size === "number" ? profile.team_size : null;

      setForm((prev) => ({
        ...prev,
        name: profile.name || "",
        location: profile.location || "",
        industry: profile.industry || "",
        stage: profile.stage || "",
        pitch_deck_url: profile.pitch_deck_url || "",
        demo_url: profile.demo_url || "",
        team_size: pickTeamSizeOption(fetchedTeamSizeNumber) || profile.team_size || "",
        funding_needed: numberOrEmpty(profile.funding_needed),
        financials: {
          funding_goal: numberOrEmpty(profile.financials?.funding_goal),
        },
        revenue_model: profile.revenue_model || "",
        competitive_advantages: arrayToCSV(profile.competitive_advantages),
        current_revenue: numberOrEmpty(profile.current_revenue),
        monthly_growth_rate: numberOrEmpty(profile.monthly_growth_rate),
        customer_count: numberOrEmpty(profile.customer_count),
        market_size: numberOrEmpty(profile.market_size),
        addressable_market: numberOrEmpty(profile.addressable_market),
        intellectual_property:
          (profile.intellectual_property &&
            (profile.intellectual_property.notes ||
              JSON.stringify(profile.intellectual_property))) || "",
        target_market: profile.target_market || "",
        business_model: profile.business_model || "",
        problem_solved: profile.problem_solved || "",
        traction_summary: profile.traction_summary || "",
        headline_tags: arrayToCSV(profile.headline_tags),

        // NEW metrics
        mrr_usd: numberOrEmpty(profile.mrr_usd),
        arr_usd: numberOrEmpty(profile.arr_usd),
        current_valuation_usd: numberOrEmpty(profile.current_valuation_usd),
        current_investors: arrayToCSV(profile.current_investors),
        technical_founders_pct: numberOrEmpty(profile.technical_founders_pct),
        previous_exits_pct: numberOrEmpty(profile.previous_exits_pct),
      }));
    } catch (e) {
      console.error("Boot error:", e);
      setError(e.message || "Failed to load profile.");
    } finally {
      setBooting(false);
    }
  }, []);

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

      const payloadRaw = {
        // enterprise
        name: form.name,
        location: form.location,

        // lookups by name (simulated)
        industry: form.industry,
        stage: form.stage,

        // enterprise_profile / description + links + tags
        problem_solved: form.problem_solved,
        pitch_deck_url: form.pitch_deck_url,
        demo_url: form.demo_url,
        headline_tags: csvToArray(form.headline_tags),
        revenue_model: form.revenue_model,
        competitive_advantages: csvToArray(form.competitive_advantages),
        current_revenue: toNumber(form.current_revenue),
        monthly_growth_rate: toNumber(form.monthly_growth_rate),
        customer_count: toNumber(form.customer_count),
        market_size: toNumber(form.market_size),
        addressable_market: toNumber(form.addressable_market),
        intellectual_property: form.intellectual_property
          ? { notes: form.intellectual_property }
          : undefined,

        // key metrics / market / team
        team_size: teamSizeToInt(form.team_size),
        funding_needed: toNumber(form.funding_needed),
        financials: { funding_goal: toNumber(form.financials.funding_goal) },
        target_market: form.target_market,

        // startup_profile text
        business_model: form.business_model,
        traction_summary: form.traction_summary,

        // NEW numeric & list fields
        mrr_usd: toNumber(form.mrr_usd),
        arr_usd:
          toNumber(form.arr_usd) ??
          (toNumber(form.mrr_usd) ? Number(form.mrr_usd) * 12 : null),
        current_valuation_usd: toNumber(form.current_valuation_usd),
        current_investors: csvToArray(form.current_investors),
        technical_founders_pct: toPct(form.technical_founders_pct),
        previous_exits_pct: toPct(form.previous_exits_pct),

        savedAt: Date.now(),
      };

      const profile = cleanPayload(payloadRaw);

      // Persist under the current user
      users[session.email] = {
        ...user,
        entrepreneurProfile: profile,
        updatedAt: Date.now(),
      };
      write(KEYS.USERS, users);

      // Done — go to the simulated dashboard
      navigate("/dashboard/entrepreneur");
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
          <CardTitle className="text-2xl font-bold">
            Entrepreneur Profile (Simulation)
          </CardTitle>
          <p className="text-sm text-gray-500">
            This saves locally to sessionStorage — no backend involved.
          </p>
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
                <option key={opt} value={opt}>
                  {opt}
                </option>
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
                <option key={opt} value={opt}>
                  {opt}
                </option>
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
                <option key={opt} value={opt}>
                  {opt}
                </option>
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
                <option key={opt} value={opt}>
                  {opt}
                </option>
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

            {/* headline tags */}
            <Input
              name="headline_tags"
              placeholder="Headline tags (comma-separated, e.g. AI, Fintech, DevTools)"
              value={form.headline_tags}
              onChange={handleChange}
            />

            {/* key metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                name="revenue_model"
                placeholder="Revenue Model"
                value={form.revenue_model}
                onChange={handleChange}
              />
              <Input
                name="competitive_advantages"
                placeholder="Competitive advantages (comma-separated)"
                value={form.competitive_advantages}
                onChange={handleChange}
              />
              <Input
                name="current_revenue"
                type="number"
                placeholder="Current revenue (USD/mo)"
                value={form.current_revenue}
                onChange={handleChange}
              />
              <Input
                name="monthly_growth_rate"
                type="number"
                step="0.01"
                placeholder="Monthly growth rate (%)"
                value={form.monthly_growth_rate}
                onChange={handleChange}
              />
              <Input
                name="customer_count"
                type="number"
                placeholder="Customer count"
                value={form.customer_count}
                onChange={handleChange}
              />
              <Input
                name="market_size"
                type="number"
                placeholder="Market size (USD)"
                value={form.market_size}
                onChange={handleChange}
              />
              <Input
                name="addressable_market"
                type="number"
                placeholder="Addressable market (USD)"
                value={form.addressable_market}
                onChange={handleChange}
              />
              <Input
                name="mrr_usd"
                type="number"
                placeholder="MRR (USD)"
                value={form.mrr_usd}
                onChange={handleChange}
              />
              <Input
                name="arr_usd"
                type="number"
                placeholder="ARR (USD)"
                value={form.arr_usd}
                onChange={handleChange}
              />
              <Input
                name="current_valuation_usd"
                type="number"
                placeholder="Current Valuation (USD)"
                value={form.current_valuation_usd}
                onChange={handleChange}
              />
              <Input
                name="current_investors"
                placeholder="Current investors (comma-separated)"
                value={form.current_investors}
                onChange={handleChange}
              />
              <Input
                name="technical_founders_pct"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="Technical founders %"
                value={form.technical_founders_pct}
                onChange={handleChange}
              />
              <Input
                name="previous_exits_pct"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="Team previous exits %"
                value={form.previous_exits_pct}
                onChange={handleChange}
              />
            </div>

            <textarea
              name="intellectual_property"
              placeholder="Intellectual property (patents, applications, trade secrets, notes)"
              rows={3}
              className="w-full border rounded-md p-2"
              value={form.intellectual_property}
              onChange={handleChange}
            />

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="animate-spin h-5 w-5" /> : "Submit"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}