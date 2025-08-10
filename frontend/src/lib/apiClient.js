// src/lib/apiClient.js
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

async function request(path, { method = "GET", body, token, headers = {}, allow304 = false } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // If server replies 304 Not Modified and we opted-in, don’t throw
  if (res.status === 304 && allow304) {
    return { __notModified: true };
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }

  // You can still read Last-Modified from the body your server returns (last_refreshed).
  return res.status === 204 ? null : (isJson ? res.json() : {});
}

export function makeApi(token) {
  const withToken = (extra = {}) => ({ ...extra, token });
  const q = (params) =>
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");

  // simple per-mode timestamp cache in-memory
  const lastRefreshed = { investor: null, startup: null };

  return {
    me:         () => request(`/auth/me`, withToken()),
    investorMe: () => request(`/investors/me`, withToken()),

    // Send If-Modified-Since if we have a timestamp, accept 304
    matches:    async (opts = {}) => {
      const { mode = "investor", limit = 50 } = opts;
      const since = lastRefreshed[mode];

      const payload = await request(
        `/matching/matches?${q({ mode, limit })}`,
        withToken({
          allow304: true,
          headers: since ? { "If-Modified-Since": since } : {},
        })
      );

      if (payload?.__notModified) {
        return { notModified: true };
      }

      // server already includes last_refreshed in JSON; remember it for the next call
      if (payload?.last_refreshed) {
        lastRefreshed[mode] = payload.last_refreshed;
      }
      return payload;
    },

    messages:       (limit = 5)  => request(`/messages?${q({ folder: "inbox", limit })}`, withToken()),
    events:         (limit = 20) => request(`/events?${q({ from: "now", limit, include_registration: true })}`, withToken()),
    notifications:  (limit = 20) => request(`/messages?${q({ folder: "notifications", limit })}`, withToken()),
    matchInteract:  (matchId, action) =>
      request(`/matching/matches/${matchId}/interact`, { method: "POST", body: { action }, token }),
  };
}
