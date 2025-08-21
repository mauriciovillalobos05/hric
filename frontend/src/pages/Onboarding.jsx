import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import LocationAutocomplete from "./cmpnnts/Location";
import { fetchUserAndRole } from "@/helpers/role";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

export default function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);

  const [plans, setPlans] = useState([]);
  const [selectedPlanKey, setSelectedPlanKey] = useState("");

  // Only columns that exist in public.users
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    location: "", // ← NEW
    linkedin_url: "",
    twitter_url: "",
    website_url: "",
    bio: "",
    timezone: "UTC",
    language_preference: "en",
    role: "",
  });

  // Prefill from Supabase + load plans
  useEffect(() => {
    (async () => {
      try {
        const { user, role } = await fetchUserAndRole();
        if (!user) throw new Error("User not authenticated");

        setForm((prev) => ({
          ...prev,
          role,
          first_name: user.user_metadata?.first_name || "",
          last_name: user.user_metadata?.last_name || "",
          phone: user.user_metadata?.phone || "",
          location: user.user_metadata?.location || "",
        }));

        const res = await fetch(`${API_BASE}/api/subscriptions/plans`);
        const json = await res.json();
        const activePlans = Array.isArray(json.plans) ? json.plans : [];
        setPlans(activePlans);
      } catch (e) {
        console.error(e);
        setError(e.message || "Failed to load user");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visiblePlans = plans.filter((p) => {
    if (!form.role) return false;
    const prefix = form.role === "investor" ? "investor_" : "entrepreneur_";
    return (p.plan_key || "").startsWith(prefix);
  });

  const prettyPrice = (num) => {
    const n = Number(num || 0);
    if (!isFinite(n) || n <= 0) return "$0";
    return `$${n}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("User session expired");

      if (!selectedPlanKey) {
        throw new Error("Please choose a plan to continue.");
      }

      // Optional avatar upload
      let profileImagePath = null;
      if (file) {
        const ext = file.name.split(".").pop();
        const filename = `profile.${ext}`;
        const filepath = `${user.id}/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-images")
          .upload(filepath, file, { upsert: true });
        if (uploadError) throw uploadError;
        profileImagePath = filepath;
      }

      // Persist role/plan in Supabase metadata (client convenience)
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          role: form.role,
          plan: selectedPlanKey,
          location: form.location || null,
        },
      });
      if (metadataError) throw metadataError;

      // Build clean payload with trimming
      const payload = {
        first_name: (form.first_name || "").trim(),
        last_name: (form.last_name || "").trim(),
        phone: (form.phone || "").trim(),
        location: (form.location || "").trim(), // ← NEW
        linkedin_url: (form.linkedin_url || "").trim(),
        twitter_url: (form.twitter_url || "").trim(),
        website_url: (form.website_url || "").trim(),
        bio: (form.bio || "").trim(),
        timezone: form.timezone || "UTC",
        language_preference: form.language_preference || "en",
        profile_image_url: profileImagePath, // may be null if not uploaded
      };

      // Update users table
      const profileRes = await fetch(`${API_BASE}/api/auth/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!profileRes.ok) {
        const t = await profileRes.text();
        throw new Error(t || "Failed to save profile");
      }

      // INSERT enterprise + profile block here
      const fullName = `${(form.first_name || "").trim()} ${(
        form.last_name || ""
      ).trim()}`.trim();
      const enterprise_type = form.role === "investor" ? "investor" : "startup";

      // 1) enterprise
      const { data: ent, error: entErr } = await supabase
        .from("enterprise")
        .insert({
          name: fullName || user.email,
          enterprise_type,
          location: form.location || null,
          status: "active",
        })
        .select("id")
        .single();
      if (entErr) throw entErr;

      // 2) enterprise_user link
      const { error: linkErr } = await supabase.from("enterprise_user").insert({
        enterprise_id: ent.id,
        user_id: user.id,
        role: "owner",
        is_active: true,
      });
      if (linkErr) throw linkErr;

      // 3) role-specific profile
      if (enterprise_type === "investor") {
        const { error } = await supabase.from("investor_profile").insert({
          enterprise_id: ent.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("startup_profile").insert({
          enterprise_id: ent.id,
        });
        if (error) throw error;
      }

      // 4) convenience: store enterprise_id back to auth metadata
      await supabase.auth.updateUser({
        data: {
          role: enterprise_type === "investor" ? "investor" : "entrepreneur",
          enterprise_id: ent.id,
        },
      });

      // Create Stripe checkout session (or redirect for free plans)
      const checkoutRes = await fetch(
        `${API_BASE}/api/subscriptions/checkout`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            plan_key: selectedPlanKey,
            billing_interval: "monthly",
          }),
        }
      );

      const resp = await checkoutRes.json().catch(() => ({}));
      if (!checkoutRes.ok) {
        throw new Error(resp.error || "Failed to create Stripe session");
      }

      if (resp.checkout_url) {
        window.location.href = resp.checkout_url;
        return;
      }
      if (resp.redirect_url) {
        window.location.href = resp.redirect_url;
        return;
      }

      navigate(
        form.role === "investor"
          ? "/dashboard/investor"
          : "/dashboard/entrepreneur"
      );
    } catch (err) {
      console.error("Onboarding error:", err);
      setError(err.message || "Failed to complete onboarding");
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Complete Your Profile
          </CardTitle>
          <p className="text-sm text-blue-700 mt-1">
            You are signing up as: <strong>{form.role === "startup" ? "entrepreneur" : form.role}</strong>
          </p>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* Avatar */}
            <div className="col-span-2 flex justify-center">
              <label className="relative cursor-pointer group">
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files[0])}
                />
                <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-gray-300 group-hover:ring-2 group-hover:ring-blue-400 transition-all">
                  <img
                    src={
                      file ? URL.createObjectURL(file) : "/default-profile.png"
                    }
                    alt="Profile Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute bottom-0 w-full text-center text-xs text-gray-600 bg-white/70 py-1 rounded-b-full">
                  Change
                </div>
              </label>
            </div>

            {/* Required fields */}
            <Input
              placeholder="First Name"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
            />
            <Input
              placeholder="Last Name"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              required
            />

            {/* Optional columns in users */}
            <Input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <LocationAutocomplete
              placeholder="Location (City, State, Country)"
              value={form.location}
              onChange={(loc) => setForm({ ...form, location: loc })}
            />
            <Input
              placeholder="LinkedIn URL"
              value={form.linkedin_url}
              onChange={(e) =>
                setForm({ ...form, linkedin_url: e.target.value })
              }
            />
            <Input
              placeholder="Twitter URL"
              value={form.twitter_url}
              onChange={(e) =>
                setForm({ ...form, twitter_url: e.target.value })
              }
            />
            <Input
              placeholder="Website URL"
              value={form.website_url}
              onChange={(e) =>
                setForm({ ...form, website_url: e.target.value })
              }
            />
            <textarea
              placeholder="Short Bio"
              className="col-span-2 border rounded-md p-2"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={4}
            />

            {/* Preferences */}
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="w-full border rounded-md p-2"
            >
              <option value="UTC">Timezone: UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Madrid">Europe/Madrid</option>
            </select>
            <select
              value={form.language_preference}
              onChange={(e) =>
                setForm({ ...form, language_preference: e.target.value })
              }
              className="w-full border rounded-md p-2"
            >
              <option value="en">Language: English</option>
              <option value="es">Language: Spanish</option>
              <option value="fr">Language: French</option>
            </select>

            {/* Plan selection */}
            <div className="col-span-2">
              <h3 className="text-lg font-semibold mb-2">Choose Your Plan</h3>

              {visiblePlans.length === 0 && (
                <p className="text-sm text-gray-600">
                  No active plans found for your role yet.
                </p>
              )}

              <div className="grid md:grid-cols-3 gap-4">
                {visiblePlans.map((plan) => (
                  <Card
                    key={plan.id}
                    className={`border relative cursor-pointer transition-all hover:shadow-md ${
                      selectedPlanKey === plan.plan_key
                        ? "border-blue-600 ring-2 ring-blue-500"
                        : "border-gray-200"
                    }`}
                    onClick={() => setSelectedPlanKey(plan.plan_key)}
                  >
                    {plan.features?.includes?.("popular") && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-blue-600 text-white px-3 py-1">
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-4">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <div className="mt-2">
                        <span className="text-2xl font-bold text-gray-900">
                          {prettyPrice(plan.monthly_price)}
                        </span>
                        <span className="text-gray-600">/month</span>
                      </div>
                      {plan.description && (
                        <p className="text-sm mt-2 text-gray-600">
                          {plan.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <ul className="text-sm text-gray-700 space-y-1">
                        {(plan.features || []).slice(0, 6).map((f) => (
                          <li key={String(f)}>• {String(f)}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Button type="submit" className="col-span-2" disabled={loading}>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Save & Continue"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
