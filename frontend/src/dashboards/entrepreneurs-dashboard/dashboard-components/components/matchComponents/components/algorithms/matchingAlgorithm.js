export class InvestorMatcher {
  constructor() {
    this.simulationRuns = 1000;
  }

  calculateBaseScore(investor, filters) {
    let score = 0;
    let totalWeight = 0;

    // Example scoring (you can adapt weights and logic to fit your data structure)
    if (investor.preferences) {
      score += (investor.preferences.revenueGrowth || 0) * (filters.revenueGrowthWeight / 100);
      totalWeight += filters.revenueGrowthWeight;

      score += (investor.preferences.marketSize || 0) * (filters.marketSizeWeight / 100);
      totalWeight += filters.marketSizeWeight;

      score += (investor.preferences.traction || 0) * (filters.tractionWeight / 100);
      totalWeight += filters.tractionWeight;

      score += (investor.preferences.teamExperience || 0) * (filters.teamExperienceWeight / 100);
      totalWeight += filters.teamExperienceWeight;

      score += (investor.preferences.geography || 0) * (filters.geographyWeight / 100);
      totalWeight += filters.geographyWeight;

      score += (investor.preferences.techFounders || 0) * (filters.techFoundersWeight / 100);
      totalWeight += filters.techFoundersWeight;
    }

    return totalWeight > 0 ? (score / totalWeight) * 100 : 0;
  }

  runMonteCarloSimulation(investor, filters) {
    const results = [];
    for (let i = 0; i < this.simulationRuns; i++) {
      const simulatedInvestor = this.addRandomVariation(investor);
      const score = this.calculateBaseScore(simulatedInvestor, filters);
      results.push(score);
    }

    const sorted = results.sort((a, b) => a - b);
    const mean = results.reduce((a, b) => a + b, 0) / results.length;
    const variance = results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / results.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean: +mean.toFixed(2),
      stdDev: +stdDev.toFixed(2),
      min: +sorted[0].toFixed(2),
      max: +sorted[sorted.length - 1].toFixed(2),
      percentile25: +sorted[Math.floor(0.25 * sorted.length)].toFixed(2),
      percentile75: +sorted[Math.floor(0.75 * sorted.length)].toFixed(2),
      confidence95Lower: +sorted[Math.floor(0.025 * sorted.length)].toFixed(2),
      confidence95Upper: +sorted[Math.floor(0.975 * sorted.length)].toFixed(2),
      riskLevel: this.calculateRiskLevel(stdDev)
    };
  }

  addRandomVariation(investor) {
    return {
      ...investor,
      preferences: {
        ...investor.preferences,
        revenueGrowth: this.addNoise(investor.preferences?.revenueGrowth || 0, 10),
        marketSize: this.addNoise(investor.preferences?.marketSize || 0, 10),
        traction: this.addNoise(investor.preferences?.traction || 0, 10),
        teamExperience: this.addNoise(investor.preferences?.teamExperience || 0, 10),
        geography: this.addNoise(investor.preferences?.geography || 0, 10),
        techFounders: this.addNoise(investor.preferences?.techFounders || 0, 10)
      }
    };
  }

  addNoise(value, stdDev) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return value + z0 * stdDev;
  }

  calculateRiskLevel(stdDev) {
    if (stdDev < 5) return 'Low';
    if (stdDev < 10) return 'Medium';
    if (stdDev < 15) return 'High';
    return 'Very High';
  }

  filterInvestors(investors, filters) {
    return investors.filter(inv => {
      if (filters.stagePreference !== 'All' && !inv.stage.includes(filters.stagePreference)) return false;
      if (filters.locationPreference !== 'All' && !inv.location.includes(filters.locationPreference)) return false;
      if (filters.industryPreference !== 'All' && !inv.industries.includes(filters.industryPreference)) return false;
      return true;
    });
  }

  matchInvestors(investors, filters) {
    const filtered = this.filterInvestors(investors, filters);
    return filtered.map(inv => {
      const baseScore = this.calculateBaseScore(inv, filters);
      const simulation = this.runMonteCarloSimulation(inv, filters);
      return {
        ...inv,
        matchScore: Math.round(baseScore),
        simulation,
        riskAdjustedScore: Math.round(simulation.mean - simulation.stdDev * 0.5)
      };
    }).sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);
  }

  getTopMatches(investors, filters, limit = 10) {
    return this.matchInvestors(investors, filters).slice(0, limit);
  }
}