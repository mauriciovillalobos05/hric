// Mock startup data for the startup–investor matching platform

const mockStartups = [
    {
      id: "s-001",
      name: "CyberSec Pro",
      stage: "Growth",
      industry: "CyberSecurity",
      industries: ["CyberSecurity", "Enterprise"],
      location: "Guadalajara, MX",
      employees: 42,
      revenueMonthlyUSD: 280000,
      valuationUSD: 30000000,
      tags: ["High ROI"],
      keyMetrics: {
        technicalFounders: 1.0, // 100%
        previousExits: 0.95,    // 95%
        revenueGrowthYoY: 0.55,
        grossMargin: 0.78,
      },
      currentInvestors: ["Sequoia Capital", "Lightspeed Venture Partners"],
      summary:
        "Managed detection & response platform for mid-market; SOC automation and threat intel.",
    },
  
    {
      id: "s-002",
      name: "LogiChain Solutions",
      stage: "Late",
      industry: "Logistics",
      industries: ["Logistics", "SaaS"],
      location: "Mexico City, MX",
      employees: 85,
      revenueMonthlyUSD: 400000,
      valuationUSD: 80000000,
      tags: ["High ROI"],
      keyMetrics: {
        technicalFounders: 1.0,
        previousExits: 0.9,
        revenueGrowthYoY: 0.48,
        grossMargin: 0.72,
      },
      currentInvestors: ["Accel Partners", "Tiger Global Management"],
      summary:
        "End-to-end freight orchestration with dynamic routing, carrier scoring, and carbon tracking.",
    },
  
    {
      id: "s-003",
      name: "TechFlow AI",
      stage: "Growth",
      industry: "AI/ML",
      industries: ["AI/ML", "Enterprise"],
      location: "Mexico City, MX",
      employees: 45,
      revenueMonthlyUSD: 150000,
      valuationUSD: 25000000,
      tags: ["High ROI"],
      keyMetrics: {
        technicalFounders: 1.0,
        previousExits: 0.85,
        revenueGrowthYoY: 0.62,
        grossMargin: 0.81,
      },
      currentInvestors: ["SoftBank Ventures", "ALLVP"],
      summary:
        "Agentic workflow automation for finance ops; reconciliation, invoice triage, and anomaly detection.",
    },
  
    {
      id: "s-004",
      name: "FinPay Cloud",
      stage: "Series A",
      industry: "FinTech",
      industries: ["FinTech", "SaaS"],
      location: "Monterrey, MX",
      employees: 38,
      revenueMonthlyUSD: 120000,
      valuationUSD: 18000000,
      keyMetrics: {
        technicalFounders: 0.8,
        previousExits: 0.6,
        revenueGrowthYoY: 0.75,
        grossMargin: 0.79,
      },
      currentInvestors: ["Index Ventures"],
      summary:
        "API-first B2B payments with embedded risk scoring and currency hedging for SMB exporters.",
    },
  
    {
      id: "s-005",
      name: "HealthNova",
      stage: "Series B",
      industry: "Healthcare",
      industries: ["Healthcare", "AI/ML"],
      location: "Bogotá, CO",
      employees: 120,
      revenueMonthlyUSD: 520000,
      valuationUSD: 120000000,
      keyMetrics: {
        technicalFounders: 0.9,
        previousExits: 0.7,
        revenueGrowthYoY: 0.58,
        grossMargin: 0.74,
      },
      currentInvestors: ["Kleiner Perkins", "Bessemer Venture Partners"],
      summary:
        "Clinical decision support models for imaging; FDA pathway in progress, strong hospital pilots.",
    },
  
    {
      id: "s-006",
      name: "GreenGrid",
      stage: "Series A",
      industry: "CleanTech",
      industries: ["CleanTech", "IoT"],
      location: "Querétaro, MX",
      employees: 28,
      revenueMonthlyUSD: 70000,
      valuationUSD: 14000000,
      keyMetrics: {
        technicalFounders: 0.85,
        previousExits: 0.4,
        revenueGrowthYoY: 0.66,
        grossMargin: 0.61,
      },
      currentInvestors: ["GV (Google Ventures)"],
      summary:
        "Smart meters + edge analytics for industrial energy optimization; demand response integrations.",
    },
  
    {
      id: "s-007",
      name: "EduSpark",
      stage: "Seed",
      industry: "EdTech",
      industries: ["EdTech", "SaaS"],
      location: "Lima, PE",
      employees: 16,
      revenueMonthlyUSD: 18000,
      valuationUSD: 6000000,
      keyMetrics: {
        technicalFounders: 0.7,
        previousExits: 0.2,
        revenueGrowthYoY: 0.9,
        grossMargin: 0.69,
      },
      currentInvestors: ["First Round Capital"],
      summary:
        "Adaptive learning engine for STEM with school district deployments and teacher tooling.",
    },
  
    {
      id: "s-008",
      name: "AgroSense",
      stage: "Series A",
      industry: "AgriTech",
      industries: ["AgriTech", "IoT", "AI/ML"],
      location: "Medellín, CO",
      employees: 34,
      revenueMonthlyUSD: 95000,
      valuationUSD: 15000000,
      keyMetrics: {
        technicalFounders: 0.8,
        previousExits: 0.35,
        revenueGrowthYoY: 0.72,
        grossMargin: 0.65,
      },
      currentInvestors: ["ALLVP"],
      summary:
        "Computer-vision crop monitoring and yield prediction for high-value crops; co-ops channel.",
    },
  
    {
      id: "s-009",
      name: "CleanWave",
      stage: "Series B",
      industry: "ClimateTech",
      industries: ["ClimateTech", "Hardware"],
      location: "Santiago, CL",
      employees: 60,
      revenueMonthlyUSD: 210000,
      valuationUSD: 65000000,
      keyMetrics: {
        technicalFounders: 0.95,
        previousExits: 0.5,
        revenueGrowthYoY: 0.47,
        grossMargin: 0.58,
      },
      currentInvestors: ["Lightspeed Venture Partners"],
      summary:
        "Modular carbon capture units for mid-scale manufacturing; leasing model with maintenance.",
    },
  
    {
      id: "s-010",
      name: "RetailPulse",
      stage: "Growth",
      industry: "RetailTech",
      industries: ["RetailTech", "AI/ML"],
      location: "Mexico City, MX",
      employees: 52,
      revenueMonthlyUSD: 240000,
      valuationUSD: 42000000,
      keyMetrics: {
        technicalFounders: 0.9,
        previousExits: 0.6,
        revenueGrowthYoY: 0.51,
        grossMargin: 0.76,
      },
      currentInvestors: ["Andreessen Horowitz"],
      summary:
        "Demand forecasting + dynamic pricing for supermarkets; real-time shelf vision.",
    },
  
    {
      id: "s-011",
      name: "BioSynth Labs",
      stage: "Series A",
      industry: "BioTech",
      industries: ["BioTech", "Healthcare"],
      location: "Austin, TX",
      employees: 24,
      revenueMonthlyUSD: 50000,
      valuationUSD: 22000000,
      keyMetrics: {
        technicalFounders: 1.0,
        previousExits: 0.3,
        revenueGrowthYoY: 0.63,
        grossMargin: 0.59,
      },
      currentInvestors: ["Bessemer Venture Partners"],
      summary:
        "Enzyme engineering platform for greener chemical synthesis; pharma partnerships underway.",
    },
  
    {
      id: "s-012",
      name: "CloudShield",
      stage: "Series B",
      industry: "CyberSecurity",
      industries: ["CyberSecurity", "SaaS"],
      location: "Monterrey, MX",
      employees: 78,
      revenueMonthlyUSD: 310000,
      valuationUSD: 90000000,
      keyMetrics: {
        technicalFounders: 0.95,
        previousExits: 0.75,
        revenueGrowthYoY: 0.57,
        grossMargin: 0.83,
      },
      currentInvestors: ["Index Ventures", "GV (Google Ventures)"],
      summary:
        "Zero-trust access + identity threat detection for distributed workforces; strong mid-market pull.",
    },
  ];
  
  export default mockStartups;
  