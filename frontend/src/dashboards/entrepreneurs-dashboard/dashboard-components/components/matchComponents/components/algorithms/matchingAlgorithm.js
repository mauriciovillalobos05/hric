// Startup matching algorithm with Monte Carlo simulation
export class StartupMatcher {
  constructor() {
    this.simulationRuns = 1000; // Number of Monte Carlo simulations
  }

  // Calculate base match score based on user preferences
  calculateBaseScore(startup, filters) {
    let score = 0;
    let totalWeight = 0;

    // ROI Category scoring
    const roiScore = this.getRoiScore(startup.roi_category);
    score += roiScore * (filters.roiWeight / 100);
    totalWeight += filters.roiWeight;

    // Technical founders scoring
    score += startup.percent_technical_founders * (filters.technicalFoundersWeight / 100);
    totalWeight += filters.technicalFoundersWeight;

    // Previous exits scoring
    score += startup.percent_previous_exits * (filters.previousExitsWeight / 100);
    totalWeight += filters.previousExitsWeight;

    // Revenue performance scoring
    score += (startup.revenue_scalar * 100) * (filters.revenueWeight / 100);
    totalWeight += filters.revenueWeight;

    // Team size scoring (normalized)
    const teamSizeScore = this.normalizeTeamSize(startup.number_of_employees);
    score += teamSizeScore * (filters.teamSizeWeight / 100);
    totalWeight += filters.teamSizeWeight;

    // Currently raising bonus
    if (startup.currently_raising && filters.currentlyRaisingWeight > 0) {
      score += 20 * (filters.currentlyRaisingWeight / 100);
      totalWeight += filters.currentlyRaisingWeight;
    }

    // Normalize score to 0-100 range
    return totalWeight > 0 ? (score / totalWeight) * 100 : 0;
  }

  // Monte Carlo simulation for risk assessment
  runMonteCarloSimulation(startup, filters) {
    const results = [];
    
    for (let i = 0; i < this.simulationRuns; i++) {
      // Add random variations to simulate uncertainty
      const simulatedStartup = this.addRandomVariation(startup);
      const score = this.calculateBaseScore(simulatedStartup, filters);
      results.push(score);
    }

    // Calculate statistics
    const sortedResults = results.sort((a, b) => a - b);
    const mean = results.reduce((sum, score) => sum + score, 0) / results.length;
    const variance = results.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / results.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean: Math.round(mean * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      min: Math.round(sortedResults[0] * 100) / 100,
      max: Math.round(sortedResults[sortedResults.length - 1] * 100) / 100,
      percentile25: Math.round(sortedResults[Math.floor(0.25 * sortedResults.length)] * 100) / 100,
      percentile75: Math.round(sortedResults[Math.floor(0.75 * sortedResults.length)] * 100) / 100,
      confidence95Lower: Math.round(sortedResults[Math.floor(0.025 * sortedResults.length)] * 100) / 100,
      confidence95Upper: Math.round(sortedResults[Math.floor(0.975 * sortedResults.length)] * 100) / 100,
      riskLevel: this.calculateRiskLevel(stdDev)
    };
  }

  // Add random variations for Monte Carlo simulation
  addRandomVariation(startup) {
    const variation = {
      ...startup,
      percent_technical_founders: this.addNoise(startup.percent_technical_founders, 10),
      percent_previous_exits: this.addNoise(startup.percent_previous_exits, 15),
      revenue_scalar: Math.max(0, Math.min(1, this.addNoise(startup.revenue_scalar, 0.2))),
      number_of_employees: Math.max(1, Math.round(this.addNoise(startup.number_of_employees, startup.number_of_employees * 0.1)))
    };

    return variation;
  }

  // Add Gaussian noise to a value
  addNoise(value, stdDev) {
    // Box-Muller transformation for Gaussian random numbers
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return value + (z0 * stdDev);
  }

  // Calculate risk level based on standard deviation
  calculateRiskLevel(stdDev) {
    if (stdDev < 5) return 'Low';
    if (stdDev < 10) return 'Medium';
    if (stdDev < 15) return 'High';
    return 'Very High';
  }

  // Convert ROI category to numeric score
  getRoiScore(roiCategory) {
    switch (roiCategory) {
      case 'High': return 90;
      case 'Medium': return 60;
      case 'Low': return 30;
      default: return 50;
    }
  }

  // Normalize team size to 0-100 scale
  normalizeTeamSize(teamSize) {
    // Optimal team size is considered around 20-50 employees
    if (teamSize >= 20 && teamSize <= 50) return 100;
    if (teamSize < 20) return Math.max(30, (teamSize / 20) * 100);
    if (teamSize > 50) return Math.max(50, 100 - ((teamSize - 50) / 100) * 30);
    return 50;
  }

  // Filter startups based on user preferences
  filterStartups(startups, filters) {
    return startups.filter(startup => {
      // Stage filter
      if (filters.stagePreference && filters.stagePreference !== 'All' && startup.stage !== filters.stagePreference) {
        return false;
      }

      // Location filter
      if (filters.locationPreference && filters.locationPreference !== 'All' && startup.location !== filters.locationPreference) {
        return false;
      }

      // Industry filter
      if (filters.industryPreference && filters.industryPreference !== 'All' && startup.industry !== filters.industryPreference) {
        return false;
      }

      return true;
    });
  }

  // Main matching function
  matchStartups(startups, filters) {
    // First filter by basic criteria
    const filteredStartups = this.filterStartups(startups, filters);

    // Calculate scores and run Monte Carlo simulation for each startup
    const scoredStartups = filteredStartups.map(startup => {
      const baseScore = this.calculateBaseScore(startup, filters);
      const simulation = this.runMonteCarloSimulation(startup, filters);
      
      return {
        ...startup,
        matchScore: Math.round(baseScore),
        simulation,
        riskAdjustedScore: Math.round(simulation.mean - (simulation.stdDev * 0.5)) // Conservative scoring
      };
    });

    // Sort by risk-adjusted score
    return scoredStartups.sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);
  }

  // Get top matches with detailed analysis
  getTopMatches(startups, filters, limit = 10) {
    const matches = this.matchStartups(startups, filters);
    return matches.slice(0, limit);
  }

  // Generate insights based on matching results
  generateInsights(matches, filters) {
    if (matches.length === 0) {
      return {
        summary: "No startups match your current criteria. Consider adjusting your filters.",
        recommendations: ["Broaden location preferences", "Consider different stages", "Adjust weight preferences"]
      };
    }

    const avgScore = matches.reduce((sum, match) => sum + match.matchScore, 0) / matches.length;
    const highRiskCount = matches.filter(match => match.simulation.riskLevel === 'High' || match.simulation.riskLevel === 'Very High').length;
    const currentlyRaisingCount = matches.filter(match => match.currently_raising).length;

    const insights = {
      summary: `Found ${matches.length} matching startups with an average match score of ${Math.round(avgScore)}%.`,
      topMatch: matches[0],
      riskAnalysis: {
        highRiskCount,
        riskPercentage: Math.round((highRiskCount / matches.length) * 100)
      },
      opportunities: {
        currentlyRaisingCount,
        opportunityPercentage: Math.round((currentlyRaisingCount / matches.length) * 100)
      },
      recommendations: this.generateRecommendations(matches, filters)
    };

    return insights;
  }

  // Generate personalized recommendations
  generateRecommendations(matches, filters) {
    const recommendations = [];

    // Check if user is being too restrictive
    if (matches.length < 3) {
      recommendations.push("Consider broadening your criteria to see more opportunities");
    }

    // Analyze weight distribution
    const totalWeight = filters.roiWeight + filters.technicalFoundersWeight + 
                       filters.previousExitsWeight + filters.revenueWeight + 
                       filters.teamSizeWeight + filters.currentlyRaisingWeight;

    if (totalWeight < 200) {
      recommendations.push("Consider increasing weight preferences to get more targeted results");
    }

    // Check for opportunities
    const raisingCount = matches.filter(m => m.currently_raising).length;
    if (raisingCount > 0) {
      recommendations.push(`${raisingCount} startups are currently raising - great timing for investment`);
    }

    // Risk analysis recommendations
    const highRiskCount = matches.filter(m => m.simulation.riskLevel === 'High' || m.simulation.riskLevel === 'Very High').length;
    if (highRiskCount > matches.length * 0.5) {
      recommendations.push("Consider diversifying across different risk levels");
    }

    return recommendations;
  }
}

// Export singleton instance
export const startupMatcher = new StartupMatcher();

