import React, { useState, useEffect } from "react";
import { Settings, Search, Star } from "lucide-react";
import Button from "./matchComponents/uiComponents/button.jsx";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function InvestorTools({ onSearchClick }) {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);

  const [industry, setIndustry] = useState("");
  const [stage, setStage] = useState("");
  const [region, setRegion] = useState("");
  const [searchIndustry, setSearchIndustry] = useState("");
  const [searchStage, setSearchStage] = useState("");

  const dummyWatchlist = [
    {
      company: "GreenTech AI",
      founder: "Maria López",
      stage: "Seed",
      industry: "CleanTech",
      location: "Guadalajara, MX",
    },
    {
      company: "BioLogix",
      founder: "Carlos Rivera",
      stage: "Series A",
      industry: "HealthTech",
      location: "CDMX, MX",
    },
  ];

  useEffect(() => {
    const stored = JSON.parse(sessionStorage.getItem("investmentPreferences"));
    if (stored) {
      setIndustry(stored.industry || "");
      setStage(stored.stage || "");
      setRegion(stored.region || "");
    }
  }, []);

  const handlePreferencesSave = () => {
    const updated = { industry, stage, region };
    sessionStorage.setItem("investmentPreferences", JSON.stringify(updated));
    setShowPreferencesModal(false);
  };

  const handleSearch = () => {
    if (onSearchClick) {
      onSearchClick({ industry: searchIndustry, stage: searchStage });
    }
    setShowSearchModal(false);
  };

  return (
    <>
      <section className="bg-white border rounded-lg shadow-sm p-4 mt-6">
        <h2 className="text-lg font-semibold mb-3">Investor Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ToolCard
            title="Investment Preferences"
            icon={<Settings className="w-6 h-6 text-blue-600" />}
            description="Update your stage, industry, and region focus"
            onClick={() => setShowPreferencesModal(true)}
          />

          <ToolCard
            title="Startup Search"
            icon={<Search className="w-6 h-6 text-green-600" />}
            description="Browse startups by filters like industry and stage"
            onClick={() => setShowSearchModal(true)}
          />

          <ToolCard
            title="Watchlist"
            icon={<Star className="w-6 h-6 text-yellow-600" />}
            description="See startups you've saved for later"
            onClick={() => setShowWatchlistModal(true)}
          />
        </div>
      </section>

      {/* --- Preferences Modal --- */}
      {showPreferencesModal && (
        <Modal title="Investment Preferences" onClose={() => setShowPreferencesModal(false)}>
          <div className="space-y-3">
            <div>
              <Label>Preferred Industry</Label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. FinTech" />
            </div>
            <div>
              <Label>Funding Stage</Label>
              <Input value={stage} onChange={(e) => setStage(e.target.value)} placeholder="e.g. Series A" />
            </div>
            <div>
              <Label>Region</Label>
              <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. LATAM" />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPreferencesModal(false)}>Cancel</Button>
            <Button onClick={handlePreferencesSave}>Save</Button>
          </div>
        </Modal>
      )}

      {/* --- Search Modal --- */}
      {showSearchModal && (
        <Modal title="Search Startups" onClose={() => setShowSearchModal(false)}>
          <div className="space-y-3">
            <div>
              <Label>Industry</Label>
              <Input value={searchIndustry} onChange={(e) => setSearchIndustry(e.target.value)} placeholder="e.g. CleanTech" />
            </div>
            <div>
              <Label>Funding Stage</Label>
              <Input value={searchStage} onChange={(e) => setSearchStage(e.target.value)} placeholder="e.g. Seed" />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSearchModal(false)}>Cancel</Button>
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </Modal>
      )}

      {/* --- Watchlist Modal --- */}
      {showWatchlistModal && (
        <Modal title="Your Watchlist" onClose={() => setShowWatchlistModal(false)}>
          <ul className="space-y-3 max-h-64 overflow-y-auto">
            {dummyWatchlist.map((startup, idx) => (
              <li key={idx} className="border p-3 rounded">
                <h4 className="font-semibold">{startup.company}</h4>
                <p className="text-sm text-gray-600">
                  Founder: {startup.founder} <br />
                  Industry: {startup.industry} <br />
                  Stage: {startup.stage} • {startup.location}
                </p>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
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
      <Button variant="outline" onClick={onClick}>
        Open
      </Button>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96 relative">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-500 hover:text-black text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default InvestorTools;