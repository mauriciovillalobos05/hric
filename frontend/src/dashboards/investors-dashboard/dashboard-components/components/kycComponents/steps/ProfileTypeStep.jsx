import React from "react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import StepHeader from "../primitives/StepHeader";
import StepControls from "../primitives/StepControls";
import { User, Building2 } from "lucide-react";

export default function ProfileTypeStep({ value, onChange, onBack, onNext }) {
  return (
    <div>
      <StepHeader icon={User} title="Who are you verifying?"
        subtitle="Choose individual (you) or company (KYB with UBOs)." />
      <Separator className="my-3" />
      <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-2 gap-3">
        <Label htmlFor="individual"
          className={`border rounded-lg p-4 cursor-pointer ${value === "individual" ? "border-blue-500" : "border-gray-200"}`}>
          <div className="flex items-center gap-2">
            <RadioGroupItem id="individual" value="individual" />
            <User className="h-4 w-4" />
            Individual
          </div>
        </Label>

        <Label htmlFor="company"
          className={`border rounded-lg p-4 cursor-pointer ${value === "company" ? "border-blue-500" : "border-gray-200"}`}>
          <div className="flex items-center gap-2">
            <RadioGroupItem id="company" value="company" />
            <Building2 className="h-4 w-4" />
            Company
          </div>
        </Label>
      </RadioGroup>
      <StepControls onBack={onBack} onNext={onNext} />
    </div>
  );
}
