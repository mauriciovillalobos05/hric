import React from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StepHeader from "../primitives/StepHeader";
import StepControls from "../primitives/StepControls";
import { ScanFace } from "lucide-react";

export default function DocumentCaptureStep({ idVerified, onVerify, onBack, onNext }) {
  return (
    <div>
      <StepHeader icon={ScanFace} title="Identity check" subtitle="Placeholder for Stripe Identity (ID + selfie)." />
      <Separator className="my-3" />
      <div className="rounded-lg border p-4 bg-gray-50">
        <p className="text-sm text-gray-700">
          When ready, this area will launch Stripe’s hosted flow or embedded component.
          For now, use the button below to simulate a successful verification.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={onVerify} disabled={idVerified}>
            {idVerified ? "Identity Verified" : "Simulate Verification"}
          </Button>
          {idVerified ? <Badge className="bg-green-100 text-green-800">Verified</Badge> : null}
        </div>
      </div>
      <StepControls onBack={onBack} onNext={onNext} nextDisabled={!idVerified} />
    </div>
  );
}
