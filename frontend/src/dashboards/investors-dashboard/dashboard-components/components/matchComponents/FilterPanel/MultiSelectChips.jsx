// src/components/MultiSelectChips.jsx
import React from "react";

export default function MultiSelectChips({
  label,
  options = [],
  values = [],
  onChange,
  className = "",
}) {
  const selected = Array.isArray(values) ? values : [];
  const toggle = (opt) => {
    if (!onChange) return;
    if (selected.includes(opt)) onChange(selected.filter((x) => x !== opt));
    else onChange([...selected, opt]);
  };

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium mb-1">{label}</label>}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3 py-1 rounded-full border text-sm transition
              ${selected.includes(opt)
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
              }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}