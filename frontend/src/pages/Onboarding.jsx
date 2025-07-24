// src/pages/Onboarding.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function LocationAutocomplete({ value = "", onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [inputValue, setInputValue] = useState(value);

  // Ensure query only updates on first render or external reset
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  useEffect(() => {
    if (!inputValue || inputValue.length < 2) {
      setSuggestions([]);
      return;
    }

    const fetchCities = async () => {
      try {
        const res = await fetch(
          `https://wft-geo-db.p.rapidapi.com/v1/geo/cities?namePrefix=${encodeURIComponent(
            inputValue
          )}&limit=5&sort=-population`,
          {
            method: "GET",
            headers: {
              "X-RapidAPI-Key":
                "965b5a8f84msh2cc329de9240607p1b4158jsn7bc2cea9220a",
              "X-RapidAPI-Host": "wft-geo-db.p.rapidapi.com",
            },
          }
        );
        const data = await res.json();
        setSuggestions(data.data || []);
      } catch (err) {
        console.error("GeoDB fetch error:", err);
        setSuggestions([]);
      }
    };

    const debounce = setTimeout(fetchCities, 300);
    return () => clearTimeout(debounce);
  }, [inputValue]);

  return (
    <div className="relative col-span-2">
      <Input
        placeholder="Location"
        value={inputValue}
        onChange={(e) => {
          const val = e.target.value;
          setInputValue(val);
          // Don't call onChange yet — only when a city is picked
        }}
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-10 bg-white border mt-1 rounded-md shadow-md w-full max-h-40 overflow-y-auto">
          {suggestions.map((city) => {
            const location = `${city.city}, ${city.region}, ${city.country}`;
            return (
              <li
                key={city.id}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => {
                  setInputValue(location); // updates input
                  onChange(location); // updates parent form
                  setSuggestions([]); // hide suggestions
                }}
              >
                {location}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
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
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const navigate = useNavigate();

  {
    /*useEffect(() => {
    const fetchSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        setAccessToken(session.access_token);
      } else {
        setError("No session found. Please login again.");
      }
      setLoading(false);
    };
    fetchSession();
  }, []);*/
  }

  useEffect(() => {
    const saved = JSON.parse(sessionStorage.getItem("registrationData"));
    const savedPlan = sessionStorage.getItem("selected_plan");
    if (saved) {
      setForm((prev) => ({
        ...prev,
        first_name: saved.firstName,
        last_name: saved.lastName,
        phone: saved.phone,
        email: saved.email,
        role: saved.role || "entrepreneur",
        plan: saved.plan || "",
      }));
    }
    setLoading(false);
  }, []);

  {
    /*const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let profileImagePath = null;
    console.log("Session token:", accessToken);

    try {
      if (!user || !user.id) throw new Error("User session not loaded");

      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `profile.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        console.log("Uploading file for user:", user.id);
        console.log("Uploading to:", filePath);

        const { error: uploadError } = await supabase.storage
          .from("profile-images")
          .upload(filePath, file, {
            upsert: true,
            cacheControl: "3600",
            contentType: file.type,
          });

        if (uploadError) throw uploadError;

        profileImagePath = filePath;
      }

      const payload = {
        ...form,
        profile_image: profileImagePath,
        supabase_id: user.id,
        email: user.email,
        user_type: user.user_metadata.role || "entrepreneur",
      };

      const res = await fetch(
        "http://localhost:8000/api/auth/register-complete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to save user");
      }

      localStorage.setItem("user_role", payload.user_type);
      navigate("/");
    } catch (err) {
      console.error("Upload/Register error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };*/
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const simulatedPayload = {
        ...form,
        profile_image: file ? URL.createObjectURL(file) : null,
        user_type: form.role || "entrepreneur",
      };

      // Store role so we can read it in MainUserDashboard
      sessionStorage.setItem("user_role", simulatedPayload.user_type);
      sessionStorage.setItem("profile", JSON.stringify(simulatedPayload));
      sessionStorage.setItem("selected_plan", form.plan);

      navigate("/dashboard/user");
    } catch (err) {
      console.error("Simulated error:", err);
      setError(err.message);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Complete Your Profile
          </CardTitle>
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
                      file
                        ? URL.createObjectURL(file)
                        : "/default-profile.png"
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
                {(form.role === "investor"
                  ? investorPlans
                  : entrepreneurPlans
                ).map((plan, index) => (
                  <Card
                    key={index}
                    className={`border relative cursor-pointer transition-all duration-200 hover:shadow-md ${form.plan === plan.name
                        ? "border-blue-600 ring-2 ring-blue-500"
                        : "border-gray-200"
                      }`}
                    onClick={() => {
                      setForm({ ...form, plan: plan.name });
                      const current = JSON.parse(sessionStorage.getItem("registrationData")) || {};
                      current.plan = plan.name;
                      sessionStorage.setItem("registrationData", JSON.stringify(current));
                    }}
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
