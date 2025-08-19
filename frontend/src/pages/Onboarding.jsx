import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import LocationAutocomplete from "./cmpnnts/Location";
import { AuthBridge } from "@/helpers/authBridge";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const USE_SUPABASE_ONBOARDING = false; // keep on, but read/write session too

const API_BASE = USE_SUPABASE_ONBOARDING
  ? (import.meta.env.VITE_API_URL?.replace(/\/$/, "") || `${window.location.protocol}//${window.location.hostname}:5173`)
  : "";

export default function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [plans, setPlans] = useState([]);
  const [selectedPlanKey, setSelectedPlanKey] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    location: "",
    linkedin_url: "",
    twitter_url: "",
    website_url: "",
    bio: "",
    timezone: "UTC",
    language_preference: "en",
    role: "",
  });

  // Prefill from Supabase *or* session
  useEffect(() => {
    (async () => {
      try {
        let meta = {};
        if (USE_SUPABASE_ONBOARDING) {
          const {
            data: { user },
            error,
          } = await supabase.auth.getUser();
          if (user && !error) meta = user.user_metadata || {};
        }
        const sessionUser = AuthBridge.getSessionUser();
        const role =
          meta.role ||
          sessionStorage.getItem("registrationRole") ||
          sessionUser.role ||
          "entrepreneur";
        setForm((prev) => ({
          ...prev,
          role,
          first_name: meta.first_name || sessionUser.firstName || "",
          last_name: meta.last_name || sessionUser.lastName || "",
          phone: meta.phone || sessionUser.phone || "",
          location: meta.location || sessionUser.location || "",
        }));

        // Plans: try API, else mock
        try {
          const res = await fetch(`${API_BASE}/api/subscriptions/plans`);
          const json = await res.json();
          const activePlans = Array.isArray(json.plans) ? json.plans : [];
          setPlans(activePlans);
        } catch {
          setPlans([
            {
              id: "p1",
              name: "Starter",
              monthly_price: 0,
              description: "Free",
              plan_key:
                role === "investor"
                  ? "investor_starter"
                  : "entrepreneur_starter",
              features: ["popular"],
            },
            {
              id: "p2",
              name: "Pro",
              monthly_price: 49,
              description: "Pro features",
              plan_key:
                role === "investor" ? "investor_pro" : "entrepreneur_pro",
              features: ["priority support"],
            },
          ]);
        }

        sessionStorage.removeItem("registrationRole");
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
      // Write-through: update session user profile regardless
      const email = AuthBridge.getCurrentEmail();
      AuthBridge.setSessionUser(email, {
        firstName: form.first_name,
        lastName: form.last_name,
        phone: form.phone,
        location: form.location,
        role: form.role,
        profile: {
          linkedin_url: form.linkedin_url,
          twitter_url: form.twitter_url,
          website_url: form.website_url,
          bio: form.bio,
          timezone: form.timezone,
          language_preference: form.language_preference,
          plan_key: selectedPlanKey,
        },
        // Store role-based profile so dashboards can hydrate immediately
        ...(form.role === "investor"
          ? {
              investorProfile: {
                name: `${form.first_name} ${form.last_name}`.trim(),
              },
            }
          : {}),
        ...(form.role !== "investor"
          ? {
              entrepreneurProfile: {
                name: `${form.first_name} ${form.last_name}`.trim(),
              },
            }
          : {}),
      });
      AuthBridge.setAuthSession(email, {
        provider:
          AuthBridge.ssRead(AuthBridge.STORAGE_KEYS.SESSION)?.provider ||
          "local",
      });

      if (USE_SUPABASE_ONBOARDING) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (user && accessToken) {
          // optional metadata sync
          await supabase.auth
            .updateUser({
              data: {
                role: form.role,
                plan: selectedPlanKey,
                location: form.location || null,
              },
            })
            .catch(() => {});
          // optional profile API call
          await fetch(`${API_BASE}/api/auth/profile`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              first_name: (form.first_name || "").trim(),
              last_name: (form.last_name || "").trim(),
              phone: (form.phone || "").trim(),
              location: (form.location || "").trim(),
              linkedin_url: (form.linkedin_url || "").trim(),
              twitter_url: (form.twitter_url || "").trim(),
              website_url: (form.website_url || "").trim(),
              bio: (form.bio || "").trim(),
              timezone: form.timezone || "UTC",
              language_preference: form.language_preference || "en",
              profile_image_url: null,
            }),
          }).catch(() => {});

          // optional checkout; if not available, just navigate
          try {
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
            if (checkoutRes.ok && (resp.checkout_url || resp.redirect_url)) {
              window.location.href = resp.checkout_url || resp.redirect_url;
              return;
            }
          } catch {}
        }
      }

      // Navigate by role
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
            You are signing up as: <strong>{form.role}</strong>
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
