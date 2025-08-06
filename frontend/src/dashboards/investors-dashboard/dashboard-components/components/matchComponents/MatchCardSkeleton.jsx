// components/MatchCardSkeleton.jsx
import React from "react";

function MatchCardSkeleton() {
  return (
    <div className="border rounded-lg shadow-md p-4 bg-white animate-pulse space-y-4">
      <div className="flex items-center space-x-4">
        <div className="w-14 h-14 bg-gray-200 rounded-full"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="h-6 w-16 bg-gray-200 rounded"></div>
      </div>

      <div className="h-3 bg-gray-200 rounded w-full mt-2"></div>
      <div className="h-3 bg-gray-200 rounded w-5/6"></div>

      <div className="flex space-x-2 mt-2">
        <div className="h-5 w-20 bg-gray-200 rounded"></div>
        <div className="h-5 w-24 bg-gray-200 rounded"></div>
        <div className="h-5 w-16 bg-gray-200 rounded"></div>
      </div>

      <div className="flex justify-between items-center mt-4">
        <div className="h-3 bg-gray-200 w-24 rounded"></div>
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-gray-200 rounded"></div>
          <div className="h-8 w-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export default MatchCardSkeleton;