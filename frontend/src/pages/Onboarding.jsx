// src/pages/Onboarding.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import LocationAutocomplete from "./cmpnnts/Location";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);



function mapPlanToKey(role, planName) {
  const normalized = planName.toLowerCase();

  if (role === "investor") {
    if (normalized === "basic") return "investor_basic";
    if (normalized === "premium") return "investor_premium";
    if (normalized === "vip") return "investor_vip";
  } else if (role === "entrepreneur") {
    if (normalized === "free") return "entrepreneur_free";
    if (normalized === "premium") return "entrepreneur_premium";
    if (normalized === "enterprise") return "entrepreneur_enterprise";
  }

  return null;
}

export default function Onboarding() {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    location: "",
    linkedin_url: "",
    website_url: "",
    bio: "",
    plan: "",
    role: "",
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Fetch user and role on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!user) throw new Error("User not authenticated");

        const metadata = user.user_metadata || {};
        const role =
          metadata.role ||
          sessionStorage.getItem("registrationRole") ||
          "entrepreneur";

        setForm((prev) => ({
          ...prev,
          email: user.email,
          role,
          first_name: metadata.first_name || "",
          last_name: metadata.last_name || "",
          phone: metadata.phone || "",
        }));

        sessionStorage.removeItem("registrationRole");
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("User not authenticated");

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

      // Update Supabase metadata
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          role: form.role,
          plan: mapPlanToKey(form.role, form.plan),
        },
      });
      if (metadataError) throw metadataError;

      // Upsert into your user table
      const { error: dbError } = await supabase.from("user").upsert({
        id: user.id,
        email: user.email,
        role: form.role,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        location: form.location,
        linkedin_url: form.linkedin_url,
        website_url: form.website_url,
        bio: form.bio,
        profile_image: profileImagePath,
      });

      if (dbError) throw dbError;

      // Request Stripe checkout session from your backend
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) throw new Error("User session expired");

      const response = await fetch(
        "http://127.0.0.1:8000/subscriptions/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            Accept: "application/json",
          },
          body: JSON.stringify({
            plan: mapPlanToKey(form.role, form.plan),
          }),
        }
      );

      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (!response.ok || !data.checkout_url) {
          throw new Error(data.error || "Failed to create Stripe session");
        }
        window.location.href = data.checkout_url;
      } catch (parseErr) {
        console.error("Could not parse backend error:", text);
        throw new Error("Server error. Please check the console.");
      }

      const data = await response.json();

      if (!response.ok || !data.checkout_url) {
        throw new Error(data.error || "Failed to create Stripe session");
      }

      window.location.href = data.checkout_url;

      // Navigate to appropriate dashboard
      localStorage.setItem("user_role", form.role);
      navigate(
        form.role === "investor"
          ? "/dashboard/investor"
          : "/dashboard/entrepreneur"
      );
      sessionStorage.removeItem("registrationRole");
    } catch (err) {
      console.error("Onboarding error:", err);
      setError(err.message || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  const investorPlans = [
    {
      name: "Basic",
      price: "$50",
      period: "/month",
      description: "Perfect for casual investors exploring opportunities",
      features: [
        "Basic profile creation",
        "Startup browsing",
        "Limited matching (10/month)",
        "Basic messaging (50/month)",
        "Event notifications",
        "Document downloads (5/month)",
      ],
      popular: false,
    },
    {
      name: "Premium",
      price: "$150",
      period: "/month",
      description: "Ideal for active investors seeking quality deals",
      features: [
        "All Basic features",
        "Unlimited matching",
        "Advanced search filters",
        "Priority customer support",
        "Investment tracking tools",
        "Market insights reports",
        "Unlimited messaging & downloads",
      ],
      popular: true,
    },
    {
      name: "VIP",
      price: "$300",
      period: "/month",
      description: "Premium service for serious high-net-worth investors",
      features: [
        "All Premium features",
        "Personal investment advisor",
        "Exclusive deal access",
        "Free event attendance",
        "Custom matching criteria",
        "Direct founder introductions",
        "White-glove support",
      ],
      popular: false,
    },
  ];

  const entrepreneurPlans = [
    {
      name: "Free",
      price: "$0",
      period: "/month",
      description: "Get started with basic platform access",
      features: [
        "Basic profile creation",
        "Limited investor browsing",
        "Basic messaging",
        "3 matches per month",
        "3 document uploads",
        "Community access",
      ],
      popular: false,
    },
    {
      name: "Premium",
      price: "$75",
      period: "/month",
      description: "Full access for serious fundraising",
      features: [
        "Full profile creation",
        "Unlimited investor browsing",
        "Priority matching",
        "Analytics dashboard",
        "Pitch practice tools",
        "Unlimited uploads & matches",
      ],
      popular: true,
    },
    {
      name: "Enterprise",
      price: "$200",
      period: "/month",
      description: "Advanced features for established companies",
      features: [
        "All Premium features",
        "Dedicated success manager",
        "Custom branding",
        "API access",
        "White-label solutions",
        "Enterprise showcases",
      ],
      popular: false,
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin h-6 w-6 text-gray-600" />
      </div>
    );
  }

  const plans = form.role === "investor" ? investorPlans : entrepreneurPlans;

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
                <div className="absolute bottom-0 w-full text-center text-xs text-gray-600 bg-white bg-opacity-70 py-1 rounded-b-full">
                  Change
                </div>
              </label>
            </div>
            <LocationAutocomplete
              value={form.location}
              onChange={(value) => setForm({ ...form, location: value })}
            />
            <Input
              placeholder="LinkedIn URL"
              value={form.linkedin_url}
              onChange={(e) =>
                setForm({ ...form, linkedin_url: e.target.value })
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
            <div className="col-span-2">
              <h3 className="text-lg font-semibold mb-2">Choose Your Plan</h3>
              <div className="grid md:grid-cols-3 gap-4">
                {plans.map((plan, index) => (
                  <Card
                    key={index}
                    className={`border relative cursor-pointer transition-all duration-200 hover:shadow-md ${
                      form.plan === plan.name
                        ? "border-blue-600 ring-2 ring-blue-500"
                        : "border-gray-200"
                    }`}
                    onClick={() => setForm({ ...form, plan: plan.name })}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-blue-600 text-white px-3 py-1">
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-4">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <div className="mt-2">
                        <span className="text-2xl font-bold text-gray-900">
                          {plan.price}
                        </span>
                        <span className="text-gray-600">{plan.period}</span>
                      </div>
                      <p className="text-sm mt-2 text-gray-600">
                        {plan.description}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-sm text-gray-700 space-y-1">
                        {plan.features.slice(0, 4).map((f, i) => (
                          <li key={i}>• {f}</li>
                        ))}
                        {plan.features.length > 4 && (
                          <li className="text-blue-500">+ more</li>
                        )}
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
