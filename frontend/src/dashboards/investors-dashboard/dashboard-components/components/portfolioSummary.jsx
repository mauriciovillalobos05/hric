// inside PortfolioSummary.jsx
import React from "react";

const mockPortfolio = [
  {
    name: "EcoGrow Labs",
    logo: "/logos/ecogrow.png",
    fundingStage: "Series A",
    industry: "AgTech",
    amount: "$100K",
    status: "Active"
  },
  {
    name: "FinPilot",
    logo: "/logos/finpilot.png",
    fundingStage: "Seed",
    industry: "FinTech",
    amount: "$50K",
    status: "Follow-up"
  },
];

function PortfolioSummary() {
  return (
    <section className="bg-white border rounded-lg shadow-sm p-6 mt-6">
      <h2 className="text-lg font-semibold mb-4">Your Portfolio</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockPortfolio.map((startup, idx) => (
          <div key={idx} className="border p-4 rounded-md flex items-center gap-4 hover:shadow transition-shadow">
            <img src={startup.logo} alt={startup.name} className="w-12 h-12 object-cover rounded-full" />
            <div>
              <h3 className="text-md font-semibold">{startup.name}</h3>
              <p className="text-sm text-gray-500">{startup.fundingStage} • {startup.industry}</p>
              <p className="text-sm text-gray-600">Invested: {startup.amount}</p>
              <p className={`text-xs mt-1 ${startup.status === "Active" ? "text-green-600" : "text-yellow-600"}`}>
                {startup.status}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default PortfolioSummary;
