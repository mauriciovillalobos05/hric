import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { userTypes, stagePreferences, locationPreferences, industryPreferences } from './preferences';

const FilterPanel = ({ filters, onFilterChange }) => {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters); // Sync local state with parent when filters reset
  }, [filters]);

  const handleSliderChange = (key, value) => {
    const updated = { ...localFilters, [key]: value[0] };
    setLocalFilters(updated);
    onFilterChange(updated);
  };

  const handleSelectChange = (key, value) => {
    const updated = { ...localFilters, [key]: value };
    setLocalFilters(updated);
    onFilterChange(updated);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Investment Preferences</CardTitle>
        <p className="text-sm text-gray-600">Adjust the weights to find your ideal startups</p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* User Type Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Investor Type --change this--</Label>
          <Select value={localFilters.userType} onValueChange={(value) => handleSelectChange('userType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select investor type" />
            </SelectTrigger>
            <SelectContent>
              {userTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stage Preference */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Preferred Stage</Label>
          <Select value={localFilters.stagePreference} onValueChange={(value) => handleSelectChange('stagePreference', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select stage preference" />
            </SelectTrigger>
            <SelectContent>
              {stagePreferences.map((stage) => (
                <SelectItem key={stage.value} value={stage.value}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Location Preference */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Location Preference</Label>
          <Select value={localFilters.locationPreference} onValueChange={(value) => handleSelectChange('locationPreference', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locationPreferences.map((location) => (
                <SelectItem key={location.value} value={location.value}>
                  {location.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Industry Preference */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Industry Focus</Label>
          <Select value={localFilters.industryPreference} onValueChange={(value) => handleSelectChange('industryPreference', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent>
              {industryPreferences.map((industry) => (
                <SelectItem key={industry.value} value={industry.value}>
                  {industry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-4">Weight Preferences</h3>

          {/* Reusable slider block */}
          {[
            { key: 'roiWeight', label: 'ROI Importance' },
            { key: 'technicalFoundersWeight', label: 'Technical Founders' },
            { key: 'previousExitsWeight', label: 'Previous Exits' },
            { key: 'revenueWeight', label: 'Revenue Performance' },
            { key: 'teamSizeWeight', label: 'Team Size' },
            { key: 'currentlyRaisingWeight', label: 'Currently Raising Priority' },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm">{label}</Label>
                <Badge variant="outline">{localFilters[key]}%</Badge>
              </div>
              <Slider
                value={[localFilters[key]]}
                onValueChange={(value) => handleSliderChange(key, value)}
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