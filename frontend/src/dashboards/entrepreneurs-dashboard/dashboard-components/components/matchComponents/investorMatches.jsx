import React, { useEffect, useState, useRef } from "react";
import InvestorCard from "./investorCard";
import { createClient } from "@supabase/supabase-js";
import Button from "./uiComponents/button";
import { toast } from "sonner";
import MatchCardSkeleton from "@/dashboards/investors-dashboard/dashboard-components/components/matchComponents/MatchCardSkeleton";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export default function InvestorMatches() {
  const [matches, setMatches] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const intervalRef = useRef(null);

  const fetchMatches = async (showToast = false) => {
    let toastId;
    if (showToast) toastId = toast.loading("Refreshing matches…");
    setIsFetching(true);

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

      if (showToast) toast.success("Matches updated", { id: toastId });
    } catch (err) {
      console.error("Error fetching matches:", err);
      if (showToast) toast.error("Failed to refresh matches", { id: toastId });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchMatches(true);

    intervalRef.current = setInterval(() => {
      fetchMatches(); // silent background refresh
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <section className="px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Investor Matches</h2>
        <Button
          onClick={() => fetchMatches(true)}
          variant="outline"
          size="sm"
        >
          {isFetching ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin w-4 h-4 text-gray-600"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                ></path>
              </svg>
              Loading
            </span>
          ) : (
            "Refresh Matches"
          )}
        </Button>
      </div>

      <div className="grid gap-4 transition-opacity duration-300 opacity-100">
        {isFetching && matches.length === 0 ? (
          <>
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </>
        ) : matches.length === 0 ? (
          <p className="text-gray-500 text-sm">No matches found.</p>
        ) : (
          matches.map((match, index) => {
            const investor = match.investor || {};

            return (
              <InvestorCard
                key={index}
                founder={`${investor.first_name || ""} ${investor.last_name || ""}`}
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
          })
        )}
      </div>
    </section>
  );
}