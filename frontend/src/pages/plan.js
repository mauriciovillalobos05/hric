// plans.js
// Shared plan definitions + helpers used across the app (Onboarding, SelectPlan, gating, etc.)

export const PLAN_KEYS = {
  investor: {
    basic: "investor_basic",
    premium: "investor_premium",
    vip: "investor_vip",
  },
  entrepreneur: {
    free: "entrepreneur_free",
    premium: "entrepreneur_premium",
    enterprise: "entrepreneur_enterprise",
  },
};

const norm = (s) => (s || "").toString().trim().toLowerCase();

export function mapPlanToKey(role, planName) {
  const r = norm(role);
  const p = norm(planName);
  if (r === "investor") return PLAN_KEYS.investor[p] || null;
  if (r === "entrepreneur") return PLAN_KEYS.entrepreneur[p] || null;
  return null;
}

export const investorPlans = [
  {
    key: PLAN_KEYS.investor.basic,
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
    key: PLAN_KEYS.investor.premium,
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
    key: PLAN_KEYS.investor.vip,
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

export const entrepreneurPlans = [
  {
    key: PLAN_KEYS.entrepreneur.free,
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
    key: PLAN_KEYS.entrepreneur.premium,
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
    key: PLAN_KEYS.entrepreneur.enterprise,
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

export function getPlansForRole(role) {
  return norm(role) === "investor" ? investorPlans : entrepreneurPlans;
}