import React from "react";
import clsx from "clsx";

export default function Badge({ className, children, variant = "default", ...props }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variant === "outline"
          ? "border border-gray-300 text-gray-700 bg-white"
          : "bg-blue-100 text-blue-800",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}