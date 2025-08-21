import React from "react";
import { getStatusMeta } from "../statusMeta";

export default function VerificationStatusText({ status = "not_started", className = "" }) {
  const { helpText } = getStatusMeta(status);
  return <p className={`text-sm text-gray-600 ${className}`}>{helpText}</p>;
}
