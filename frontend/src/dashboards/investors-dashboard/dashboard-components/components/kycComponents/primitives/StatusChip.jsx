import React from "react";
import { Badge } from "@/components/ui/badge";
import { getStatusMeta } from "../statusMeta";

export default function StatusChip({ status = "not_started" }) {
  const { label, badgeClass } = getStatusMeta(status);
  return <Badge className={badgeClass}>{label}</Badge>;
}
