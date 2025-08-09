// components/QuestionField.jsx
export default function QuestionField({ question, value, onChange }) {
  const { name, label, type, options = [], required } = question;

  if (name === "confidentiality") {
    return (
      <div className="mt-2">
        <label className="text-sm font-medium">{label}</label>
        <div className="mt-1">
          <label className="flex items-center space-x-3 border rounded px-4 py-3 bg-gray-50 shadow-sm">
            <input
              type="checkbox"
              name={name}
              checked={value === "Yes"}
              onChange={(e) =>
                onChange({
                  target: { name, value: e.target.checked ? "Yes" : "" },
                })
              }
              required={required}
              className="form-checkbox h-5 w-5 text-blue-600"
            />
            <span className="text-sm text-gray-700">
              I accept the confidentiality terms.
            </span>
          </label>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      {type === "select" ? (
        <select
          name={name}
          value={value || ""}
          onChange={onChange}
          className="w-full border rounded px-3 py-2 mt-1"
          required={required}
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          name={name}
          value={value || ""}
          onChange={onChange}
          rows={3}
          className="w-full border rounded px-3 py-2 mt-1"
          required={required}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value || ""}
          onChange={onChange}
          className="w-full border rounded px-3 py-2 mt-1"
          required={required}
        />
      )}
    </div>
  );
}
