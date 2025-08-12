import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import StatusChip from "./primitives/StatusChip";
import VerificationStatusText from "./primitives/VerificationStatusText";

import { getStatusMeta } from "./statusMeta";

export default function VerificationEntryCard({ status, onStart }) {

const { helpText } = getStatusMeta(status);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Investor Verification
          </CardTitle>
        </div>
        <StatusChip status={status} />
      </CardHeader>
      
      <CardContent className="flex items-center justify-between gap-4">
        <div className="text-gray-700"> 
            {helpText}
        </div>
        {
            status !== "approved" && (
                <Button onClick={onStart}>
                    {status === "not_started" ? "Start" : "Resume"}
                </Button>
            )
        }
      </CardContent>
    </Card>
  );
}
