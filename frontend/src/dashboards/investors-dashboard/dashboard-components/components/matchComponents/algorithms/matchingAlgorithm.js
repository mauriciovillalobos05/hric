// matchingAlgorithm.js — startup-focused matcher with investor-era shims

export class InvestorMatcher {
  constructor({ simulationRuns = 1000 } = {}) {
    this.simulationRuns = simulationRuns;
  }

  // ---------- helpers ----------
  clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  // Normalize monthly revenue to 10k..300k => 0..1 (tweak ranges as needed)
  normRevenueMonthly(rev) {
    if (rev == null) return 0;
    const min = 10_000;
    const max = 300_000;
    return this.clamp01((rev - min) / (max - min));
  }

  // Normalize employees to 5..150 => 0..1
  normEmployees(n) {
    if (n == null) return 0;
    const min = 5;
    const max = 150;
    return this.clamp01((n - min) / (max - min));
  }

  // ROI proxy from growth + margin (60/40)
  roiProxy(km = {}) {
    const growth = this.clamp01(km.revenueGrowthYoY ?? 0);
    const margin = this.clamp01(km.grossMargin ?? 0);
    return this.clamp01(0.6 * growth + 0.4 * margin);
  }

  isCurrentlyRaising(tags) {
    if (!Array.isArray(tags)) return false;
    return tags.some((t) => typeof t === "string" && /raising/i.test(t));
  }

  // ---------- scoring (0..100) ----------
  /**
   * filters expects:
   * {
   *   roiWeight, technicalFoundersWeight, previousExitsWeight,
   *   revenueWeight, teamSizeWeight, currentlyRaisingWeight
   * }
   */
  // Replace ONLY this method inside InvestorMatcher
// Replace ONLY this method inside InvestorMatcher
// Usage: matcher.calculateBaseScore(startup, filters, { debug: true })

// Inside InvestorMatcher
calculateBaseScore(startup, filters = {}) {
    // helpers
    const clamp01 = (x) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
    const norm01 = (v, min, max) => clamp01(((Number(v) || 0) - min) / (max - min));
  
    // weights (0..100)
    const {
      roiWeight = 0,
      technicalFoundersWeight = 0,
      previousExitsWeight = 0,
      revenueWeight = 0,
      teamSizeWeight = 0,
      currentlyRaisingWeight = 0,
    } = filters || {};
  
    const totalW =
      roiWeight +
      technicalFoundersWeight +
      previousExitsWeight +
      revenueWeight +
      teamSizeWeight +
      currentlyRaisingWeight;
  
    if (!totalW) return 0;
  
    const km = startup?.keyMetrics || {};
  
    // components (0..1)
    // ROI proxy = 60% revenue growth + 40% gross margin
    const roi =
      0.6 * clamp01(km.revenueGrowthYoY ?? 0) +
      0.4 * clamp01(km.grossMargin ?? 0);
  
    const techFounders = clamp01(km.technicalFounders ?? 0);
    const prevExits = clamp01(km.previousExits ?? 0);
  
    // normalize revenue to 10k..300k USD/mo -> 0..1
    const revenue = norm01(startup?.revenueMonthlyUSD ?? 0, 10_000, 300_000);
    // normalize team size to 5..150 employees -> 0..1
    const teamSize = norm01(startup?.employees ?? 0, 5, 150);
  
    // currently raising via tag
    const currentlyRaising =
      Array.isArray(startup?.tags) &&
      startup.tags.some((t) => typeof t === "string" && /raising/i.test(t))
        ? 1
        : 0;
  
    // weighted average -> 0..100
    const weightedSum =
      roi * roiWeight +
      techFounders * technicalFoundersWeight +
      prevExits * previousExitsWeight +
      revenue * revenueWeight +
      teamSize * teamSizeWeight +
      currentlyRaising * currentlyRaisingWeight;
  
    const score01 = weightedSum / totalW;
    const score = +(score01 * 100).toFixed(2);
  
    return Number.isFinite(score) ? score : 0;
  }
  
  

  // ---------- Monte Carlo ----------
  runMonteCarloSimulation(startup, filters) {
    const n = this.simulationRuns;
    const results = new Array(n);

    for (let i = 0; i < n; i++) {
      const s = this.addRandomVariation(startup);
      results[i] = this.calculateBaseScore(s, filters);
    }

    results.sort((a, b) => a - b);
    const mean = results.reduce((a, b) => a + b, 0) / n;
    const variance = results.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    const at = (p) => results[Math.max(0, Math.min(n - 1, Math.floor(p * n)))];

    return {
      mean: +mean.toFixed(2),
      stdDev: +stdDev.toFixed(2),
      min: +results[0].toFixed(2),
      max: +results[n - 1].toFixed(2),
      percentile25: +at(0.25).toFixed(2),
      percentile75: +at(0.75).toFixed(2),
      confidence95Lower: +at(0.025).toFixed(2),
      confidence95Upper: +at(0.975).toFixed(2),
      riskLevel: this.calculateRiskLevel(stdDev),
    };
  }

  // add realistic noise to inputs used by the score
  addRandomVariation(startup) {
    const gauss = this.gauss;

    const noise01 = (v, pct = 0.07) => {
      const val = (v ?? 0) + gauss() * pct;
      return this.clamp01(val);
    };

    const noiseAbsPct = (v, pct = 0.1, floor = 0) => {
      const base = v ?? 0;
      const perturbed = base + base * gauss() * pct;
      return Math.max(floor, perturbed);
    };

    const km = startup?.keyMetrics || {};
    return {
      ...startup,
      keyMetrics: {
        ...km,
        technicalFounders: noise01(km.technicalFounders, 0.06),
        previousExits: noise01(km.previousExits, 0.06),
        revenueGrowthYoY: noise01(km.revenueGrowthYoY, 0.08),
        grossMargin: noise01(km.grossMargin, 0.05),
      },
      revenueMonthlyUSD: noiseAbsPct(startup?.revenueMonthlyUSD, 0.1, 0),
      employees: Math.max(1, Math.round(noiseAbsPct(startup?.employees, 0.1, 1))),
    };
  }

  // Box–Muller
  gauss() {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  calculateRiskLevel(stdDev) {
    if (stdDev < 5) return "Low";
    if (stdDev < 10) return "Medium";
    if (stdDev < 15) return "High";
    return "Very High";
  }

  // ---------- filtering ----------
  filterStartups(startups, filters) {
    const stagePref = filters.stagePreference ?? "All";
    const locPref = filters.locationPreference ?? "All";
    const indPref = filters.industryPreference ?? "All";

    return (startups || []).filter((s) => {
      // stage check (string)
      if (stagePref !== "All") {
        const st = (s.stage || "").toString();
        if (!(st === stagePref || st.includes(stagePref))) return false;
      }

      // location check (substring, case-insensitive)
      if (locPref !== "All") {
        if (!s.location?.toLowerCase().includes(locPref.toLowerCase())) return false;
      }

      // industry check (array or single)
      if (indPref !== "All") {
        const inds = Array.isArray(s.industries) ? s.industries : [s.industry].filter(Boolean);
        if (!inds.some((x) => (x || "").toLowerCase() === indPref.toLowerCase())) return false;
      }

      return true;
    });
  }

  // ---------- matching pipeline (startups) ----------
  matchStartups(startups, filters) {
    const filtered = this.filterStartups(startups, filters);
    return filtered
      .map((s) => {
        const base = this.calculateBaseScore(s, filters);
        const simulation = this.runMonteCarloSimulation(s, filters);
        return {
          ...s,
          matchScore: Math.round(base),
          simulation,
          riskAdjustedScore: Math.round(simulation.mean - 0.5 * simulation.stdDev),
        };
      })
      .sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);
  }

  getTopMatches(startups, filters, limit = 10) {
    return this.matchStartups(startups, filters).slice(0, limit);
  }

  // ---------- back-compat shims (old investor-era API) ----------
  filterInvestors(arr, filters) {
    return this.filterStartups(arr, filters);
  }
  matchInvestors(arr, filters) {
    return this.matchStartups(arr, filters);
  }
}
