import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import MultiSelectChips from "./MultiSelectChips";
import LocationMultiSelect from "@/pages/cmpnnts/LocationMultiSelect";

// Stages (covers what appears in your mocks, plus a few extra common ones)
const stageOptionsDefault = [
  "Seed",
  "Series A",
  "Series B",
  "Growth",
  "Late",
  "Pre-seed",
  "Series C",
  "IPO",
];

// Industries EXACTLY from your mockStartups
const industryOptionsDefault = [
  "AI/ML",
  "SaaS",
  "CyberSecurity",
  "Enterprise",
  "Logistics",
  "Healthcare",
  "FinTech",
  "CleanTech",
  "IoT",
  "EdTech",
  "AgriTech",
  "ClimateTech",
  "Hardware",
  "RetailTech",
  "BioTech",
];

const FilterPanel = ({
  filters,
  onFilterChange,
  stageOptions = stageOptionsDefault,
  industryOptions = industryOptionsDefault,
}) => {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const update = (patch) => {
    const next = { ...localFilters, ...patch };
    setLocalFilters(next);
    onFilterChange?.(next);
  };

  const handleSlider = (key, value) => update({ [key]: value[0] });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Investment Preferences</CardTitle>
        <p className="text-sm text-gray-600">
          Select stages, industries, and locations. Leave any section empty to include all.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stages (checkboxes) */}
        <MultiSelectChips
          label="Preferred Stages"
          options={stageOptions}
          values={localFilters.stagePreferences ?? []}
          onChange={(vals) => update({ stagePreferences: vals })}
        />

        {/* Locations */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Locations</Label>
          <LocationMultiSelect
            values={localFilters.locationPreferences ?? []}
            onChange={(vals) => update({ locationPreferences: vals })}
          />
          <p className="text-xs text-gray-500">
            Leave empty to mean <Badge variant="outline">All locations</Badge>
          </p>
        </div>

        {/* Industries (checkboxes) */}
        <MultiSelectChips
          label="Industry Focus"
          options={industryOptions}
          values={localFilters.industryPreferences ?? []}
          onChange={(vals) => update({ industryPreferences: vals })}
        />

        {/* Weights */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-4">Weight Preferences</h3>
          {[
            { key: "roiWeight", label: "ROI Importance" },
            { key: "technicalFoundersWeight", label: "Technical Founders" },
            { key: "previousExitsWeight", label: "Previous Exits" },
            { key: "revenueWeight", label: "Revenue Performance" },
            { key: "teamSizeWeight", label: "Team Size" },
            { key: "currentlyRaisingWeight", label: "Currently Raising Priority" },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm">{label}</Label>
                <Badge variant="outline">{(localFilters[key] ?? 0)}%</Badge>
              </div>
              <Slider
                value={[localFilters[key] ?? 0]}
                onValueChange={(v) => handleSlider(key, v)}
                max={100}
                step={5}
                className="w-full"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default FilterPanel;