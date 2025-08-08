import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Radar, BarChart3 } from "lucide-react";
import Dashboard from "./components/Dashboard"; // from Dashboard.jsx
import SpiderChart from "./components/SpiderChart";
import MonteCarloResults from "./components/MonteCarloResults";
import InvestorCard from "../matchComponents/components/FilterPanel/InvestorCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const MatchesDashboard = ({
  matchedInvestors,
  selectedInvestors,
  onInvestorSelect,
  simulationResults,
}) => {
  return (
    <Tabs defaultValue="analytics" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="analytics">
          <BarChart3 className="w-4 h-4 mr-2" />
          Analytics
        </TabsTrigger>
        <TabsTrigger value="compare">
          <Radar className="w-4 h-4 mr-2" />
          Compare
        </TabsTrigger>
        <TabsTrigger value="matches">
          <Users className="w-4 h-4 mr-2" />
          Matches
        </TabsTrigger>
      </TabsList>

      <TabsContent value="analytics">
        <Dashboard
          investors={matchedInvestors}
          filteredInvestors={matchedInvestors}
        />
      </TabsContent>

      <TabsContent value="compare">
        <SpiderChart
          investors={matchedInvestors}
          selectedInvestors={selectedInvestors}
        />
      </TabsContent>

      <TabsContent
        value="matches"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4"
      >
        {matchedInvestors.map((investor, index) => (
          <InvestorCard
            key={investor.name + index}
            investor={investor}
            matchScore={investor.matchScore}
            onSelect={onInvestorSelect}
            isSelected={selectedInvestors.some((i) => i.id === investor.id)}
          />
        ))}
      </TabsContent>

      {simulationResults && selectedInvestors.length > 0 && (
        <div className="mt-6">
          <MonteCarloResults
            selectedStartup={selectedInvestors[0]}
            simulationResults={simulationResults}
          />
        </div>
      )}
    </Tabs>
  );
};

export default MatchesDashboard;
