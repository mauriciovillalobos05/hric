// src/helpers/authBridge.js
export const STORAGE_KEYS = { USERS: "hri:users", SESSION: "hri:authSession" };

const read = (k) => { try { const r = sessionStorage.getItem(k); return r ? JSON.parse(r) : {}; } catch { return {}; } };
const write = (k,v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} };

const norm = (email) => (email || "").trim().toLowerCase();


export function getCurrentEmail() {
  const s = read(STORAGE_KEYS.SESSION);
  if (s && s.email) return norm(s.email);

  // fallback: registrationData
  try {
    const reg = JSON.parse(sessionStorage.getItem("registrationData") || "{}");
    if (reg?.email) return norm(reg.email);
  } catch {}

  // last resort: single user in map
  const users = read(STORAGE_KEYS.USERS);
  const emails = Object.keys(users || {});
  return emails.length === 1 ? norm(emails[0]) : null;
}

export function getSessionUser() {
  const email = getCurrentEmail();

  if (!email) return {};
  const users = read(STORAGE_KEYS.USERS);
  return users[email] || {};
}

export function setSessionUser(email, userObj) {
  const e = norm(email);
  const users = read(STORAGE_KEYS.USERS);
  users[e] = { ...(users[e] || {}), ...userObj };
  write(STORAGE_KEYS.USERS, users);
}

export function setAuthSession(email, payload = {}) {
  const e = norm(email);
  write(STORAGE_KEYS.SESSION, { email: e, ...payload, ts: Date.now() });
}

export const AuthBridge = { STORAGE_KEYS, getCurrentEmail, getSessionUser, setSessionUser, setAuthSession };
export default AuthBridge;
