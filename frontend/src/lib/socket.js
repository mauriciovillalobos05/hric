// src/lib/socket.js
import { io } from "socket.io-client";

let socket;

function getBaseUrl() {
  const fromEnv = (import.meta?.env?.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  // Only use dev-server origin when developing locally with Vite proxy
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (isLocal) return window.location.origin;  // dev proxy handles /socket.io
  }

  // In prod with no env set, don't try to hit the Vercel origin
  console.warn("[socket] VITE_API_BASE_URL missing; sockets disabled in prod");
  return null;
}

export function getSocket() {
  if (socket) return socket;

  const API_BASE = getBaseUrl();
  if (!API_BASE) return null; // prevent noisy retries in prod

  socket = io(API_BASE, {
    path: "/socket.io",
    transports: ["polling", "websocket"], // polling first; okay for dev/prod
    autoConnect: false,
    withCredentials: false,
    reconnectionAttempts: 5,  // optional: limit noise
    reconnectionDelayMax: 2000,
  });

  if (typeof window !== "undefined") {
    socket.on("connect",       () => console.log("[socket] connected", socket.id));
    socket.on("disconnect",    r  => console.log("[socket] disconnected:", r));
    socket.on("connect_error", e  => console.error("[socket] connect_error:", e?.message));
  }
  return socket;
}

export function connectSocketWithToken(token) {
  const s = getSocket();
  if (!s) return; // no base URL (e.g., prod without env) -> skip connecting
  s.auth = { token };
  if (!s.connected) s.connect();
}

export function disconnectSocket() {
  const s = getSocket();
  if (s?.connected) s.disconnect();
}