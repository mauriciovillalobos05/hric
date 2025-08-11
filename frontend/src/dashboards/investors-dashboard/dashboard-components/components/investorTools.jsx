import React, { useState, useEffect } from "react";
import { Settings, Search, Star } from "lucide-react";
import Button from "./matchComponents/uiComponents/button.jsx";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import LocationAutocomplete from "@/pages/cmpnnts/Location.jsx";

// Defaults for dropdowns
const stageOptionsDefault = [
  "Idea","Pre-seed","Seed","Series A","Series B","Series C","Growth","IPO",
];
const industryOptionsDefault = [
  "Technology","Healthcare","Finance","Education","Agriculture",
  "Energy","E-commerce","Transportation","Media","Real Estate",
];

// Backend-aligned default filters
const defaultFilters = {
  stagePreference: "All",
  locationPreference: "All",
  industryPreference: "All",
  roiWeight: 20,
  technicalFoundersWeight: 15,
  previousExitsWeight: 10,
  revenueWeight: 25,
  teamSizeWeight: 10,
  currentlyRaisingWeight: 20,
};

function InvestorTools({ onSearchClick }) {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);

  // Preferences (aligned with backend keys)
  const [industryPreference, setIndustryPreference] = useState("All");
  const [stagePreference, setStagePreference] = useState("All");
  const [locationPreference, setLocationPreference] = useState("All");

  // Optional, ad-hoc search inputs
  const [searchIndustry, setSearchIndustry] = useState("");
  const [searchStage, setSearchStage] = useState("");

  const [filters, setFilters] = useState(defaultFilters);

  const dummyWatchlist = [
    { company: "GreenTech AI", founder: "Maria López", stage: "Seed", industry: "CleanTech", location: "Guadalajara, MX" },
    { company: "BioLogix", founder: "Carlos Rivera", stage: "Series A", industry: "HealthTech", location: "CDMX, MX" },
  ];

  useEffect(() => {
    const stored = JSON.parse(sessionStorage.getItem("investmentPreferences"));
    if (stored) {
      setIndustryPreference(stored.industryPreference ?? "All");
      setStagePreference(stored.stagePreference ?? "All");
      setLocationPreference(stored.locationPreference ?? "All");
      setFilters((prev) => ({
        ...prev,
        industryPreference: stored.industryPreference ?? "All",
        stagePreference: stored.stagePreference ?? "All",
        locationPreference: stored.locationPreference ?? "All",
      }));
    }
  }, []);

  const handlePreferencesSave = () => {
    const normalized = {
      industryPreference,
      stagePreference,
      locationPreference: locationPreference?.trim() ? locationPreference : "All",
    };
    sessionStorage.setItem("investmentPreferences", JSON.stringify(normalized));
    setFilters((prev) => ({ ...prev, ...normalized }));
    setShowPreferencesModal(false);
  };

  const handleSearch = () => {
    // Pass backend-shaped keys if parent triggers a match search
    if (onSearchClick) {
      onSearchClick({
        stagePreference: searchStage?.trim() || "All",
        industryPreference: searchIndustry?.trim() || "All",
      });
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
            description="Update your preferred stage, industry, and location"
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
            <div className="space-y-2">
              <Label>Preferred Industry</Label>
              <Select
                value={industryPreference}
                onValueChange={setIndustryPreference}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {industryOptionsDefault.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Funding Stage</Label>
              <Select
                value={stagePreference}
                onValueChange={setStagePreference}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {stageOptionsDefault.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <LocationAutocomplete
                value={locationPreference === "All" ? "" : locationPreference}
                onChange={(v) => setLocationPreference(v?.trim() ? v : "All")}
              />
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
            <div className="space-y-2">
              <Label>Industry</Label>
              <Select
                value={searchIndustry || "All"}
                onValueChange={(v) => setSearchIndustry(v === "All" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {industryOptionsDefault.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Funding Stage</Label>
              <Select
                value={searchStage || "All"}
                onValueChange={(v) => setSearchStage(v === "All" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {stageOptionsDefault.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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