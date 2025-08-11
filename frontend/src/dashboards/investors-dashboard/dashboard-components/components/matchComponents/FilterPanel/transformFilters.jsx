export default function transformFilters(f = {}) {
  const out = {
    roiWeight: f.roiWeight ?? 0,
    technicalFoundersWeight: f.technicalFoundersWeight ?? 0,
    previousExitsWeight: f.previousExitsWeight ?? 0,
    revenueWeight: f.revenueWeight ?? 0,
    teamSizeWeight: f.teamSizeWeight ?? 0,
    currentlyRaisingWeight: f.currentlyRaisingWeight ?? 0,

    // simple filters (server stores alongside weights)
    stagePreference: f.stagePreference ?? "All",
    locationPreference: f.locationPreference ?? "All",
    industryPreference: f.industryPreference ?? "All",
    userType: f.userType ?? null,
  };

  // legacy aliases (optional)
  out.revenueGrowthWeight  = out.revenueWeight;
  out.teamExperienceWeight = out.teamSizeWeight;
  out.tractionWeight       = out.previousExitsWeight;
  out.marketSizeWeight     = out.roiWeight;
  out.geographyWeight      = out.locationPreference !== "All" ? 10 : 0;

  return out;
}