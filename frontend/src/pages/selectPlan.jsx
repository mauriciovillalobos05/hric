import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ArrowLeft, ArrowRight, Building, Zap } from "lucide-react";

import { getPlansForRole, mapPlanToKey } from "./plan";

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

  const plans = getPlansForRole(role);

  const [selectedPlanName, setSelectedPlanName] = useState(
    sessionStorage.getItem("registrationPlanName") || ""
  );

  const handleSelect = (name) => {
    setSelectedPlanName(name);
    sessionStorage.setItem("registrationPlanName", name);
    const key = mapPlanToKey(role, name);
    if (key) sessionStorage.setItem("registrationPlanKey", key);
  };

  const handleContinue = () => {
    if (!selectedPlanName) return;

    sessionStorage.setItem("registrationRole", role);
    sessionStorage.setItem("registrationPlanName", selectedPlanName);
    const key = mapPlanToKey(role, selectedPlanName);
    if (key) sessionStorage.setItem("registrationPlanKey", key);

    navigate("/register");
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
                key={plan.key}
                className={`relative cursor-pointer transition-all duration-200 hover:shadow-md ${
                  selectedPlanName === plan.name
                    ? "border-blue-600 ring-2 bg-blue-50 ring-blue-500"
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