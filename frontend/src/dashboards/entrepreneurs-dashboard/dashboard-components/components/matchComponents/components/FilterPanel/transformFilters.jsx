export default function transformFilters(filters) {
  return {
    // map UI slider names -> engine names
    revenueGrowthWeight: filters.revenueWeight || 0,
    teamExperienceWeight: filters.teamSizeWeight || 0,
    tractionWeight: filters.previousExitsWeight || 0,
    marketSizeWeight: filters.roiWeight || 0,
    geographyWeight: filters.locationPreference !== "All" ? 10 : 0,
    techFoundersWeight: filters.technicalFoundersWeight || 0,

    // keep these for filtering (engine may ignore them, but they’re handy to pass along)
    stagePreference: filters.stagePreference,
    locationPreference: filters.locationPreference,
    industryPreference: filters.industryPreference,
  };
}