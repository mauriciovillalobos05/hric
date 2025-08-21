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
  calculateBaseScore(startup, filters = {}) {
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

  // ---------- Monte Carlo (precise; startup-aware; scenario-based) ----------

  /**
   * Run Monte Carlo on a startup with the current filters (weights).
   * Options:
   *  - scenario: 'bull' | 'neutral' | 'bear' (default from filters.marketScenario or 'neutral')
   *  - includeSamples: whether to return raw samples for charts (default true)
   *  - sampleLimit: cap number of samples stored to avoid big payloads (default 1200)
   */
  runMonteCarloSimulation(startup, filters, options = {}) {
    const scenarioKey = (filters && filters.marketScenario) || options.scenario || "neutral";
    const scenario = InvestorMatcher.SCENARIOS[scenarioKey] || InvestorMatcher.SCENARIOS.neutral;

    const n = this.simulationRuns;
    const samples = options.includeSamples !== false ? [] : null;
    const sampleLimit = options.sampleLimit ?? 1200;
    const stride = samples ? Math.max(1, Math.ceil(n / sampleLimit)) : 1;

    // Base SDs (intuitive, per-metric) scaled by scenario volatility
    const volScale = 1 + scenario.vol; // bear has bigger vol
    const SD = {
      technicalFounders: 0.03 * volScale, // fairly stable
      previousExits: 0.08 * volScale,     // mildly uncertain
      revenueGrowthYoY: 0.12 * volScale,  // volatile
      grossMargin: 0.05 * volScale,       // moderate
      revenueRel: 0.20 * volScale,        // 20% rel noise on revenue
      employeesRel: 0.10 * volScale,      // 10% rel noise on headcount
    };

    // Sim loop
    let sum = 0;
    let sumSq = 0;
    let min = Infinity;
    let max = -Infinity;
    const arr = new Array(n);

    for (let i = 0; i < n; i++) {
      const s = this._perturbStartup(startup, SD, scenario);
      const score = this.calculateBaseScore(s, filters);

      arr[i] = score;
      sum += score;
      sumSq += score * score;
      if (score < min) min = score;
      if (score > max) max = score;

      if (samples && i % stride === 0) samples.push(score);
    }

    // Stats
    arr.sort((a, b) => a - b);
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    const stdDev = Math.sqrt(Math.max(0, variance));
    const at = (p) => arr[Math.max(0, Math.min(n - 1, Math.floor(p * n)))];

    const out = {
      mean: +mean.toFixed(2),
      stdDev: +stdDev.toFixed(2),
      min: +min.toFixed(2),
      max: +max.toFixed(2),
      percentile25: +at(0.25).toFixed(2),
      percentile75: +at(0.75).toFixed(2),
      confidence95Lower: +at(0.025).toFixed(2),
      confidence95Upper: +at(0.975).toFixed(2),
      riskLevel: this.calculateRiskLevel(stdDev),
    };

    if (samples) out.samples = samples;
    return out;
  }

  /**
   * Perturb a startup for a single simulation draw, applying:
   *  - bounded Gaussian noise on 0..1 metrics
   *  - lognormal-ish relative noise on revenue
   *  - discrete noise on headcount
   *  - market scenario shocks (growth/margin/revenue)
   */
  _perturbStartup(startup, SD, scenario) {
    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    const km = startup?.keyMetrics || {};

    // 0..1 metrics (bounded gaussians)
    const g = this.gauss;
    const bump01 = (v, sd) => clamp01((v ?? 0) + g() * sd);

    let technicalFounders = bump01(km.technicalFounders ?? 0, SD.technicalFounders);
    let previousExits = bump01(km.previousExits ?? 0, SD.previousExits);

    // Growth / margin with scenario mean shock
    let revenueGrowthYoY = bump01(
      (km.revenueGrowthYoY ?? 0) * scenario.growthMul,
      SD.revenueGrowthYoY
    );
    let grossMargin = clamp01(
      bump01(km.grossMargin ?? 0, SD.grossMargin) + scenario.marginShift
    );

    // Revenue (absolute), multiplicative noise + scenario revenueMul
    const baseRevenue = Math.max(0, startup?.revenueMonthlyUSD ?? 0);
    const revNoise = 1 + g() * SD.revenueRel; // lognormal-ish small noise
    const revenueMonthlyUSD = Math.max(0, baseRevenue * revNoise * scenario.revenueMul);

    // Employees (discrete)
    const baseEmp = Math.max(1, Math.round(startup?.employees ?? 1));
    const empNoise = Math.round(baseEmp * (1 + g() * SD.employeesRel));
    const employees = Math.max(1, empNoise);

    // Tags / raising preserved
    const tags = Array.isArray(startup?.tags) ? [...startup.tags] : startup?.tags;

    return {
      ...startup,
      employees,
      revenueMonthlyUSD,
      keyMetrics: {
        ...km,
        technicalFounders,
        previousExits,
        revenueGrowthYoY,
        grossMargin,
      },
      tags,
    };
  }

  // Scenario presets (you can tweak)
  static SCENARIOS = {
    bull:    { growthMul: 1.15, marginShift: +0.03, revenueMul: 1.20, vol: 0.15 },
    neutral: { growthMul: 1.00, marginShift:  0.00, revenueMul: 1.00, vol: 0.25 },
    bear:    { growthMul: 0.85, marginShift: -0.03, revenueMul: 0.90, vol: 0.35 },
  };

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
      if (stagePref !== "All") {
        const st = (s.stage || "").toString();
        if (!(st === stagePref || st.includes(stagePref))) return false;
      }

      if (locPref !== "All") {
        if (!s.location?.toLowerCase().includes(locPref.toLowerCase())) return false;
      }

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
