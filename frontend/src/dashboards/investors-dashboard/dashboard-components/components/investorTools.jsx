import React from "react";
import { Settings, Search, Star } from "lucide-react";
import Button from "./matchComponents/uiComponents/button.jsx";

function InvestorTools({ onPreferencesClick, onSearchClick, onSavedClick }) {
  return (
    <section className="bg-white border rounded-lg shadow-sm p-4 mt-6">
      <h2 className="text-lg font-semibold mb-3">Investor Tools</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <ToolCard
          title="Investment Preferences"
          icon={<Settings className="w-6 h-6 text-blue-600" />}
          description="Update your stage, industry, and region focus"
          onClick={onPreferencesClick}
        />

        <ToolCard
          title="Startup Search"
          icon={<Search className="w-6 h-6 text-green-600" />}
          description="Browse startups by filters like industry and stage"
          onClick={onSearchClick}
        />

        <ToolCard
          title="Watchlist"
          icon={<Star className="w-6 h-6 text-yellow-600" />}
          description="See startups you've saved for later"
          onClick={onSavedClick}
        />

      </div>
    </section>
  );
}

function ToolCard({ title, icon, description, onClick }) {
  return (
    <div className="border rounded-md p-4 hover:shadow-md transition-shadow flex flex-col justify-between">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <h3 className="text-md font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      <Button variant="outline" onClick={onClick}>Open</Button>
    </div>
  );
}

export default InvestorTools;
