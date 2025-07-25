import React from "react";
import InvestorCard from "./investorCard.jsx";

function InvestorMatches({ matches, onToggleFavorite }) {
  return (
    <section className="px-6 py-4">
      <h2 className="text-xl font-semibold mb-4">Investor Matches</h2>
      <div className="grid gap-4">
        {matches.map((investor, index) => (
          <InvestorCard
            key={index}
            {...investor}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}

export default InvestorMatches;
