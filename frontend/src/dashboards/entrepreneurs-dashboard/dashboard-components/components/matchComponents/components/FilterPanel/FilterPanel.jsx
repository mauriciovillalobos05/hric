import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  userTypes,
  stagePreferences,
  industryPreferences,
} from "./preferences";

// Checkbox stages
import MultiSelectChips from "./MultiSelectChips";

// Location dropdown
import LocationMultiSelect from "@/pages/cmpnnts/LocationMultiSelect";

export default function FilterPanel({ filters, onFilterChange }) {
  const [localFilters, setLocalFilters] = useState(filters);

  const investorTypeOptions = (userTypes || []).map((t) => t.label);
  const stageOptions = (stagePreferences || []).map(
    (s) => s.label ?? s.value ?? s
  );
  const industryOptions = (industryPreferences || []).map(
    (i) => i.label ?? i.value ?? i
  );

  useEffect(() => {
    const toLabel = (x) =>
      x && typeof x === "object" ? x.label ?? x.value : x;
    setLocalFilters({
      ...filters,
      investorTypes: (filters.investorTypes || []).map(toLabel),
      stagePreferences: (filters.stagePreferences || []).map(toLabel),
      industryPreferences: (filters.industryPreferences || []).map(toLabel),
      locationPreferences: Array.isArray(filters.locationPreferences)
        ? filters.locationPreferences
        : [], // keep as string array if your LocationMultiSelect returns strings
    });
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
        <CardTitle className="text-lg font-semibold">
          Investment Preferences
        </CardTitle>
        <p className="text-sm text-gray-600">
          Select stages, industries, and locations. Leave any section empty to
          include all.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Investor type */}
        <MultiSelectChips
          label="Investor Type"
          options={investorTypeOptions}
          values={
            Array.isArray(localFilters.investorTypes)
              ? localFilters.investorTypes
              : []
          }
          onChange={(vals) => update({ investorTypes: vals })}
        />

        {/* Stages (checkboxes) */}
        <MultiSelectChips
          label="Preferred Stages"
          options={stageOptions}
          values={
            Array.isArray(localFilters.stagePreferences)
              ? localFilters.stagePreferences
              : []
          }
          onChange={(vals) => update({ stagePreferences: vals })}
        />

        {/* Locations — identical look/feel to investor */}
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
          values={
            Array.isArray(localFilters.industryPreferences)
              ? localFilters.industryPreferences
              : []
          }
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
            {
              key: "currentlyRaisingWeight",
              label: "Currently Raising Priority",
            },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm">{label}</Label>
                <Badge variant="outline">{localFilters[key] ?? 0}%</Badge>
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
}
