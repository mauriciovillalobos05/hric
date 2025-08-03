import React, { useEffect, useState } from "react";
import InvestorCard from "./investorCard";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client (same as in your subscription code)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function InvestorMatches() {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token)
          throw new Error("User not authenticated");

        const res = await fetch(
          "http://127.0.0.1:8000/api/matching/matches",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to fetch matches");
        }

        const data = await res.json();
        if (data.matches) {
          setMatches(data.matches);
        }
      } catch (err) {
        console.error("Error fetching matches:", err);
      }
    };

    fetchMatches();
  }, []);

  return (
    <section className="px-6 py-4">
      <h2 className="text-xl font-semibold mb-4">Investor Matches</h2>
      <div className="grid gap-4">
        {matches.map((match, index) => {
          const investor = match.investor || {};

          return (
            <InvestorCard
              key={index}
              founder={`${investor.first_name || ""} ${
                investor.last_name || ""
              }`}
              company_name={`${investor.first_name}'s Portfolio`}
              description={`Investor from ${investor.location}`}
              location={investor.location}
              profile_image={investor.profile_image}
              match_score={match.compatibility_score}
              match_reasons={match.reasons}
              funding_stage={""}
              industry={""}
              isFavorite={false}
            />
          );
        })}
      </div>
    </section>
  );
}
