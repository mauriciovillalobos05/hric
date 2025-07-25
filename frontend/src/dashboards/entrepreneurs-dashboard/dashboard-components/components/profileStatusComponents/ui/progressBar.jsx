import React from 'react'

export default function ProgressBar({ value = 0 }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div
        className="h-full bg-blue-500 transition-all duration-500"
        style={{ width: `${value}%` }}
      ></div>
    </div>
  );
}
