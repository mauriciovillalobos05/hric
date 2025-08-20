// src/utils/investorMeta.js
export const SESSION_CONTACT_KEY = "startChatContact";

/** Build a quick lookup map keyed by investor name */
export function buildInvestorMetaMap(mockInvestors = []) {
  const map = {};
  (mockInvestors || []).forEach((inv) => {
    if (!inv?.name) return;
    map[inv.name] = {
      id: inv.id ?? null,
      name: inv.name,
      thesis: inv.investmentThesis ?? "",
      type: inv.type ?? "",
    };
  });
  return map;
}

export function saveSessionContactMeta(investor) {
  if (!investor) return;
  const payload = {
    id: investor.id ?? null,
    name: investor.name ?? "",
    thesis: investor.investmentThesis ?? "",
    type: investor.type ?? "",
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