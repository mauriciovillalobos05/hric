import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ArrowLeft, ArrowRight, Building, Zap } from "lucide-react";

/**
 * Keep this in sync with the mapping in Onboarding.jsx
 */
function mapPlanToKey(role, planName) {
  const normalized = (planName || "").toLowerCase();
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

/**
 * Plans copied from Onboarding.jsx to avoid surprises.
 * (If you prefer DRY, move these to a shared `plans.js` and import both places.)
 */
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

export default function SelectPlan() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // role source of truth: query ? sessionStorage ? default
  const urlRole = params.get("role");
  const storedRole = sessionStorage.getItem("registrationRole");
  const role = useMemo(
    () => (urlRole || storedRole || "entrepreneur").toLowerCase(),
    [urlRole, storedRole]
  );

  // Keep role in sessionStorage so following pages can read it
  useEffect(() => {
    sessionStorage.setItem("registrationRole", role);
  }, [role]);

  const plans = role === "investor" ? investorPlans : entrepreneurPlans;
  const [selectedPlanName, setSelectedPlanName] = useState(
    sessionStorage.getItem("registrationPlanName") || ""
  );

  const handleSelect = (name) => {
    setSelectedPlanName(name);
    // Save immediately so refreshes don't lose it
    sessionStorage.setItem("registrationPlanName", name);
    const key = mapPlanToKey(role, name);
    if (key) sessionStorage.setItem("registrationPlanKey", key);
  };

  const handleContinue = () => {
    if (!selectedPlanName) return;

    // Ensure we have both name + key in session storage
    sessionStorage.setItem("registrationRole", role);
    sessionStorage.setItem("registrationPlanName", selectedPlanName);
    const key = mapPlanToKey(role, selectedPlanName);
    if (key) sessionStorage.setItem("registrationPlanKey", key);

    // Redirect to the appropriate dashboard
    navigate(role === "investor" ? "/dashboard/investor" : "/dashboard/entrepreneur");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-4xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Choose Your Plan
          </CardTitle>
          <p className="text-sm text-blue-700 mt-1 flex items-center justify-center gap-2">
            {role === "investor" ? (
              <>
                <Building className="h-4 w-4" /> You are joining as: <strong>Investor</strong>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" /> You are applying as: <strong>Entrepreneur</strong>
              </>
            )}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative cursor-pointer transition-all duration-200 hover:shadow-md ${
                  selectedPlanName === plan.name
                    ? "border-blue-600 ring-2 ring-blue-500"
                    : "border-gray-200"
                }`}
                onClick={() => handleSelect(plan.name)}
              >
                {plan.popular && (
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

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleContinue}
              disabled={!selectedPlanName}
              className="min-w-[160px]"
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}