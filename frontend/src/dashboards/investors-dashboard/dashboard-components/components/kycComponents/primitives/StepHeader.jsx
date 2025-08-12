import React from "react";

export default function StepHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3">
      {Icon ? <Icon className="h-5 w-5 text-gray-700 mt-0.5" /> : null}
      <div>
        <h3 className="font-semibold">{title}</h3>
        {subtitle ? <p className="text-sm text-gray-500">{subtitle}</p> : null}
      </div>
    </div>
  );
}
