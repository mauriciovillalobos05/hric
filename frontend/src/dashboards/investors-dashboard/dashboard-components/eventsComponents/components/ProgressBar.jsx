import React from "react";

const ProgressBar = ({ value = 0 }) => (

<div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"> <div className="h-2 bg-blue-600 rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /> </div> );
export default ProgressBar;