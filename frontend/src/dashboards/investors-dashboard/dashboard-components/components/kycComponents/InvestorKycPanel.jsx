import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import VerificationEntryCard from "./VerificationEntryCard";
import VerificationWizard from "./VerificationWizard";

export default function InvestorKycPanel() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("not_started");

  return (
    <div className="space-y-4">
      <VerificationEntryCard status={status} onStart={() => setOpen(true)} />

      <VerificationWizard
        open={open}
        onOpenChange={setOpen}
        onComplete={(finalStatus) => setStatus(finalStatus || "pending_review")}
      />
    </div>
  );
}
