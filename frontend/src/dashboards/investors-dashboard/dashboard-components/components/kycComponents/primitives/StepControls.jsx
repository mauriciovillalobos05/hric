import React from "react";
import { Button } from "@/components/ui/button";

export default function StepControls({
  onBack,
  onNext,
  nextLabel = "Continue",
  backDisabled,
  nextDisabled,
}) {
  return (
    <div className="flex items-center justify-between pt-4">
      <Button variant="outline" onClick={onBack} disabled={backDisabled}>Back</Button>
      <Button onClick={onNext} disabled={nextDisabled}>{nextLabel}</Button>
    </div>
  );
}
