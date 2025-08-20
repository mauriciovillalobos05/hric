export default function transformFilters(filters = {}) {
  const asArray = (v) =>
    Array.isArray(v) ? v : v && v !== "All" ? [v] : [];

  const stageArr    = asArray(filters.stagePreferences ?? filters.stagePreference);
  const industryArr = asArray(filters.industryPreferences ?? filters.industryPreference);
  const locationArr = asArray(filters.locationPreferences ?? filters.locationPreference);

  // Map UI slider keys to internal component keys (percent values as-is; renormalize client/server)
  const weights = {
    roi: filters.roiWeight || 0,
    technical_founders: filters.technicalFoundersWeight || 0,
    previous_exits: filters.previousExitsWeight || 0,
    revenue: filters.revenueWeight || 0,
    team_size: filters.teamSizeWeight || 0,
    currently_raising: filters.currentlyRaisingWeight || 0,
  };

  return {
    // (legacy aliases kept if something else reads them)
    revenueGrowthWeight: filters.revenueWeight || 0,
    teamExperienceWeight: filters.teamSizeWeight || 0,
    tractionWeight: filters.previousExitsWeight || 0,
    marketSizeWeight: filters.roiWeight || 0,
    geographyWeight: locationArr.length ? 10 : 0,
    techFoundersWeight: filters.technicalFoundersWeight || 0,

    // Normalized filters (arrays or "All")
    stagePreference:    stageArr.length    ? stageArr    : "All",
    industryPreference: industryArr.length ? industryArr : "All",
    locationPreference: locationArr.length ? locationArr : "All",

    // New: bundle the internal weights so you can send to backend or use locally
    weights,
  };
}