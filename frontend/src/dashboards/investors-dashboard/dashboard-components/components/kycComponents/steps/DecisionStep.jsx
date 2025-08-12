import React from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StepHeader from "../primitives/StepHeader";
import { DialogFooter } from "@/components/ui/dialog";

export default function DecisionStep({ screening, decision, onDecide, onBack, onNext }) {
  const canApprove = screening.status === "passed";
  const canReview = screening.status === "review";
  const canDecline = screening.status === "failed";

  const current =
    decision ||
    (canApprove ? "approved" : canDecline ? "declined" : canReview ? "pending_review" : null);

  const pill =
    current === "approved"
      ? "bg-green-100 text-green-800"
      : current === "pending_review"
      ? "bg-yellow-100 text-yellow-800"
      : current === "declined"
      ? "bg-red-100 text-red-800"
      : "bg-gray-100 text-gray-700";

  return (
    <div>
      <StepHeader title="Decision" subtitle="Final status for this verification." />
      <Separator className="my-3" />
      <div className="space-y-3">
        <div className="text-sm">
          Current decision: <Badge className={pill}>{current || "—"}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => onDecide("approved")} disabled={!canApprove}>Approve</Button>
          <Button variant="outline" onClick={() => onDecide("pending_review")} disabled={!canReview}>
            Mark Needs Review
          </Button>
          <Button variant="destructive" onClick={() => onDecide("declined")} disabled={!canDecline}>
            Decline
          </Button>
        </div>
      </div>
      <DialogFooter className="pt-4">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Finish</Button>
      </DialogFooter>
    </div>
  );
}
