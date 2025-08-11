export default function transformFilters(filters = {}) {
  // normalize arrays vs legacy single-value fields
  const asArray = (v) =>
    Array.isArray(v) ? v
    : v && v !== "All" ? [v]
    : [];

  const stageArr    = asArray(filters.stagePreferences ?? filters.stagePreference);
  const industryArr = asArray(filters.industryPreferences ?? filters.industryPreference);
  const locationArr = asArray(filters.locationPreferences ?? filters.locationPreference);

  return {
    // existing weights
    revenueGrowthWeight: filters.revenueWeight || 0,
    teamExperienceWeight: filters.teamSizeWeight || 0,
    tractionWeight: filters.previousExitsWeight || 0,
    marketSizeWeight: filters.roiWeight || 0,
    geographyWeight: locationArr.length ? 10 : 0,
    techFoundersWeight: filters.technicalFoundersWeight || 0,

    // pass along normalized filters (arrays or "All")
    stagePreference:    stageArr.length    ? stageArr    : "All",
    industryPreference: industryArr.length ? industryArr : "All",
    locationPreference: locationArr.length ? locationArr : "All",
  };
}