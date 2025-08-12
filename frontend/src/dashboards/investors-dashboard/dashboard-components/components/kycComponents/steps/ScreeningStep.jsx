import React from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StepHeader from "../primitives/StepHeader";
import StepControls from "../primitives/StepControls";
import { ShieldCheck } from "lucide-react";

export default function ScreeningStep({ screening, run, flag, fail, onBack, onNext }) {
  const statusBadge =
    screening.status === "passed"
      ? "bg-green-100 text-green-800"
      : screening.status === "review"
      ? "bg-yellow-100 text-yellow-800"
      : screening.status === "failed"
      ? "bg-red-100 text-red-800"
      : "bg-gray-100 text-gray-700";

  return (
    <div>
      <StepHeader icon={ShieldCheck} title="Sanctions/PEP/Adverse media screening"
        subtitle="Stubbed now; call your provider backend later." />
      <Separator className="my-3" />
      <div className="rounded-lg border p-4 bg-gray-50 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span>Status:</span>
          <Badge className={statusBadge}>{screening.status}</Badge>
          {["review", "failed"].includes(screening.status) && screening.hits > 0 ? (
            <span className="text-xs text-gray-600">Hits: {screening.hits}</span>
          ) : null}
        </div>
        <div className="text-sm text-gray-600">
          {screening.notes || "No results yet. Choose a simulated outcome below."}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button onClick={run}>Simulate Pass</Button>
          <Button variant="outline" onClick={flag}>Simulate Needs Review</Button>
          <Button variant="destructive" onClick={fail}>Simulate Fail</Button>
        </div>
      </div>
      <StepControls onBack={onBack} onNext={onNext} nextLabel="Continue" />
    </div>
  );
}
