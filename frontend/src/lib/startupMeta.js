// src/utils/startupMeta.js
export const SESSION_CONTACT_KEY = "startChatContact";

/** Build a quick lookup map keyed by startup name */
export function buildStartupMetaMap(mockStartups = []) {
  const map = {};
  (mockStartups || []).forEach((s) => {
    if (!s?.name) return;
    map[s.name] = {
      id: s.id ?? null,
      name: s.name,
      summary: s.summary ?? "",
      stage: s.stage ?? "",
      // keep both single and multi-industry shapes handy
      industry: s.industry ?? (Array.isArray(s.industries) ? s.industries[0] : ""),
      industries: Array.isArray(s.industries) ? s.industries : (s.industry ? [s.industry] : []),
      location: s.location ?? "",
    };
  });
  return map;
}

export function saveSessionContactMeta(startup) {
  if (!startup) return;
  const payload = {
    id: startup.id ?? null,
    name: startup.name ?? "",
    summary: startup.summary ?? "",
    industries: startup.industries ?? "",
  };
  try {
    sessionStorage.setItem(SESSION_CONTACT_KEY, JSON.stringify(payload));
  } catch {}
}

export function getSessionContactMeta() {
  try {
    const raw = sessionStorage.getItem(SESSION_CONTACT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
