import React from "react";

function ProfileStatusCard({
  completion = 0,
  missingRequired = [],
  missingOptional = [],
  onUpdateClick,
}) {
  return (
    <div className="w-full bg-white border rounded-xl p-4 md:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-600">Profile Completion</p>
          <p className="text-xs text-gray-500">
            Your profile is {completion}% complete
          </p>
        </div>
        <button
          onClick={onUpdateClick}
          className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm"
        >
          Update Profile
        </button>
      </div>

      {/* progress bar */}
      <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-black transition-all"
          style={{ width: `${completion}%` }}
        />
      </div>
      {/* Missing sections, wrap horizontally as chips */}
      {missingRequired.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-600 mb-1">
            Required (must fill):
          </p>
          <div className="flex flex-wrap gap-2">
            {missingRequired.map((m) => (
              <span
                key={`req-${m}`}
                className="px-2 py-1 text-xs rounded-full border bg-white"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {missingOptional.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-gray-600 mb-1">
            Nice to have:
          </p>
          <div className="flex flex-wrap gap-2">
            {missingOptional.map((m) => (
              <span
                key={`opt-${m}`}
                className="px-2 py-1 text-xs rounded-full border bg-white"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfileStatusCard;
