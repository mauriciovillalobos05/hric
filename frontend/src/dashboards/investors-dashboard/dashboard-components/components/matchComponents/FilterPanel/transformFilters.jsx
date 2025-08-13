// transformFilters.jsx — REPLACE with this

export default function transformFilters(f = {}) {
    const out = {
      // ✅ matcher-expected keys (pass-through)
      roiWeight: f.roiWeight ?? 0,
      technicalFoundersWeight: f.technicalFoundersWeight ?? 0,
      previousExitsWeight: f.previousExitsWeight ?? 0,
      revenueWeight: f.revenueWeight ?? 0,
      teamSizeWeight: f.teamSizeWeight ?? 0,
      currentlyRaisingWeight: f.currentlyRaisingWeight ?? 0,
  
      // filters for gating
      stagePreference: f.stagePreference ?? "All",
      locationPreference: f.locationPreference ?? "All",
      industryPreference: f.industryPreference ?? "All",
    };
  
    // (Optional) keep legacy aliases if other code expects them:
    out.revenueGrowthWeight   = out.revenueWeight;
    out.teamExperienceWeight  = out.teamSizeWeight;
    out.tractionWeight        = out.previousExitsWeight;
    out.marketSizeWeight      = out.roiWeight;
    out.geographyWeight       = out.locationPreference !== "All" ? 10 : 0;
  
    return out;
  }
  