import React, { useRef, useState, useCallback, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Radar, BarChart3 } from "lucide-react";
import Dashboard from "./components/Dashboard"; // from Dashboard.jsx
import SpiderChart from "./components/SpiderChart";
import MonteCarloResults from "./components/MonteCarloResults";
import InvestorCard from "../matchComponents/components/FilterPanel/InvestorCard";

const MatchesDashboard = ({
  matchedInvestors,
  activeInvestor,
  simulationResults,
  onToggleCompare,
  onSimulate,
  compareIds,
}) => {
  const scrollerRef = useRef(null);
  const [atBottom, setAtBottom] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const reached =
      Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
    setAtBottom(reached);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    handleScroll(); // compute once on mount/resize
  }, [handleScroll]);

  return (
    <Tabs defaultValue="matches" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="matches">
          <Users className="w-4 h-4 mr-2" />
          Matches
        </TabsTrigger>
        <TabsTrigger value="compare">
          <Radar className="w-4 h-4 mr-2" />
          Compare
        </TabsTrigger>
        <TabsTrigger value="analytics">
          <BarChart3 className="w-4 h-4 mr-2" />
          Analytics
        </TabsTrigger>
      </TabsList>

      <TabsContent value="matches">
        <div className="relative lg:h-[calc(100vh-6rem)]">
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto pr-2"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {matchedInvestors.map((inv, index) => (
                <InvestorCard
                  key={inv.id ?? `${inv.name}-${index}`}
                  investor={inv}
                  matchScore={inv.matchScore}
                  isActive={activeInvestor?.id === inv.id}
                  isCompared={compareIds.includes(inv.id)}
                  onSimulate={() => onSimulate(inv)}
                  onToggleCompare={() => onToggleCompare(inv.id)}
                />
              ))}
            </div>
          </div>

          {/* Show fade only when NOT at bottom */}
          {!atBottom && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-b from-transparent to-white" />
          )}
        </div>
      </TabsContent>

      <TabsContent value="analytics">
        <Dashboard
          investors={matchedInvestors}
          filteredInvestors={matchedInvestors}
        />
      </TabsContent>

      <TabsContent value="compare">
        <SpiderChart
          investors={
            compareIds.length
              ? matchedInvestors.filter((i) => compareIds.includes(i.id))
              : []
          }
        />
      </TabsContent>

      <div className="mt-6">
        <MonteCarloResults
          selectedInvestors={activeInvestor}
          simulationResults={activeInvestor?.simulation ?? simulationResults}
        />
      </div>
    </Tabs>
  );
};

export default MatchesDashboard;
