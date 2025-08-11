const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

export async function saveInvestorPreferences(filters, accessToken) {
  const r = await fetch(`${API_BASE}/api/match/investors/preferences`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(filters),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Failed to save preferences");
  return data;
}

export async function fetchMatches(payload, accessToken) {
  const r = await fetch(`${API_BASE}/api/match/investors/matches`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Failed to fetch matches");
  return data;
}