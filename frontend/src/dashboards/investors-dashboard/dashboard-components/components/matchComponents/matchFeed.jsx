import React from "react";
import MatchCard from "./MatchCard";

function MatchFeed({ matches }) {
  return (
    <section className="px-6 py-4">
      <h2 className="text-xl font-semibold mb-4">Startup Matches</h2>
      <div className="grid gap-4">
        {matches.map((match, index) => (
          <MatchCard key={index} {...match} />
        ))}
      </div>
    </section>
  );
}

export default MatchFeed;
