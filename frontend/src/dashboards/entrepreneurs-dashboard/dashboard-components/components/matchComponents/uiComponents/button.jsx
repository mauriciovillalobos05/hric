import React from "react";
import clsx from "clsx";

export default function Button({ className, children, size = "md", variant = "default", ...props }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-md font-medium transition",
        size === "sm" ? "px-3 py-1 text-sm" : "px-4 py-2 text-base",
        variant === "outline"
          ? "border border-gray-300 bg-white text-gray-800 hover:bg-gray-100"
          : "bg-blue-600 text-white hover:bg-blue-700",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}