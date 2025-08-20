// =============================================
// FILE: transformFilters.jsx  (corrected)
// =============================================
const DEFAULT_ENTREPRENEUR_WEIGHTS = {
  industryFitWeight: 30,
  stageAlignmentWeight: 25,
  geoCoverageWeight: 15,
  checkSizeFitWeight: 20,
  decisionSpeedWeight: 5,
  verificationTrustWeight: 5,
  activityTrackRecordWeight: 0,
};

const asArray = (v) => (Array.isArray(v) ? v.filter(Boolean) : v && v !== "All" ? [v] : []);
const toNumber = (v, d = 0) => {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : d;
};

const normalizeTo100 = (weights) => {
  const sum = Object.values(weights).reduce((a, b) => a + (Number(b) || 0), 0);
  if (sum <= 0) return { ...DEFAULT_ENTREPRENEUR_WEIGHTS };
  const scaled = {};
  for (const k of Object.keys(DEFAULT_ENTREPRENEUR_WEIGHTS)) {
    const v = Number(weights[k] || 0);
    scaled[k] = Math.round((v / sum) * 100);
  }
  return scaled;
};

const normalizeTo01 = (weights100) => {
  const sum = Object.values(weights100).reduce((a, b) => a + (Number(b) || 0), 0) || 1;
  const out = {};
  for (const [k, v] of Object.entries(weights100)) out[k] = (Number(v) || 0) / sum;
  return out;
};

export default function transformFilters(filters = {}) {
  // --- Multi-selects
  const investorTypes = asArray(filters.investorTypes);
  const stagePreferences = asArray(filters.stagePreferences ?? filters.stagePreference);
  const industryPreferences = asArray(filters.industryPreferences ?? filters.industryPreference);
  const locationPreferences = asArray(filters.locationPreferences ?? filters.locationPreference);

  // --- Ranges & numerics
  const [checkSizeMin, checkSizeMax] = Array.isArray(filters.checkSizeRange)
    ? [toNumber(filters.checkSizeRange[0], 0), toNumber(filters.checkSizeRange[1], 1_000_000)]
    : [0, 1_000_000];

  const maxDecisionDays = toNumber(filters.maxDecisionDays, 30);
  const verifiedOnly = !!filters.verifiedOnly;
  const minTotalInvestments = toNumber(filters.minTotalInvestments, 0);
  const minSuccessfulExits = toNumber(filters.minSuccessfulExits, 0);
  const portfolioKeyword = (filters.portfolioKeyword || "").trim();
  const preferMyCity = !!filters.preferMyCity;

  // NEW: explicit raise target (maps to backend query ?raise_target_usd=)
  const raiseTargetUsd = toNumber(filters.raiseTargetUsd, 0);

  // --- Entrepreneur weights (UI keys) — fall back to defaults
  const rawWeights = {
    industryFitWeight: toNumber(filters.industryFitWeight, DEFAULT_ENTREPRENEUR_WEIGHTS.industryFitWeight),
    stageAlignmentWeight: toNumber(filters.stageAlignmentWeight, DEFAULT_ENTREPRENEUR_WEIGHTS.stageAlignmentWeight),
    geoCoverageWeight: toNumber(filters.geoCoverageWeight, DEFAULT_ENTREPRENEUR_WEIGHTS.geoCoverageWeight),
    checkSizeFitWeight: toNumber(filters.checkSizeFitWeight, DEFAULT_ENTREPRENEUR_WEIGHTS.checkSizeFitWeight),
    decisionSpeedWeight: toNumber(filters.decisionSpeedWeight, DEFAULT_ENTREPRENEUR_WEIGHTS.decisionSpeedWeight),
    verificationTrustWeight: toNumber(filters.verificationTrustWeight, DEFAULT_ENTREPRENEUR_WEIGHTS.verificationTrustWeight),
    activityTrackRecordWeight: toNumber(filters.activityTrackRecordWeight, DEFAULT_ENTREPRENEUR_WEIGHTS.activityTrackRecordWeight),
  };

  const weightSum = Object.values(rawWeights).reduce((a, b) => a + (Number(b) || 0), 0);
  const weightsNormalized100 = normalizeTo100(rawWeights);
  const weights01 = normalizeTo01(weightsNormalized100);

  // --- Build payload used by /matching/matches/entrepreneur
  return {
    // Filters (client-side or future server filters)
    investorTypes,
    stagePreferences,
    industryPreferences,
    locationPreferences,
    checkSizeMin,
    checkSizeMax,
    maxDecisionDays,
    verifiedOnly,
    minTotalInvestments,
    minSuccessfulExits,
    portfolioKeyword,
    preferMyCity,

    // Raise target for scoring
    raiseTargetUsd,

    // Weights
    weights: rawWeights,                 // raw (whatever user set)
    weightsNormalized100,                // sum to 100 (ints)
    weights01,                           // distribution 0..1
    weightSum,

    // Convenience: string for query param
    weightsParam: JSON.stringify(rawWeights),
  };
}

// Optional helper: turn the transformed output into query params for the entrepreneur route
export function toEntrepreneurQueryParams(tf, { minScore, order } = {}) {
  const qp = new URLSearchParams();
  if (tf?.weightsParam) qp.set("weights", tf.weightsParam);
  if (Number.isFinite(tf?.raiseTargetUsd) && tf.raiseTargetUsd > 0)
    qp.set("raise_target_usd", String(tf.raiseTargetUsd));
  if (Number.isFinite(minScore)) qp.set("min_score", String(minScore));
  if (order === "asc" || order === "desc") qp.set("order", order);
  return qp;
}