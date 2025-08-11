// transformFilters.jsx
const normArr = (v) =>
  Array.isArray(v)
    ? v.map(String).map((s) => s.trim()).filter(Boolean)
    : (typeof v === "string" && v.trim() && v !== "All" ? [v.trim()] : []);

export default function transformFilters(f = {}) {
  const stages = normArr(f.stagePreferences ?? f.stagePreference);
  const industries = normArr(f.industryPreferences ?? f.industryPreference);
  const locations = normArr(f.locationPreferences ?? f.locationPreference);

  const out = {
    // weights
    roiWeight: f.roiWeight ?? 0,
    technicalFoundersWeight: f.technicalFoundersWeight ?? 0,
    previousExitsWeight: f.previousExitsWeight ?? 0,
    revenueWeight: f.revenueWeight ?? 0,
    teamSizeWeight: f.teamSizeWeight ?? 0,
    currentlyRaisingWeight: f.currentlyRaisingWeight ?? 0,

    // NEW arrays (preferred by backend)
    stagePreferences: stages,
    industryPreferences: industries,
    locationPreferences: locations,

    // Back-compat single fields (only set if exactly one selected; else “All”)
    stagePreference: stages.length === 1 ? stages[0] : "All",
    industryPreference: industries.length === 1 ? industries[0] : "All",
    locationPreference: locations.length === 1 ? locations[0] : "All",

    // legacy aliases (optional)
    revenueGrowthWeight: f.revenueWeight ?? 0,
    teamExperienceWeight: f.teamSizeWeight ?? 0,
    tractionWeight: f.previousExitsWeight ?? 0,
    marketSizeWeight: f.roiWeight ?? 0,
    geographyWeight: locations.length > 0 ? 10 : 0,
  };

  return out;
}