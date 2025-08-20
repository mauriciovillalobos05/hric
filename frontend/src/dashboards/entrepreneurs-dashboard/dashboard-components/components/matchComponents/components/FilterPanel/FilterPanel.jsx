// FILE: FilterPanel.jsx  (simplified weights; no "sum to 100", no Normalize)
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

import MultiSelectChips from "./MultiSelectChips";
import LocationMultiSelect from "@/pages/cmpnnts/LocationMultiSelect";

import {
  userTypes,
  stagePreferences,
  industryPreferences,
} from "./preferences";

export default function FilterPanel({
  filters,
  onFilterChange,
  onApply,
  onReset,
  onSavePreset,
  startupCity,
}) {
  const [localFilters, setLocalFilters] = useState(filters || {});

  const investorTypeOptions = useMemo(
    () => (userTypes || []).map((t) => t.label ?? t.value ?? t),
    []
  );
  const stageOptions = useMemo(
    () => (stagePreferences || []).map((s) => s.label ?? s.value ?? s),
    []
  );
  const industryOptions = useMemo(
    () => (industryPreferences || []).map((i) => i.label ?? i.value ?? i),
    []
  );

  useEffect(() => {
    const toLabel = (x) => (x && typeof x === "object" ? x.label ?? x.value : x);
    setLocalFilters((prev) => ({
      ...prev,
      ...filters,
      investorTypes: (filters?.investorTypes || []).map(toLabel),
      stagePreferences: (filters?.stagePreferences || []).map(toLabel),
      industryPreferences: (filters?.industryPreferences || []).map(toLabel),
      locationPreferences: Array.isArray(filters?.locationPreferences)
        ? filters.locationPreferences
        : [],
      checkSizeRange: Array.isArray(filters?.checkSizeRange)
        ? filters.checkSizeRange
        : [0, 1000000],
      maxDecisionDays: Number.isFinite(filters?.maxDecisionDays)
        ? filters.maxDecisionDays
        : 30,
      verifiedOnly: Boolean(filters?.verifiedOnly),
      minTotalInvestments: Number.isFinite(filters?.minTotalInvestments)
        ? filters.minTotalInvestments
        : 0,
      minSuccessfulExits: Number.isFinite(filters?.minSuccessfulExits)
        ? filters.minSuccessfulExits
        : 0,
      portfolioKeyword: filters?.portfolioKeyword ?? "",
      preferMyCity: Boolean(filters?.preferMyCity),

      // Weights: each stands alone 0..100 (no sum constraint)
      industryFitWeight: clamp0to100(filters?.industryFitWeight ?? 30),
      stageAlignmentWeight: clamp0to100(filters?.stageAlignmentWeight ?? 25),
      geoCoverageWeight: clamp0to100(filters?.geoCoverageWeight ?? 15),
      checkSizeFitWeight: clamp0to100(filters?.checkSizeFitWeight ?? 20),
      decisionSpeedWeight: clamp0to100(filters?.decisionSpeedWeight ?? 5),
      verificationTrustWeight: clamp0to100(filters?.verificationTrustWeight ?? 5),
      activityTrackRecordWeight: clamp0to100(filters?.activityTrackRecordWeight ?? 0),
    }));
  }, [filters]);

  const update = (patch) => {
    const next = { ...localFilters, ...patch };
    setLocalFilters(next);
    onFilterChange?.(next);
  };

  const handleRangeSlider = (key, value) => update({ [key]: value });

  const resetAll = () => {
    const cleared = {
      investorTypes: [],
      stagePreferences: [],
      industryPreferences: [],
      locationPreferences: [],
      checkSizeRange: [0, 1000000],
      maxDecisionDays: 30,
      verifiedOnly: false,
      minTotalInvestments: 0,
      minSuccessfulExits: 0,
      portfolioKeyword: "",
      preferMyCity: false,
      industryFitWeight: 30,
      stageAlignmentWeight: 25,
      geoCoverageWeight: 15,
      checkSizeFitWeight: 20,
      decisionSpeedWeight: 5,
      verificationTrustWeight: 5,
      activityTrackRecordWeight: 0,
    };
    setLocalFilters(cleared);
    onFilterChange?.(cleared);
    onReset?.(cleared);
  };

  const applyNow = () => {
    onFilterChange?.(localFilters);
    onApply?.(localFilters); // parent will serialize and trigger refetch
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Investor Filters</CardTitle>
        <p className="text-sm text-gray-600">
          Refine your investor matches by type, stage, industry, geography, check size, and more.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Investor type */}
        <MultiSelectChips
          label="Investor Type"
          options={investorTypeOptions}
          values={Array.isArray(localFilters.investorTypes) ? localFilters.investorTypes : []}
          onChange={(vals) => update({ investorTypes: vals })}
        />

        {/* Stages */}
        <MultiSelectChips
          label="Preferred Stages"
          options={stageOptions}
          values={Array.isArray(localFilters.stagePreferences) ? localFilters.stagePreferences : []}
          onChange={(vals) => update({ stagePreferences: vals })}
        />

        {/* Industries */}
        <MultiSelectChips
          label="Industry Focus"
          options={industryOptions}
          values={Array.isArray(localFilters.industryPreferences) ? localFilters.industryPreferences : []}
          onChange={(vals) => update({ industryPreferences: vals })}
        />

        {/* Geography */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Locations (Coverage or HQ)</Label>
          <LocationMultiSelect
            values={localFilters.locationPreferences ?? []}
            onChange={(vals) => update({ locationPreferences: vals })}
          />
          <p className="text-xs text-gray-500">
            Leave empty to include <Badge variant="outline">All locations</Badge>.
          </p>
          {startupCity && (
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id="preferMyCity"
                checked={!!localFilters.preferMyCity}
                onCheckedChange={(v) => update({ preferMyCity: v })}
              />
              <Label htmlFor="preferMyCity" className="text-sm">Invest in my city ({startupCity})</Label>
            </div>
          )}
        </div>

        {/* Check size range */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Check Size Range (USD)</Label>
            <Badge variant="outline">
              {fmtUsd(localFilters.checkSizeRange?.[0])} – {fmtUsd(localFilters.checkSizeRange?.[1])}
            </Badge>
          </div>
          <Slider
            value={localFilters.checkSizeRange || [0, 1000000]}
            onValueChange={(v) => handleRangeSlider("checkSizeRange", v)}
            min={0}
            max={5000000}
            step={50000}
            className="w-full"
          />
          <p className="text-xs text-gray-500">Filters investors whose min/max investment overlaps this range.</p>
        </div>

        {/* Verified only */}
        <div className="flex items-center justify-between py-2">
          <div>
            <Label className="text-sm">Verified Investors Only</Label>
            <p className="text-xs text-gray-500">Show investors with platform verification.</p>
          </div>
          <Switch
            checked={!!localFilters.verifiedOnly}
            onCheckedChange={(v) => update({ verifiedOnly: v })}
          />
        </div>

        {/* Portfolio keyword */}
        <div className="space-y-2">
          <Label className="text-sm">Portfolio Keyword</Label>
          <Input
            value={localFilters.portfolioKeyword ?? ""}
            onChange={(e) => update({ portfolioKeyword: e.target.value })}
            placeholder="Search in portfolio companies (e.g., fintech)"
          />
        </div>

        {/* Weights (independent sliders) */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-3">Weight Preferences</h3>

          {[
            { key: "industryFitWeight", label: "Industry Fit" },
            { key: "stageAlignmentWeight", label: "Stage Alignment" },
            { key: "geoCoverageWeight", label: "Geography Coverage" },
            { key: "checkSizeFitWeight", label: "Check-size Fit" },
            { key: "decisionSpeedWeight", label: "Speed to Decision" },
            { key: "verificationTrustWeight", label: "Verification & Trust" },
            { key: "activityTrackRecordWeight", label: "Activity / Track Record" },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm">{label}</Label>
                <Badge variant="outline">{localFilters[key] ?? 0}%</Badge>
              </div>
              <Slider
                value={[clamp0to100(localFilters[key] ?? 0)]}
                onValueChange={(v) => update({ [key]: clamp0to100(v?.[0] ?? 0) })}
                max={100}
                step={5}
                className="w-full"
              />
            </div>
          ))}
        </div>

        {/* Action bar */}
        <div className="border-t pt-4 flex items-center gap-2 justify-end">
          <Button variant="ghost" onClick={resetAll}>Reset</Button>
          {onSavePreset && (
            <Button variant="secondary" onClick={() => onSavePreset?.(localFilters)}>
              Save Preset
            </Button>
          )}
          <Button onClick={applyNow}>Apply</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function fmtUsd(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return "$0";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function safeInt(v, dflt = 0) {
  const n = parseInt(String(v).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : dflt;
}
function clamp0to100(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return 0;
  return Math.min(100, Math.max(0, Math.round(x)));
}