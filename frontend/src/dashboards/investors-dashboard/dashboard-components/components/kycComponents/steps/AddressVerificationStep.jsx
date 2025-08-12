import React from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import StepHeader from "../primitives/StepHeader";
import StepControls from "../primitives/StepControls";
import { FileCheck2 } from "lucide-react";

export default function AddressVerificationStep({ verified, onVerify, onBack, onNext }) {
  return (
    <div>
      <StepHeader icon={FileCheck2} title="Address verification (optional)"
        subtitle="Upload PoA or confirm address (hook provider later)." />
      <Separator className="my-3" />
      <div className="rounded-lg border p-4 bg-gray-50">
        <p className="text-sm text-gray-700">This step can be risk-based. For now, click to simulate success or “Skip”.</p>
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={onVerify} disabled={verified}>
            {verified ? "Address Verified" : "Simulate PoA Success"}
          </Button>
          <Button variant="ghost" onClick={onNext}>Skip</Button>
        </div>
      </div>
      <StepControls onBack={onBack} onNext={onNext} />
    </div>
  );
}
