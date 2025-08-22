// src/pages/EntrepreneurProfile.jsx  (DB-backed, fixed updates)
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import LocationAutocomplete from "../cmpnnts/Location";

// --- Supabase ---
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// --- helpers ---
const teamSizeOptionsDefault = [
  "1-2",
  "3-5",
  "6-10",
  "11-20",
  "21-50",
  "51-100",
  "100+",
];
const stageOptionsDefault = [
  "Idea",
  "Pre-seed",
  "Seed",
  "Series A",
  "Series B",
  "Series C",
  "Growth",
  "IPO",
];
const industryOptionsDefault = [
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

const csvToArray = (s) =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const arrayToCSV = (arr) => (Array.isArray(arr) ? arr.join(", ") : "");

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

const teamSizeToInt = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v);
  if (s.endsWith("+")) return parseInt(s, 10) || null;
  if (s.includes("-")) {
    const parts = s
      .split("-")
      .map((x) => parseInt(x, 10))
      .filter(Number.isFinite);
    return parts.length ? Math.max(...parts) : null;
  }
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};

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

export default function EntrepreneurProfile() {
  const navigate = useNavigate();

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [industryOptions] = useState(industryOptionsDefault);
  const [stageOptions] = useState(stageOptionsDefault);
  const [teamSizeOptions] = useState(teamSizeOptionsDefault);

  // DB identifiers we discover/create
  const [userId, setUserId] = useState(null);
  const [enterpriseId, setEnterpriseId] = useState(null);

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
    intellectual_property: "", // notes

    // NEW metrics
    mrr_usd: "",
    arr_usd: "",
    current_valuation_usd: "",
    current_investors: "", // CSV
    technical_founders_pct: "",
    previous_exits_pct: "",
  });

  // keep ARR auto-fill from MRR
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

  // ---------- Boot: load user -> enterprise -> startup_profile ----------
  useEffect(() => {
    (async () => {
      try {
        setBooting(true);
        setError(null);

        // 1) who is logged in
        const { data: sessionData, error: sessErr } =
          await supabase.auth.getSession();
        if (sessErr) throw sessErr;
        const sUser = sessionData?.session?.user;
        if (!sUser) throw new Error("Not authenticated. Please log in.");
        setUserId(sUser.id);

        // 2) get enterprise via membership (owner) — created in onboarding
        //    If for some reason it doesn't exist, we create a startup enterprise.
        let entId = null;

        const { data: memberships, error: memErr } = await supabase
          .from("enterprise_user")
          .select(
            `
            enterprise_id,
            role,
            is_active,
            enterprise:enterprise(id, name, location, enterprise_type)
          `
          )
          .eq("user_id", sUser.id)
          .eq("is_active", true);

        if (memErr) throw memErr;

        const owner = (memberships || []).find((m) => m.role === "owner");
        if (owner?.enterprise_id) {
          entId = owner.enterprise_id;
        }

        // create missing enterprise (startup) + membership
        if (!entId) {
          const first = sUser.user_metadata?.first_name || "";
          const last = sUser.user_metadata?.last_name || "";
          const fullName = (first + " " + last).trim();
          // ensure non-null name — avoid "null value in column 'name'"
          const fallbackName =
            fullName ||
            sUser.email ||
            `Startup ${String(sUser.id).slice(0, 8)}`;

          const { data: ent, error: entErr } = await supabase
            .from("enterprise")
            .insert({
              name: fallbackName,
              enterprise_type: "startup",
              status: "active",
            })
            .select("id")
            .single();
          if (entErr) throw entErr;
          entId = ent.id;

          const { error: linkErr } = await supabase
            .from("enterprise_user")
            .insert({
              enterprise_id: entId,
              user_id: sUser.id,
              role: "owner",
              is_active: true,
            });
          if (linkErr) throw linkErr;
        }

        setEnterpriseId(entId);

        // 3) load startup_profile, create if missing
        const { data: sp, error: spErr } = await supabase
          .from("startup_profile")
          .select("*")
          .eq("enterprise_id", entId)
          .single();

        let startup = sp;
        if (spErr && spErr.code === "PGRST116") {
          // not found -> create blank
          const { data: created, error: createErr } = await supabase
            .from("startup_profile")
            .insert({ enterprise_id: entId })
            .select("*")
            .single();
          if (createErr) throw createErr;
          startup = created;
        } else if (spErr) {
          throw spErr;
        }

        const tm = startup?.traction_metrics || {};

        // 3b) enterprise_profile (for headline_tags)
        const { data: ep } = await supabase
          .from("enterprise_profile")
          .select("headline_tags")
          .eq("enterprise_id", entId)
          .single();

        // 4) base enterprise data (name/location)
        const { data: entRow, error: entGetErr } = await supabase
          .from("enterprise")
          .select("name, location")
          .eq("id", entId)
          .single();
        if (entGetErr) throw entGetErr;

        // 5) hydrate the form from enterprise + startup_profile
        setForm((prev) => ({
          ...prev,
          name: entRow?.name || "",
          location: entRow?.location || "",
          // from traction_metrics JSON
          industry: tm.industry || "",
          stage: tm.stage || "",
          pitch_deck_url: tm.pitch_deck_url || "",
          demo_url: tm.demo_url || "",
          funding_needed: numberOrEmpty(tm.funding_needed),
          financials: {
            funding_goal: numberOrEmpty(tm?.financials?.funding_goal),
          },

          // structured columns from startup_profile
          team_size: pickTeamSizeOption(startup?.team_size ?? null),
          revenue_model: startup?.revenue_model || "",
          competitive_advantages: arrayToCSV(startup?.competitive_advantages),
          current_revenue: numberOrEmpty(startup?.current_revenue),
          monthly_growth_rate: numberOrEmpty(startup?.monthly_growth_rate),
          customer_count: numberOrEmpty(startup?.customer_count),
          market_size: numberOrEmpty(startup?.market_size),
          addressable_market: numberOrEmpty(startup?.addressable_market),
          intellectual_property:
            startup?.intellectual_property?.notes ??
            (startup?.intellectual_property
              ? JSON.stringify(startup.intellectual_property)
              : ""),
          business_model: startup?.business_model || "",
          target_market: startup?.target_market || "",
          mrr_usd: numberOrEmpty(startup?.mrr_usd),
          arr_usd: numberOrEmpty(startup?.arr_usd),
          current_valuation_usd: numberOrEmpty(startup?.current_valuation_usd),
          current_investors: arrayToCSV(startup?.current_investors),
          technical_founders_pct: numberOrEmpty(
            startup?.technical_founders_pct
          ),
          previous_exits_pct: numberOrEmpty(startup?.previous_exits_pct),

          // headline_tags from enterprise_profile
          headline_tags: arrayToCSV(ep?.headline_tags),
        }));
      } catch (e) {
        console.error("Boot error:", e);
        setError(e.message || "Failed to load profile.");
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  // ---------- submit (save to DB) ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId || !enterpriseId) return;

    setSaving(true);
    setError(null);

    try {
      // 0) First, update the enterprise row (name, location)
      //    This was the missing piece that made it look like updates never applied.
      {
        const safeName = (form.name || "").trim();
        const finalName = safeName || `Startup ${String(userId).slice(0, 8)}`; // ensure NOT NULL
        const { error: entUpErr } = await supabase
          .from("enterprise")
          .update({
            name: finalName,
            location: form.location || null,
          })
          .eq("id", enterpriseId);
        if (entUpErr) throw entUpErr;
      }

      // 1) read current traction_metrics so we can MERGE with deletes
      const { data: existingSP, error: readSpErr } = await supabase
        .from("startup_profile")
        .select("traction_metrics")
        .eq("enterprise_id", enterpriseId)
        .single();
      if (readSpErr && readSpErr.code !== "PGRST116") throw readSpErr;

      // helper: set or delete a top-level tm key
      const tmNext = { ...(existingSP?.traction_metrics ?? {}) };
      const setOrDelete = (key, rawVal) => {
        const val = typeof rawVal === "string" ? rawVal.trim() : rawVal;
        if (val === "" || val == null) {
          delete tmNext[key];
        } else {
          tmNext[key] = val;
        }
      };

      // primitive keys in traction_metrics
      setOrDelete("industry", form.industry);
      setOrDelete("stage", form.stage);
      setOrDelete("pitch_deck_url", form.pitch_deck_url);
      setOrDelete("demo_url", form.demo_url);
      setOrDelete("funding_needed", toNumber(form.funding_needed));

      // OPTIONAL: include problem_solved / traction_summary in traction_metrics
      setOrDelete("problem_solved", form.problem_solved);
      setOrDelete("traction_summary", form.traction_summary);

      // nested financials.funding_goal in traction_metrics
      const fg = toNumber(form.financials?.funding_goal);
      if (fg == null) {
        if (tmNext.financials) {
          delete tmNext.financials.funding_goal;
          if (Object.keys(tmNext.financials).length === 0)
            delete tmNext.financials;
        }
      } else {
        tmNext.financials = { ...(tmNext.financials || {}), funding_goal: fg };
      }

      // 2) structured columns go in startup_profile
      const startupPayload = {
        enterprise_id: enterpriseId,
        business_model: form.business_model || null,
        revenue_model: form.revenue_model || null,
        team_size: teamSizeToInt(form.team_size),
        current_revenue: toNumber(form.current_revenue),
        monthly_growth_rate: toNumber(form.monthly_growth_rate),
        customer_count: toNumber(form.customer_count),
        market_size: toNumber(form.market_size),
        addressable_market: toNumber(form.addressable_market),
        intellectual_property: form.intellectual_property
          ? { notes: form.intellectual_property }
          : null,
        target_market: form.target_market || null,
        mrr_usd: toNumber(form.mrr_usd),
        arr_usd:
          toNumber(form.arr_usd) ??
          (toNumber(form.mrr_usd) ? Number(form.mrr_usd) * 12 : null),
        current_valuation_usd: toNumber(form.current_valuation_usd),
        current_investors: csvToArray(form.current_investors), // empty -> []
        technical_founders_pct: toPct(form.technical_founders_pct),
        previous_exits_pct: toPct(form.previous_exits_pct),
        competitive_advantages: csvToArray(form.competitive_advantages), // empty -> []
        traction_metrics: tmNext, // <-- merged JSONB
      };

      // Upsert requires UPDATE permission under RLS when conflict is hit.
      const { error: spErr } = await supabase
        .from("startup_profile")
        .upsert(startupPayload, { onConflict: "enterprise_id" });
      if (spErr) throw spErr;

      // 3) headline_tags as ARRAY; allow clearing to []
      {
        const tags = csvToArray(form.headline_tags); // "" -> []
        const { error: epErr } = await supabase
          .from("enterprise_profile")
          .upsert(
            {
              enterprise_id: enterpriseId,
              headline_tags: tags.length ? tags : [],
            },
            { onConflict: "enterprise_id" }
          );
        if (epErr) throw epErr;
      }

      navigate("/dashboard/entrepreneur");
    } catch (err) {
      console.error("Profile save error:", err);
      setError(err.message || "Could not submit profile");
    } finally {
      setSaving(false);
    }
  };

  // ---------- complete later (skip for now) ----------
  const handleCompleteLater = async () => {
    try {
      // Mark user as not fully onboarded (optional but nice for gating UIs)
      const { data: sessionData } = await supabase.auth.getSession();
      const sUser = sessionData?.session?.user;
      if (sUser) {
        await supabase
          .from("users")
          .update({ onboarding_completed: false })
          .eq("id", sUser.id);
      }
    } catch (e) {
      // non-blocking; we still navigate
      console.warn("Complete later flag failed:", e?.message || e);
    } finally {
      navigate("/dashboard/entrepreneur");
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
            Entrepreneur Profile
          </CardTitle>
          <p className="text-sm text-gray-500">
            This version reads/writes to Supabase.
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
              onChange={(value) =>
                setForm((prev) => ({ ...prev, location: value }))
              }
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
                  financials: {
                    ...prev.financials,
                    funding_goal: e.target.value,
                  },
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

            <Input
              name="headline_tags"
              placeholder="Headline tags (comma-separated, e.g. AI, Fintech, DevTools)"
              value={form.headline_tags}
              onChange={handleChange}
            />

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
                min="0"
                max="100"
                placeholder="Technical founders %"
                value={form.technical_founders_pct}
                onChange={handleChange}
              />
              <Input
                name="previous_exits_pct"
                type="number"
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

            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pt-2">
              <Button
                type="submit"
                disabled={saving}
                className="w-full md:w-auto"
              >
                {saving ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  "Submit"
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full md:w-auto"
                onClick={handleCompleteLater}
              >
                Complete later
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
