import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const investorPlans = [
  {
    name: "Basic",
    description: "Starter plan",
    price: "$0/mo",
    popular: false,
  },
  {
    name: "Premium",
    description: "Access to more startups",
    price: "$29/mo",
    popular: true,
  },
  {
    name: "VIP",
    description: "Full access to everything",
    price: "$99/mo",
    popular: false,
  },
];

const entrepreneurPlans = [
  {
    name: "Free",
    description: "Get started with basic platform access",
    price: "$0/mo",
    popular: false,
  },
  {
    name: "Premium",
    description: "Full access for serious fundraising",
    price: "$75/mo",
    popular: true,
  },
  {
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
    const storedProfile = JSON.parse(sessionStorage.getItem("profile"));
    const storedRole = sessionStorage.getItem("user_role");

    if (storedProfile) {
      setProfile(storedProfile);
      setCurrentPlan(storedProfile.plan || "");
      setSelectedPlan(storedProfile.plan || "");
    }

    if (storedRole) {
      setRole(storedRole);
    }
  }, []);

  const plans = role === "entrepreneur" ? entrepreneurPlans : investorPlans;

  const handleSave = () => {
    if (!profile || selectedPlan === currentPlan) return;

    const updated = { ...profile, plan: selectedPlan };
    sessionStorage.setItem("profile", JSON.stringify(updated));
    sessionStorage.setItem("registrationData", JSON.stringify(updated));
    sessionStorage.setItem("selected_plan", selectedPlan);
    setCurrentPlan(selectedPlan);
  };

  const handleCancel = () => {
    setSelectedPlan(currentPlan);
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6 text-center">Manage Your Subscription</h1>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-gray-800">Available Plans ({role})</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          {plans.map((plan, index) => {
            const isCurrent = plan.name === currentPlan;
            const isSelected = plan.name === selectedPlan;

            return (
              <Card
                key={index}
                className={`p-4 border rounded-lg transition relative ${
                  isCurrent
                    ? "bg-gray-100 border-gray-300 cursor-not-allowed opacity-70"
                    : "cursor-pointer hover:shadow-md " +
                      (isSelected ? "border-blue-600 ring-2 ring-blue-400" : "border-gray-200")
                }`}
                onClick={() => {
                  if (!isCurrent) setSelectedPlan(plan.name);
                }}
              >
                {plan.popular && (
                  <div className="mb-2">
                    <Badge className="bg-blue-600 text-white">Most Popular</Badge>
                  </div>
                )}
                <h2 className="text-xl font-semibold">{plan.name}</h2>
                <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                <div className="mt-2 font-bold text-gray-800">{plan.price}</div>
                {isCurrent && (
                  <p className="mt-2 text-sm text-gray-500 font-medium">Current Plan</p>
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
          <Button
            onClick={handleSave}
            disabled={selectedPlan === currentPlan}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}