import React, { useId } from "react";

export default function MultiSelectChips({
  label,
  options = [],
  values = [],
  onChange,
  className = "",
  columns = { base: 1, md: 2 }, // tweak if you want more/less columns
}) {
  const selected = Array.isArray(values) ? values : [];
  const groupId = useId();

  const toggle = (opt) => {
    if (!onChange) return;
    if (selected.includes(opt)) onChange(selected.filter((x) => x !== opt));
    else onChange([...selected, opt]);
  };

  const colClass =
    `grid grid-cols-${columns.base || 1} ` +
    (columns.md ? `md:grid-cols-${columns.md}` : "");

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium mb-2 text-slate-700">
          {label}
        </label>
      )}

      <fieldset className={`rounded-md ${colClass} gap-2`}>
        {options.map((opt, idx) => {
          const id = `${groupId}-${idx}`;
          const checked = selected.includes(opt);
          return (
            <label
              key={opt}
              htmlFor={id}
              className={`flex items-center gap-2 rounded-md border p-2 cursor-pointer transition
                ${checked
                  ? "border-blue-600 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
            >
              <input
                id={id}
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={checked}
                onChange={() => toggle(opt)}
              />
              <span className={`text-sm ${checked ? "text-slate-900" : "text-slate-700"}`}>
                {opt}
              </span>
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}