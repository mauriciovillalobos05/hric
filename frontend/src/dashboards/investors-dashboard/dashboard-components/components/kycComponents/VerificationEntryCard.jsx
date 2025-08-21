import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import StatusChip from "./primitives/StatusChip";
import VerificationStatusText from "./primitives/VerificationStatusText";
import { getStatusMeta } from "./statusMeta";

function titleizeRole(raw) {
  if (!raw) return "Investor";
  const r = String(raw).toLowerCase().trim();
  // Map common aliases to a nice label
  const map = {
    investor: "Investor",
    entrepreneurs: "Entrepreneur",
    entrepreneur: "Entrepreneur",
    founder: "Entrepreneur",
  };
  if (map[r]) return map[r];
  // Generic title case fallback (handles "venture_partner", etc.)
  return r
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function readRoleFromSessionStorage() {
  if (typeof window === "undefined") return "Investor";
  try {
    // Try a few likely keys first that may store a full session object
    const candidates = [
      "kyc_session",
      "verification_session",
      "kyc",
      "session",
    ];
    for (const key of candidates) {
      const raw = window.sessionStorage.getItem(key);
      if (raw) {
        try {
          const obj = JSON.parse(raw);
          if (obj && obj.role) return obj.role;
        } catch {
          /* ignore JSON parse errors */
        }
      }
    }
    // Try simple scalar keys as a fallback
    const simpleRole =
      window.sessionStorage.getItem("registrationRole") ||
      window.sessionStorage.getItem("userRole");
    return simpleRole || "Investor";
  } catch {
    return "Investor";
  }
}

export default function VerificationEntryCard({
  status,
  onStart,
  role, // optional override
}) {
  const { helpText } = getStatusMeta(status);
  const resolvedRole = titleizeRole(role || readRoleFromSessionStorage());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {resolvedRole} Verification
          </CardTitle>
        </div>
        <StatusChip status={status} />
      </CardHeader>

      <CardContent className="flex items-center justify-between gap-4">
        <div className="text-gray-700">
          {/* Optional: show richer status text if you use it */}
          {/* <VerificationStatusText status={status} /> */}
          {helpText}
        </div>

        {status !== "approved" && (
          <Button onClick={onStart}>
            {status === "not_started" ? "Start" : "Resume"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}