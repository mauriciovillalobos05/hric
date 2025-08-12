import React from "react";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import StepHeader from "../primitives/StepHeader";
import StepControls from "../primitives/StepControls";
import { ShieldCheck } from "lucide-react";

export default function ConsentStep({ accepted, onChange, onBack, onNext }) {
  return (
    <div>
      <StepHeader icon={ShieldCheck} title="Consent & Disclosures"
        subtitle="We’ll verify your identity and screen per AML regulations." />
      <Separator className="my-3" />
      <div className="space-y-2 text-sm text-gray-700">
        <p>
          By continuing, you consent to identity verification and ongoing screening.
          Your data will be processed according to our Privacy Policy.
        </p>
        <div className="flex items-center gap-2 pt-2">
          <Checkbox id="consent" checked={accepted} onCheckedChange={onChange} />
          <Label htmlFor="consent">I agree to the terms and privacy policy.</Label>
        </div>
      </div>
      <StepControls onBack={onBack} onNext={onNext} nextDisabled={!accepted} />
    </div>
  );
}
