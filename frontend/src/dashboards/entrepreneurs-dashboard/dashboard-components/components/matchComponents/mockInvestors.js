// Mock investor data for the startup-investor matching platform
const mockInvestors = [
  {
    id: 1,
    name: "Sequoia Capital",
    type: "Venture Capital",
    stage: ["Series A", "Series B", "Series C"],
    industries: ["Technology", "Healthcare", "FinTech"],
    location: "Menlo Park, CA",
    checkSize: "$5M - $50M",
    portfolioSize: 200,
    founded: 1972,
    aum: "$85B",
    recentInvestments: 15,
    avgDealTime: "3-6 months",
    followOnRate: 85,
    boardSeats: "Usually takes board seat",
    investmentThesis: "Backing bold founders building legendary companies",
    keyPartners: ["Roelof Botha", "Alfred Lin", "Pat Grady"],
    portfolioCompanies: ["Apple", "Google", "WhatsApp", "Airbnb", "Stripe"],
    preferences: {
      revenueGrowth: 90,
      teamExperience: 85,
      marketSize: 95,
      traction: 88,
      geography: 70,
      techFounders: 80
    },
    investmentBehavior: {
      frequency: 0.8,
      dueDiligenceTime: 120,
      followOnLikelihood: 0.85,
      syndicationPreference: "lead",
      boardInvolvement: "high"
    }
  },
  {
    id: 2,
    name: "Andreessen Horowitz",
    type: "Venture Capital",
    stage: ["Seed", "Series A", "Series B"],
    industries: ["Technology", "Crypto", "Bio", "Financial Technology"],
    location: "Menlo Park, CA",
    checkSize: "$1M - $25M",
    portfolioSize: 400,
    founded: 2009,
    aum: "$35B",
    recentInvestments: 25,
    avgDealTime: "2-4 months",
    followOnRate: 78,
    boardSeats: "Selective board participation",
    investmentThesis: "Software is eating the world",
    keyPartners: ["Marc Andreessen", "Ben Horowitz", "Chris Dixon"],
    portfolioCompanies: ["Facebook", "Twitter", "Coinbase", "Lyft", "Slack"],
    preferences: {
      revenueGrowth: 85,
      teamExperience: 90,
      marketSize: 88,
      traction: 82,
      geography: 75,
      techFounders: 95
    },
    investmentBehavior: {
      frequency: 0.75,
      dueDiligenceTime: 90,
      followOnLikelihood: 0.78,
      syndicationPreference: "lead",
      boardInvolvement: "medium"
    }
  },
  {
    id: 3,
    name: "First Round Capital",
    type: "Corporate Investor",
    stage: ["Pre-seed", "Seed", "Series A"],
    industries: ["Technology", "Consumer", "Enterprise"],
    location: "San Francisco, CA",
    checkSize: "$500K - $15M",
    portfolioSize: 300,
    founded: 2004,
    aum: "$4B",
    recentInvestments: 20,
    avgDealTime: "1-3 months",
    followOnRate: 72,
    boardSeats: "Founder-friendly approach",
    investmentThesis: "Backing exceptional founders at the earliest stages",
    keyPartners: ["Josh Kopelman", "Phin Barnes", "Hayley Barna"],
    portfolioCompanies: ["Uber", "Square", "Warby Parker", "Notion", "Roblox"],
    preferences: {
      revenueGrowth: 75,
      teamExperience: 88,
      marketSize: 80,
      traction: 70,
      geography: 65,
      techFounders: 85
    },
    investmentBehavior: {
      frequency: 0.85,
      dueDiligenceTime: 60,
      followOnLikelihood: 0.72,
      syndicationPreference: "lead",
      boardInvolvement: "low"
    }
  },
  {
    id: 4,
    name: "Accel Partners",
    type: "Founder/Entrepreneur",
    stage: ["Series A", "Series B", "Growth"],
    industries: ["Enterprise", "Consumer", "Financial Technology", "Healthcare"],
    location: "Palo Alto, CA",
    checkSize: "$2M - $100M",
    portfolioSize: 500,
    founded: 1983,
    aum: "$25B",
    recentInvestments: 18,
    avgDealTime: "4-8 months",
    followOnRate: 80,
    boardSeats: "Active board participation",
    investmentThesis: "Partnering with exceptional entrepreneurs",
    keyPartners: ["Jim Breyer", "Kevin Efrusy", "Vas Narasimhan"],
    portfolioCompanies: ["Facebook", "Dropbox", "Slack", "Atlassian", "Spotify"],
    preferences: {
      revenueGrowth: 92,
      teamExperience: 82,
      marketSize: 90,
      traction: 85,
      geography: 80,
      techFounders: 75
    },
    investmentBehavior: {
      frequency: 0.7,
      dueDiligenceTime: 150,
      followOnLikelihood: 0.8,
      syndicationPreference: "lead",
      boardInvolvement: "high"
    }
  },
  {
    id: 5,
    name: "Bessemer Venture Partners",
    type: "Accelerator",
    stage: ["Series A", "Series B", "Series C"],
    industries: ["Cloud", "Healthcare", "Consumer", "Infrastructure"],
    location: "Menlo Park, CA",
    checkSize: "$3M - $50M",
    portfolioSize: 200,
    founded: 1911,
    aum: "$20B",
    recentInvestments: 12,
    avgDealTime: "3-5 months",
    followOnRate: 88,
    boardSeats: "Strategic board involvement",
    investmentThesis: "Backing disruptive innovation across sectors",
    keyPartners: ["Jeremy Levine", "Byron Deeter", "Sarah Tavel"],
    portfolioCompanies: ["LinkedIn", "Pinterest", "Shopify", "Twilio", "DocuSign"],
    preferences: {
      revenueGrowth: 88,
      teamExperience: 85,
      marketSize: 85,
      traction: 90,
      geography: 70,
      techFounders: 78
    },
    investmentBehavior: {
      frequency: 0.65,
      dueDiligenceTime: 120,
      followOnLikelihood: 0.88,
      syndicationPreference: "lead",
      boardInvolvement: "high"
    }
  },
  {
    id: 6,
    name: "Index Ventures",
    type: "Venture Capital",
    stage: ["Seed", "Series A", "Series B"],
    industries: ["Enterprise", "FinTech", "Gaming", "Mobility"],
    location: "San Francisco, CA / London, UK",
    checkSize: "$1M - $30M",
    portfolioSize: 150,
    founded: 1996,
    aum: "$8B",
    recentInvestments: 22,
    avgDealTime: "2-4 months",
    followOnRate: 75,
    boardSeats: "Collaborative board approach",
    investmentThesis: "Backing transformational technology companies",
    keyPartners: ["Mike Volpi", "Danny Rimer", "Carlos Gonzalez-Cadenas"],
    portfolioCompanies: ["Skype", "Dropbox", "King", "Revolut", "Discord"],
    preferences: {
      revenueGrowth: 80,
      teamExperience: 88,
      marketSize: 82,
      traction: 78,
      geography: 85,
      techFounders: 90
    },
    investmentBehavior: {
      frequency: 0.78,
      dueDiligenceTime: 90,
      followOnLikelihood: 0.75,
      syndicationPreference: "co-lead",
      boardInvolvement: "medium"
    }
  },
  {
    id: 7,
    name: "Lightspeed Venture Partners",
    type: "Venture Capital",
    stage: ["Seed", "Series A", "Series B", "Growth"],
    industries: ["Enterprise", "Consumer", "FinTech", "Healthcare"],
    location: "Menlo Park, CA",
    checkSize: "$500K - $100M",
    portfolioSize: 400,
    founded: 2000,
    aum: "$25B",
    recentInvestments: 30,
    avgDealTime: "2-6 months",
    followOnRate: 82,
    boardSeats: "Hands-on board participation",
    investmentThesis: "Partnering with exceptional entrepreneurs globally",
    keyPartners: ["Jeremy Liew", "Nicole Quinn", "Gaurav Gupta"],
    portfolioCompanies: ["Snapchat", "Affirm", "Epic Games", "Grubhub", "AppDynamics"],
    preferences: {
      revenueGrowth: 85,
      teamExperience: 80,
      marketSize: 88,
      traction: 85,
      geography: 75,
      techFounders: 82
    },
    investmentBehavior: {
      frequency: 0.82,
      dueDiligenceTime: 105,
      followOnLikelihood: 0.82,
      syndicationPreference: "lead",
      boardInvolvement: "high"
    }
  },
  {
    id: 8,
    name: "GV (Google Ventures)",
    type: "Corporate VC",
    stage: ["Seed", "Series A", "Series B"],
    industries: ["AI/ML", "Healthcare", "Enterprise", "Consumer"],
    location: "Mountain View, CA",
    checkSize: "$1M - $50M",
    portfolioSize: 300,
    founded: 2009,
    aum: "$7B",
    recentInvestments: 25,
    avgDealTime: "3-5 months",
    followOnRate: 70,
    boardSeats: "Strategic advisory role",
    investmentThesis: "Investing in bold new companies",
    keyPartners: ["David Krane", "Joe Kraus", "M.G. Siegler"],
    portfolioCompanies: ["Uber", "Nest", "Medium", "Slack", "23andMe"],
    preferences: {
      revenueGrowth: 82,
      teamExperience: 75,
      marketSize: 90,
      traction: 80,
      geography: 70,
      techFounders: 95
    },
    investmentBehavior: {
      frequency: 0.72,
      dueDiligenceTime: 120,
      followOnLikelihood: 0.7,
      syndicationPreference: "follow",
      boardInvolvement: "low"
    }
  },
  {
    id: 9,
    name: "Tiger Global Management",
    type: "Growth Equity",
    stage: ["Series B", "Series C", "Growth"],
    industries: ["Technology", "Internet", "Software"],
    location: "New York, NY",
    checkSize: "$10M - $200M",
    portfolioSize: 400,
    founded: 2001,
    aum: "$65B",
    recentInvestments: 40,
    avgDealTime: "1-2 months",
    followOnRate: 90,
    boardSeats: "Minimal board involvement",
    investmentThesis: "Backing high-growth technology companies",
    keyPartners: ["Chase Coleman", "Scott Shleifer", "John Curtius"],
    portfolioCompanies: ["Facebook", "LinkedIn", "Stripe", "Peloton", "Robinhood"],
    preferences: {
      revenueGrowth: 95,
      teamExperience: 70,
      marketSize: 92,
      traction: 95,
      geography: 60,
      techFounders: 70
    },
    investmentBehavior: {
      frequency: 0.9,
      dueDiligenceTime: 45,
      followOnLikelihood: 0.9,
      syndicationPreference: "lead",
      boardInvolvement: "low"
    }
  },
  {
    id: 10,
    name: "Kleiner Perkins",
    type: "Venture Capital",
    stage: ["Series A", "Series B", "Growth"],
    industries: ["Technology", "Healthcare", "CleanTech"],
    location: "Menlo Park, CA",
    checkSize: "$2M - $75M",
    portfolioSize: 900,
    founded: 1972,
    aum: "$9B",
    recentInvestments: 15,
    avgDealTime: "4-7 months",
    followOnRate: 85,
    boardSeats: "Active board leadership",
    investmentThesis: "Partnering with intrepid founders",
    keyPartners: ["John Doerr", "Mary Meeker", "Mamoon Hamid"],
    portfolioCompanies: ["Google", "Amazon", "Genentech", "Twitter", "Uber"],
    preferences: {
      revenueGrowth: 88,
      teamExperience: 90,
      marketSize: 85,
      traction: 82,
      geography: 75,
      techFounders: 85
    },
    investmentBehavior: {
      frequency: 0.68,
      dueDiligenceTime: 150,
      followOnLikelihood: 0.85,
      syndicationPreference: "lead",
      boardInvolvement: "high"
    }
  }
];

// Investment likelihood calculation factors
export const investmentFactors = {
  stageMatch: 0.25,      // How well startup stage matches investor preference
  industryMatch: 0.20,   // Industry alignment
  checkSizeMatch: 0.15,  // Funding amount alignment
  geographyMatch: 0.10,  // Location preference
  teamFit: 0.15,         // Team experience and composition
  tractionFit: 0.15      // Revenue and growth metrics
};

// Market condition modifiers for Monte Carlo simulation
export const marketConditions = {
  bull: { modifier: 1.2, volatility: 0.15 },
  neutral: { modifier: 1.0, volatility: 0.25 },
  bear: { modifier: 0.8, volatility: 0.35 }
};

export default mockInvestors;

