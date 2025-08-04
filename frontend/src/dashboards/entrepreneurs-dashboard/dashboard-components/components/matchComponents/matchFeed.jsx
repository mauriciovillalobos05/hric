import React, { useEffect, useState } from "react";
import MatchCard from "./MatchCard";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client (same as in your subscription code)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function MatchFeed() {
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

        const res = await fetch("http://127.0.0.1:8000/api/matching/matches/investors", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        });

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
      <h2 className="text-xl font-semibold mb-4">Matched Investors</h2>
      <div className="grid gap-4">
        {matches.length === 0 ? (
          <p className="text-gray-500">No matches found yet.</p>
        ) : (
          matches.map((match, index) => (
            <MatchCard
              key={index}
              founder={`${match.investor.first_name} ${match.investor.last_name}`}
              company_name={match.investor.investor_type || "Investor"}
              description={`Interested in ${match.investor.industries?.join(", ") || "various sectors"}`}
              location={match.investor.location}
              profile_image={match.investor.profile_image}
              match_score={match.compatibility_score}
              match_reasons={match.match_reasons}
              funding_stage={match.investor.investment_stages?.join(", ")}
              industry={match.investor.industries?.[0]}
              isFavorite={false}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default MatchFeed;