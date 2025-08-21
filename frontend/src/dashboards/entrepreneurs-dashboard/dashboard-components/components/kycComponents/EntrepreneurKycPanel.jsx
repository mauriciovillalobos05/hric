// src/dashboards/entrepreneurs-dashboard/dashboard-components/components/kycComponents/EntrepreneurKycPanel.jsx
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Use the same named exports the investor panel uses
import {
  VerificationEntryCard,
  VerificationWizard,
} from "@/dashboards/investors-dashboard/dashboard-components/components/kycComponents";

/**
 * Entrepreneur-facing verification panel.
 * Mirrors InvestorKycPanel, but with entrepreneur copy.
 */
export default function EntrepreneurKycPanel() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("not_started");

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Entrepreneur Verification</CardTitle>
          <p className="text-sm text-muted-foreground">
            Verify your identity and company to unlock investor messaging,
            event access, and faster diligence.
          </p>
        </CardHeader>

        <CardContent>
          <VerificationEntryCard
            status={status}
            onStart={() => setOpen(true)}
          />
        </CardContent>
      </Card>

      <VerificationWizard
        open={open}
        onOpenChange={setOpen}
        onComplete={(finalStatus) =>
          setStatus(finalStatus || "pending_review")
        }
      />
    </>
  );
}