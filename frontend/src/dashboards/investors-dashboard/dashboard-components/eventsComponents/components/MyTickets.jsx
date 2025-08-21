import React, { useEffect, useMemo, useState } from "react";

/**
 * MyTickets (JS-only, clean & centered)
 * - Show tickets in a single column, centered
 * - Smaller, centered search bar
 * - Shows feedback when copying code
 * - Quantity removed
 * - ✅ Fix: upcoming/past now use reliable timestamps (from event.startMs/startISO)
 */

const MyTickets = ({ tickets = [], events = [], currentInvestorId = "investor-demo" }) => {
  const [filter, setFilter] = useState("upcoming");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 180);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    function onKey(e) {
      const target = e.target;
      const tagName = (target && target.tagName && target.tagName.toLowerCase()) || "";
      const typing = tagName === "input" || tagName === "textarea" || (target && target.isContentEditable);
      if (!typing && e.key === "/") {
        e.preventDefault();
        const el = document.getElementById("tickets-search");
        if (el) el.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Use the raw timestamps that EventManagementApp now sends on each event
  function getEventDateMs(ev) {
    if (Number.isFinite(ev?.startMs)) return ev.startMs;
    if (ev?.startISO) {
      const ms = Date.parse(ev.startISO);
      if (Number.isFinite(ms)) return ms;
    }
    if (ev?.date) {
      const ms = Date.parse(ev.date); // fallback, may be locale-dependent
      if (Number.isFinite(ms)) return ms;
    }
    return NaN;
  }

  const hydrated = useMemo(() => {
    const byId = new Map(events.map((e) => [e.id, e]));
    return tickets
      .filter((t) => t.investorId === currentInvestorId)
      .map((t) => ({ ...t, event: byId.get(t.eventId) }))
      .filter((t) => !!t.event);
  }, [tickets, events, currentInvestorId]);

  const nowMs = Date.now();

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    function statusOk(evMs) {
      if (filter === "all") return true;
      if (!Number.isFinite(evMs)) return false; // unknown date => exclude from upcoming/past
      return filter === "upcoming" ? evMs >= nowMs : evMs < nowMs;
    }
    return hydrated.filter((t) => {
      const evMs = getEventDateMs(t.event);
      if (!statusOk(evMs)) return false;
      if (!q) return true;
      const ev = t.event;
      const haystack = [ev && ev.title, ev && ev.venue, ev && ev.featured, ev && ev.special, t.tier, t.code]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [hydrated, filter, debouncedQuery, nowMs]);

  const groups = useMemo(() => {
    function monthKey(ev) {
      const ms = getEventDateMs(ev);
      if (!Number.isFinite(ms)) return "Unknown";
      const dt = new Date(ms);
      return dt.toLocaleString(undefined, { month: "long", year: "numeric" });
    }
    const map = new Map();
    for (const t of filtered) {
      const key = monthKey(t.event);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (hydrated.length === 0) {
    return (
      <div className="max-w-3xl mx-auto rounded-2xl bg-white/80 shadow p-8 text-center">
        <h3 className="text-2xl font-semibold">No tickets yet</h3>
        <p className="text-gray-600 mt-2">When you purchase tickets, they’ll show up here.</p>
      </div>
    );
  }

  function handleCopy(code, id) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Controls */}
      <div className="flex flex-col gap-4 items-center text-center">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="inline-flex rounded-2xl bg-white shadow ring-1 ring-black/5 p-1">
            {["upcoming", "past", "all"].map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                aria-pressed={filter === k}
                className={
                  "px-4 py-2 rounded-xl text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 " +
                  (filter === k ? "bg-indigo-600 text-white shadow" : "text-gray-700 hover:bg-gray-100")
                }
              >
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-64">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              id="tickets-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-xl border border-gray-300 bg-white pl-9 pr-16 py-1.5 shadow focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                className="absolute inset-y-0 right-2 my-0.5 px-2 rounded-lg text-xs bg-gray-100 hover:bg-gray-200"
                aria-label="Clear search"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="text-sm text-gray-500">
          Showing <span className="font-medium text-gray-700">{filtered.length}</span> ticket{filtered.length === 1 ? "" : "s"}
          {debouncedQuery ? (
            <> for <span className="font-mono text-gray-700">“{debouncedQuery}”</span></>
          ) : null}
        </div>
      </div>

      {/* Groups */}
      {groups.map(([month, items]) => (
        <section key={month} className="space-y-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">{month}</h4>
          <ul className="mx-auto grid grid-cols-1 gap-5 justify-items-center">
            {items.map((t) => {
              const evMs = getEventDateMs(t.event);
              const isUpcoming = Number.isFinite(evMs) ? evMs >= nowMs : false;
              return (
                <li key={t.id} className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 hover:shadow-md transition-shadow w-full">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold truncate">{t.event.title}</h3>
                    <span className={"px-2 py-1 rounded-lg text-xs font-semibold " + (isUpcoming ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600")}>{isUpcoming ? "Upcoming" : "Past"}</span>
                  </div>
                  <p className="text-gray-600 text-sm truncate mt-1">{t.event.date} • {t.event.time} • {t.event.venue}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 font-medium">{t.tier.charAt(0).toUpperCase() + t.tier.slice(1)} Tier</span>
                    <span className="px-2 py-1 rounded-md bg-gray-50 text-gray-700">Code: <span className="font-mono">{t.code}</span></span>
                    <span className="px-2 py-1 rounded-md bg-gray-50 text-gray-700">Purchased: {new Date(t.purchaseDate).toLocaleDateString()}</span>
                  </div>
                  {copiedId === t.id && (
                    <div className="text-xs text-gray-500 mt-2">Copied to clipboard!</div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleCopy(t.code, t.id)}
                      className="px-3 py-2 rounded-xl text-sm bg-gray-900 text-white hover:opacity-90 cursor-pointer"
                    >
                      Copy Code
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="px-3 py-2 rounded-xl text-sm bg-white border hover:bg-gray-50 cursor-pointer"
                    >
                      Print
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default MyTickets;
