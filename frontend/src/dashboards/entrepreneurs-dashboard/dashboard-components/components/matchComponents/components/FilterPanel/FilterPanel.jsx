import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { userTypes, stagePreferences, industryPreferences } from "./preferences";
import MultiSelectChips from "./MultiSelectChips";
import LocationMultiSelect from "@/pages/cmpnnts/LocationMultiSelect";

const SLIDER_KEY_MAP = {
  roiWeight: "roi",
  technicalFoundersWeight: "technical_founders",
  previousExitsWeight: "previous_exits",
  revenueWeight: "revenue",
  teamSizeWeight: "team_size",
  currentlyRaisingWeight: "currently_raising",
};

const DEFAULT_WEIGHTS = {
  industry: 0.15, stage: 0.12, location: 0.08, risk: 0.08, thesis: 0.12,
  roi: 0.15, technical_founders: 0.08, previous_exits: 0.06, revenue: 0.09,
  team_size: 0.04, currently_raising: 0.03,
};

// Small debounce util for sessionStorage writes
function useDebouncedSaver(key, delay = 400) {
  const ref = useRef<number | null>(null);
  return useMemo(
    () => (value) => {
      if (ref.current) window.clearTimeout(ref.current);
      ref.current = window.setTimeout(() => {
        try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
        // notify listeners (MatchesDashboard) to re-read weights
        window.dispatchEvent(new Event("weights:updated"));
      }, delay);
    },
    [key, delay]
  );
}

export default function FilterPanel({
  filters,
  onFilterChange,
  // optional scoping key so each org/tab can keep its own weights
  weightsScopeKey = "startup-view",
}) {
  const [localFilters, setLocalFilters] = useState(filters);

  const investorTypeOptions = (userTypes || []).map((t) => t.label);
  const stageOptions = (stagePreferences || []).map((s) => s.label ?? s.value ?? s);
  const industryOptions = (industryPreferences || []).map((i) => i.label ?? i.value ?? i);

  const storageKey = `weights:${weightsScopeKey}`;
  const saveDebounced = useDebouncedSaver(storageKey, 400);

  // Load any stored weights and reflect into sliders on mount/filters change
  useEffect(() => {
    const toLabel = (x) => (x && typeof x === "object" ? x.label ?? x.value : x);
    const next = {
      ...filters,
      investorTypes: (filters.investorTypes || []).map(toLabel),
      stagePreferences: (filters.stagePreferences || []).map(toLabel),
      industryPreferences: (filters.industryPreferences || []).map(toLabel),
      locationPreferences: Array.isArray(filters.locationPreferences) ? filters.locationPreferences : [],
    };

    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const w = JSON.parse(raw) || {};
        // reflect stored weights back into the visible slider percentages
        for (const [uiKey, internal] of Object.entries(SLIDER_KEY_MAP)) {
          if (typeof w[internal] === "number") next[uiKey] = w[internal];
        }
      }
    } catch {}
    setLocalFilters(next);
  }, [filters, storageKey]);

  const update = (patch) => {
    const next = { ...localFilters, ...patch };
    setLocalFilters(next);
    onFilterChange?.(next);
  };

  // Persist slider changes to sessionStorage as INTERNAL weight keys
  const handleSlider = (key, value) => {
    const pct = value[0] ?? 0;
    update({ [key]: pct });

    // read current stored weights (or defaults), update the one component, save
    let current = { ...DEFAULT_WEIGHTS };
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) current = { ...current, ...JSON.parse(raw) };
    } catch {}
    const internalKey = SLIDER_KEY_MAP[key];
    current[internalKey] = pct; // leave others as-is; client re-ranker will renormalize
    saveDebounced(current);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Investment Preferences</CardTitle>
        <p className="text-sm text-gray-600">
          Select stages, industries, and locations. Leave any section empty to include all.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <MultiSelectChips
          label="Investor Type"
          options={investorTypeOptions}
          values={Array.isArray(localFilters.investorTypes) ? localFilters.investorTypes : []}
          onChange={(vals) => update({ investorTypes: vals })}
        />

        <MultiSelectChips
          label="Preferred Stages"
          options={stageOptions}
          values={Array.isArray(localFilters.stagePreferences) ? localFilters.stagePreferences : []}
          onChange={(vals) => update({ stagePreferences: vals })}
        />

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

        <MultiSelectChips
          label="Industry Focus"
          options={industryOptions}
          values={Array.isArray(localFilters.industryPreferences) ? localFilters.industryPreferences : []}
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