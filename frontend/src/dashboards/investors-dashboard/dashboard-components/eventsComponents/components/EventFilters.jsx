import React, { useState } from "react";

const EventFilters = ({ onChange }) => {
const [query, setQuery] = useState("");
const [tier, setTier] = useState("all");

// UI-only: call onChange with raw values; consumer can ignore or wire later.
const emit = () => onChange?.({ query, tier });

return (
<div className="bg-white rounded-xl shadow p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
<input
className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
placeholder="Search events..."
value={query}
onChange={(e) => setQuery(e.target.value)}
/>
<select
className="p-3 border border-gray-300 rounded-lg"
value={tier}
onChange={(e) => setTier(e.target.value)}
>
<option value="all">All tiers</option>
<option value="vip">VIP</option>
<option value="standard">Standard</option>
<option value="residents">Residents</option>
</select>
<button onClick={emit} className="px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
Apply
</button>
</div>
);
};

export default EventFilters;