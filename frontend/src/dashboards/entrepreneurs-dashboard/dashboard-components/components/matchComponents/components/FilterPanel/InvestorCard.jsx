// =============================================
// FILE: InvestorCard.jsx  (entrepreneur view)
// =============================================
import React, { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { saveSessionContactMeta } from "@/lib/investorMeta";
import {
  MapPin,
  Target,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";

// ---- Config & helpers ----
const rawBase =
  (import.meta?.env?.VITE_API_BASE_URL &&
    import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")) ||
  window.location.origin;
const API_BASE = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

function findBearerToken() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k)) {
        const v = JSON.parse(localStorage.getItem(k) || "null");
        const t =
          v?.currentSession?.access_token ||
          v?.access_token ||
          v?.currentToken?.access_token;
        if (t) return t;
      }
    }
    const fallbacks = ["sb-access-token", "access_token", "jwt", "token"];
    for (const key of fallbacks) {
      const t = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (t) return t;
    }
    const m = document.cookie.match(/(?:^|; )sb-access-token=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
    if (import.meta?.env?.VITE_DEV_BEARER_TOKEN)
      return import.meta.env.VITE_DEV_BEARER_TOKEN;
  } catch {}
  return null;
}

async function postInteraction({ matchId, action }) {
  const token = findBearerToken();
  if (!token || !matchId) return;
  try {
    const url = `${API_BASE}/matches/${matchId}/interact`;
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    });
  } catch {
    /* non-blocking */
  }
}

// Map internal component keys → nice labels
const COMPONENT_LABELS = {
  industry: "Industry Fit",
  stage: "Stage Alignment",
  location: "Geography",
  check_size_fit: "Check-size Fit",
  decision_speed: "Decision Speed",
  verification_trust: "Verification & Trust",
  activity: "Activity / Track Record",
};

// Normalize incoming prop so the JSX always has the fields it needs
// Final InvestorCardData shape we expect from backend (camelCase):
// {
//   id, name, type, location, logoUrl, isVerified,
//   industries[], stages[], thesis?, portfolioCompanies[],
//   matchScore, _raw?, _components?
// }
function normalizeInvestorShape(incoming) {
  if (!incoming) return {};
  const looksLikeMatch =
    typeof incoming === "object" &&
    (incoming.investor || incoming.match_id || incoming.view_score);

  const base = looksLikeMatch ? (incoming.investor || {}) : incoming;

  const _raw =
    base._raw ||
    (looksLikeMatch
      ? { match_id: incoming.match_id, score_breakdown: incoming.score_breakdown }
      : undefined);

  const _components =
    base._components ||
    (looksLikeMatch ? incoming.score_breakdown?.components : undefined) ||
    {};

  return {
    id: base.id || incoming?.investor_enterprise_id,
    name: base.name ?? null,
    type:
      (base.type && base.type.charAt(0).toUpperCase() + base.type.slice(1)) ||
      "Investor",
    location: base.location ?? null,
    logoUrl: base.logoUrl ?? null,
    isVerified: !!base.isVerified,

    industries: Array.isArray(base.industries) ? base.industries : [],
    stages: Array.isArray(base.stages) ? base.stages : [],
    thesis: base.thesis ?? null,
    portfolioCompanies: Array.isArray(base.portfolioCompanies)
      ? base.portfolioCompanies
      : [],

    matchScore:
      typeof base.matchScore === "number"
        ? base.matchScore
        : typeof incoming?.view_score === "number"
        ? incoming.view_score
        : 0,

    _raw,
    _components,
  };
}

const InvestorCard = ({
  investor,
  matchScore = 0,
  onSimulate,
  onToggleCompare,
  isActive = false,
  isCompared = false,
  // Back-compat
  onSelect,
  isSelected = false,
}) => {
  const navigate = useNavigate();

  // Normalize the shape so fields always exist for the JSX
  const inv = useMemo(() => normalizeInvestorShape(investor), [investor]);

  const matchId = inv?._raw?.match_id || null;
  const scoreBreakdown = inv?._raw?.score_breakdown || {};
  const reasons = Array.isArray(scoreBreakdown?.reasons) ? scoreBreakdown.reasons : [];
  const components = inv?._components || scoreBreakdown?.components || {};

  const effectiveMatchScore =
    Number.isFinite(matchScore) && matchScore > 0
      ? matchScore
      : Number(inv?.matchScore) || 0;

  // Focused console logs for the new shape
  useEffect(() => {
    const expectedKeys = [
      "id","name","type","location","logoUrl","isVerified",
      "industries","stages","thesis","portfolioCompanies","matchScore"
    ];
    const present = Object.keys(inv || {});
    const missing = expectedKeys.filter((k) => !present.includes(k));

    // eslint-disable-next-line no-console
    console.groupCollapsed(
      `[InvestorCard] Render: ${inv?.name || inv?.id || "(unknown)"}`
    );
    // eslint-disable-next-line no-console
    console.log("Incoming prop:", investor);
    // eslint-disable-next-line no-console
    console.log("Normalized (cardData):", inv);
    // eslint-disable-next-line no-console
    console.table({
      id: inv?.id,
      name: inv?.name,
      type: inv?.type,
      location: inv?.location,
      logoUrl: inv?.logoUrl,
      isVerified: inv?.isVerified,
      industries: inv?.industries?.length || 0,
      stages: inv?.stages?.length || 0,
      thesis: Boolean(inv?.thesis),
      portfolioCompanies: inv?.portfolioCompanies?.length || 0,
      matchScore: inv?.matchScore,
      matchId,
    });
    if (missing.length) {
      // eslint-disable-next-line no-console
      console.warn("Missing expected keys:", missing);
    }
    // eslint-disable-next-line no-console
    console.log("Components keys:", Object.keys(components || {}));
    // eslint-disable-next-line no-console
    console.log("Reasons:", reasons);
    // eslint-disable-next-line no-console
    console.groupEnd();
  }, [investor, inv, matchId, components, reasons]);

  const handleSimulate = () => {
    if (onSimulate) {
      onSimulate(inv);
      document.getElementById("montecarlo")?.scrollIntoView({ behavior: "smooth" });
    } else if (onSelect) {
      onSelect(inv);
    }
  };

  const handleToggleCompare = (e) => {
    e.stopPropagation();
    onToggleCompare?.(); // parent already bound investor.id
  };

  // Plan-gated contact button
  const planKey =
    sessionStorage.getItem("registrationPlanKey") ||
    localStorage.getItem("user_plan") ||
    "";
  const canContact = !/entrepreneur_free/i.test(planKey);

  const handleContact = async (e) => {
    e.stopPropagation();
    await postInteraction({ matchId, action: "message" });
    saveSessionContactMeta(inv);
    sessionStorage.setItem("startChatWith", inv?.name || "");
    navigate("/dashboard/entrepreneur?tab=messages");
  };

  // Like / Save / Reject handlers
  const handleLike = async (e) => {
    e.stopPropagation();
    await postInteraction({ matchId, action: "like" });
  };
  const handleSave = async (e) => {
    e.stopPropagation();
    await postInteraction({ matchId, action: "save" });
  };
  const handleReject = async (e) => {
    e.stopPropagation();
    await postInteraction({ matchId, action: "reject" });
  };

  const isCardActive = Boolean(isActive || isSelected);

  // Build component bars (only render those present)
  const componentEntries = Object.entries(COMPONENT_LABELS).filter(
    ([key]) => typeof components[key] === "number"
  );

  const getMatchColor = (score) => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 60) return "text-blue-600 bg-blue-50 border-blue-200";
    if (score >= 40) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getMatchLabel = (score) => {
    if (score >= 80) return "Excellent Match";
    if (score >= 60) return "Good Match";
    if (score >= 40) return "Fair Match";
    return "Poor Match";
  };

  return (
    <Card
      data-testid="investor-card"
      data-match-id={matchId || ""}
      onClick={handleSimulate}
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isCardActive
          ? "bg-blue-50 border-2 border-blue-500 ring-2 ring-blue-200 shadow-lg"
          : "bg-white border border-slate-200 hover:bg-slate-50 hover:shadow-md"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              {/* Optional logo */}
              {inv?.logoUrl && (
                <img
                  src={inv.logoUrl}
                  alt={inv?.name || "Investor"}
                  className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <div className="min-w-0">
                <CardTitle className="text-lg font-semibold text-gray-900 truncate">
                  {inv?.name || "Investor"}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {inv?.type || "Investor"}
                  </Badge>
                  {inv?.isVerified && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" /> Verified
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="text-right ml-3">
            <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getMatchColor(effectiveMatchScore)}`}>
              {Math.round(effectiveMatchScore)}% Match
            </div>
            <div className="text-xs text-gray-500 mt-1">{getMatchLabel(effectiveMatchScore)}</div>
          </div>
        </div>
      </CardHeader>

      {/* stopPropagation so buttons inside don't trigger card click */}
      <CardContent className="space-y-4" onClick={(e) => e.stopPropagation()}>
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-600 truncate">{inv?.location || "—"}</span>
          </div>
        </div>

        {/* Investment Focus */}
        {(Array.isArray(inv?.stages) || Array.isArray(inv?.industries)) && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Investment Focus</span>
            </div>
            {!!inv?.stages?.length && (
              <div className="flex flex-wrap gap-1">
                {inv.stages.map((stage, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {String(stage)}
                  </Badge>
                ))}
              </div>
            )}
            {!!inv?.industries?.length && (
              <div className="flex flex-wrap gap-1 mt-1">
                {inv.industries.slice(0, 3).map((ind, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {String(ind)}
                  </Badge>
                ))}
                {inv.industries.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{inv.industries.length - 3} more
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Thesis */}
        {inv?.thesis && (
          <p className="text-sm text-gray-600 italic">"{inv.thesis}"</p>
        )}

        {/* Component contribution bars */}
        {!!componentEntries.length && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Match components</div>
            <div className="space-y-2">
              {componentEntries.map(([key, label]) => {
                const v01 = Number(components[key]) || 0;
                const pct = Math.round(v01 * 100);
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{label}</span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Match Score Progress */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">Investment Likelihood</span>
            <span className="text-sm font-medium">{Math.round(effectiveMatchScore)}%</span>
          </div>
          <Progress value={effectiveMatchScore} className="h-2" />
        </div>

        {/* Notable Portfolio */}
        {!!inv?.portfolioCompanies?.length && (
          <div>
            <div className="text-sm text-gray-600 mb-1">Notable Portfolio:</div>
            <div className="text-sm text-gray-800">
              {inv.portfolioCompanies.slice(0, 3).join(", ")}
              {inv.portfolioCompanies.length > 3 &&
                ` +${inv.portfolioCompanies.length - 3} more`}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={handleSimulate}>Simulate</Button>

          <label className="text-xs inline-flex items-center gap-2 cursor-pointer select-none px-2 py-1 border rounded">
            <input
              type="checkbox"
              checked={isCompared}
              onChange={handleToggleCompare}
              onClick={(e) => e.stopPropagation()}
            />
            Compare
          </label>

          <Button size="sm" variant="secondary" onClick={handleLike} disabled={!matchId} title={matchId ? "" : "No match id"}>
            Like
          </Button>
          <Button size="sm" variant="outline" onClick={handleSave} disabled={!matchId} title={matchId ? "" : "No match id"}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={handleReject} disabled={!matchId} title={matchId ? "" : "No match id"}>
            Pass
          </Button>

          {isCardActive && (
            <span className="ml-auto text-[11px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Active
            </span>
          )}
        </div>

        {/* Contact (plan-gated) */}
        {canContact && (
          <div className="pt-2 flex justify-end">
            <Button size="sm" onClick={handleContact} disabled={!matchId}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Contact
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InvestorCard;