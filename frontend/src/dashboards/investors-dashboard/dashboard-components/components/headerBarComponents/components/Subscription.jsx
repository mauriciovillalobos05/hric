import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
const investorPlans = [
  {
    key: "investor_basic",
    name: "Basic",
    description: "Starter plan",
    price: "$0/mo",
    popular: false,
  },
  {
    key: "investor_premium",
    name: "Premium",
    description: "Access to more startups",
    price: "$29/mo",
    popular: true,
  },
  {
    key: "investor_vip",
    name: "VIP",
    description: "Full access to everything",
    price: "$99/mo",
    popular: false,
  },
];

const entrepreneurPlans = [
  {
    key: "entrepreneur_free",
    name: "Free",
    description: "Get started with basic platform access",
    price: "$0/mo",
    popular: false,
  },
  {
    key: "entrepreneur_premium",
    name: "Premium",
    description: "Full access for serious fundraising",
    price: "$75/mo",
    popular: true,
  },
  {
    key: "entrepreneur_enterprise",
    name: "Enterprise",
    description: "Advanced features for established companies",
    price: "$200/mo",
    popular: false,
  },
];

export default function Subscription() {
  const [currentPlan, setCurrentPlan] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [role, setRole] = useState("investor");
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSubscriptionData = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) throw new Error("User not authenticated");

        const role = user.user_metadata?.role || "investor";

        // Fetch subscription by user ID
        const { data: subscriptions, error: subError } = await supabase
          .from("subscription")
          .select("tier")
          .eq("user_id", user.id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subError) throw subError;

        const currentTier = subscriptions?.tier || "";

        setRole(role);
        setCurrentPlan(currentTier);
        setSelectedPlan(currentTier);
      } catch (err) {
        console.error("Error loading subscription data:", err);
      }
    };

    fetchSubscriptionData();
  }, []);

  const plans = role === "entrepreneur" ? entrepreneurPlans : investorPlans;

  const handleSave = async () => {
    if (selectedPlan === currentPlan) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("User not authenticated");

      const response = await fetch(
        "http://127.0.0.1:8000/subscriptions/checkout",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ plan: selectedPlan }),
        }
      );

      const data = await response.json();

      if (!response.ok)
        throw new Error(data.error || "Failed to start checkout");

      if (data.checkout_url) {
        // Redirect to Stripe
        window.location.href = data.checkout_url;
      } else if (data.redirect_url) {
        // Handle free plan (e.g., entrepreneur_free)
        navigate("/dashboard/user");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Failed to start payment. Please try again.");
    }
  };

  const handleCancel = () => {
    setSelectedPlan(currentPlan);
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6 text-center">
        Manage Your Subscription
      </h1>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-gray-800">
            Available Plans ({role})
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          {plans.map((plan, index) => {
            const isCurrent = plan.key === currentPlan;
            const isSelected = plan.key === selectedPlan;
            return (
              <Card
                key={index}
                className={`p-4 border rounded-lg transition relative ${
                  isCurrent
                    ? "bg-gray-100 border-gray-300 cursor-not-allowed opacity-70"
                    : "cursor-pointer hover:shadow-md " +
                      (isSelected
                        ? "border-blue-600 ring-2 ring-blue-400"
                        : "border-gray-200")
                }`}
                onClick={() => {
                  if (!isCurrent) setSelectedPlan(plan.key);
                }}
              >
                {plan.popular && (
                  <div className="mb-2">
                    <Badge className="bg-blue-600 text-white">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <h2 className="text-xl font-semibold">{plan.name}</h2>
                <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                <div className="mt-2 font-bold text-gray-800">{plan.price}</div>
                {isCurrent && (
                  <p className="mt-2 text-sm text-gray-500 font-medium">
                    Current Plan
                  </p>
                )}
              </Card>
            );
          })}
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/dashboard/user")}>
          Back to Dashboard
        </Button>
        <div className="space-x-3">
          <Button
            variant="secondary"
            onClick={handleCancel}
            disabled={selectedPlan === currentPlan}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={selectedPlan === currentPlan}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
